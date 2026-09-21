import { useEffect, useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, SafeAreaView, StatusBar,
  Modal, ScrollView, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";
import API from "../services/api";

const socket = io("https://hear-me-out-backend-production-8100.up.railway.app");

// react-native's core SafeAreaView only applies inset padding on iOS — on
// Android it's a no-op, so the header sat under/behind the status bar
// without this, making it hard to see and tap.
const ANDROID_STATUS_BAR_PAD = Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0;

export default function ChatScreen({ navigation }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userId, setUserId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduledIds, setRescheduledIds] = useState({});

  // schedule modal (calendar + time slots) — opened from "missed schedule" notice
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedTargetItem, setSchedTargetItem] = useState(null);
  const [schedDate,       setSchedDate]      = useState("");
  const [schedMonth,      setSchedMonth]     = useState(new Date());
  const [schedSlots,      setSchedSlots]     = useState([]);
  const [schedTime,       setSchedTime]      = useState("");
  const [schedLoading,    setSchedLoading]   = useState(false);
  const [schedErr,        setSchedErr]       = useState("");

  const flatRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const uid = await AsyncStorage.getItem("userId");
      setUserId(uid);
      setRoomId(uid);
      socket.emit("joinRoom", uid);
    };

    init();

    socket.on("loadMessages", (data) => setMessages(data));
    socket.on("receiveMessage", (data) => setMessages((prev) => [...prev, data]));
    socket.on("messagesSeen", (updatedMessages) => setMessages(updatedMessages));
    socket.on("typing", () => setIsTyping(true));
    socket.on("stopTyping", () => setIsTyping(false));

    return () => {
      socket.off("receiveMessage");
      socket.off("loadMessages");
      socket.off("messagesSeen");
      socket.off("typing");
      socket.off("stopTyping");
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0 && userId) {
      const hasUnseen = messages.some(
        (m) => !m.seen && String(m.senderId) !== String(userId)
      );
      if (hasUnseen && roomId) {
        socket.emit("markSeen", { roomId: String(roomId), userId: String(userId) });
      }
    }
  }, [messages, userId, roomId]);

  const handleTyping = (text) => {
    setMessage(text);
    socket.emit("typing", { roomId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", { roomId });
    }, 1000);
  };

  const sendMessage = () => {
    if (!message.trim() || !roomId || !userId) return;
    socket.emit("sendMessage", {
      roomId:   String(roomId),
      senderId: String(userId),
      message:  message.trim(),
    });
    socket.emit("stopTyping", { roomId });
    setMessage("");
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Recognize the two automated notices and what action/label each takes
  const getSystemAction = (item) => {
    if (item.senderId !== "system") return null;
    const text = item.message || "";
    if (text.startsWith("You missed your schedule")) {
      return { type: "missed", label: "📅 Reschedule Appointment" };
    }
    if (text.startsWith("Hello, we have a vacant schedule today")) {
      return { type: "vacancy", endpoint: "/appointments/accept-vacancy", label: "✅ Yes, move me to today" };
    }
    return null;
  };

  const handleSystemAction = async (item, endpoint) => {
    if (reschedulingId) return;
    setReschedulingId(item._id);
    try {
      const res = await API.post(endpoint);
      const confirmText = res.data.success && res.data.appointment?.scheduleDate
        ? `✅ New appointment scheduled: ${new Date(res.data.appointment.scheduleDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
        : (res.data.message || "Could not schedule an appointment right now.");
      socket.emit("sendMessage", {
        roomId:   String(roomId),
        senderId: String(userId),
        message:  confirmText,
      });
      setRescheduledIds((prev) => ({ ...prev, [item._id]: true }));
    } catch (e) {
      console.log("System action error:", e);
    } finally {
      setReschedulingId(null);
    }
  };

  /* ── Calendar-based reschedule (opened from the "missed schedule" notice) ── */
  const toDateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const startOfToday = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const isSelectableDay = (d) => { const dow = d.getDay(); return dow !== 0 && dow !== 6 && d >= startOfToday(); };
  const getMonthGrid = (monthDate) => {
    const year = monthDate.getFullYear(), month = monthDate.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array(firstDow).fill(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
    return cells;
  };
  const goToMonth = (offset) => setSchedMonth(m => new Date(m.getFullYear(), m.getMonth() + offset, 1));

  // Splits a flat list of month cells into fixed 7-cell week rows, so the
  // grid can be rendered as one explicit <View row> per week instead of
  // relying on flexWrap to break exactly every 7 cells.
  const chunkIntoWeeks = (cells) => {
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  };

  const fetchSlotsForDate = async (dateStr) => {
    setSchedLoading(true);
    setSchedTime("");
    try {
      const res = await API.get(`/appointments/available-slots?date=${dateStr}`);
      setSchedSlots(res.data.success ? (res.data.slots || []) : []);
    } catch (e) {
      setSchedSlots([]);
    } finally {
      setSchedLoading(false);
    }
  };

  const openScheduleModal = (item) => {
    let d = startOfToday();
    while (!isSelectableDay(d)) d = new Date(d.getTime() + 86400000);
    const firstDay = toDateStr(d);
    setSchedTargetItem(item);
    setSchedErr("");
    setSchedMonth(d);
    setSchedDate(firstDay);
    setSchedModalOpen(true);
    fetchSlotsForDate(firstDay);
  };

  const handleConfirmSchedule = async () => {
    if (!schedDate || !schedTime) return;
    setReschedulingId(schedTargetItem?._id);
    setSchedErr("");
    try {
      const dt = new Date(`${schedDate}T${schedTime}:00`);
      const res = await API.post("/appointments", { scheduleDate: dt });
      if (res.data.success) {
        const confirmText = res.data.appointment?.scheduleDate
          ? `✅ New appointment scheduled: ${new Date(res.data.appointment.scheduleDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
          : "✅ Appointment scheduled!";
        socket.emit("sendMessage", { roomId: String(roomId), senderId: String(userId), message: confirmText });
        if (schedTargetItem) setRescheduledIds((prev) => ({ ...prev, [schedTargetItem._id]: true }));
        setSchedModalOpen(false);
      } else {
        setSchedErr(res.data.message || "Could not schedule that slot.");
        fetchSlotsForDate(schedDate);
      }
    } catch (e) {
      setSchedErr(e.response?.data?.message || "Error scheduling appointment.");
    } finally {
      setReschedulingId(null);
    }
  };

  const renderMessage = ({ item, index }) => {
    const isMe = String(item.senderId) === String(userId);
    const isLast = index === messages.length - 1;
    const action = getSystemAction(item);
    const showAction = action && !rescheduledIds[item._id];
    return (
      <View>
        <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
          {!isMe && (
            <View style={styles.theirAvatar}>
              <Text style={{ fontSize: 14 }}>👨‍⚕️</Text>
            </View>
          )}
          <View style={isMe ? styles.myBubble : styles.theirBubble}>
            <Text style={isMe ? styles.myBubbleText : styles.theirBubbleText}>
              {item.message}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
              {isMe && isLast && (
                <Text style={styles.seenText}>{item.seen ? " ✓✓" : " ✓"}</Text>
              )}
            </View>
          </View>
        </View>
        {showAction && (
          <TouchableOpacity
            onPress={() => action.type === "missed" ? openScheduleModal(item) : handleSystemAction(item, action.endpoint)}
            disabled={reschedulingId === item._id}
            style={[styles.rescheduleBtn, reschedulingId === item._id && { opacity: 0.6 }]}
          >
            <Text style={styles.rescheduleBtnText}>
              {reschedulingId === item._id ? "Scheduling…" : action.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#6C63FF" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <LinearGradient colors={["#6C63FF", "#764ba2"]} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.counselorAvatar}>
              <Text style={{ fontSize: 22 }}>👨‍⚕️</Text>
            </View>
            <View>
              <Text style={styles.headerName}>Your Counselor</Text>
              <Text style={styles.headerStatus}>
                {isTyping ? "Typing…" : "Online ●"}
              </Text>
            </View>
          </View>
          <Text style={styles.headerHeart}>💙</Text>
        </LinearGradient>

        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>
              Start the conversation with your counselor
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() =>
              flatRef.current?.scrollToEnd({ animated: true })
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {isTyping && (
          <View style={styles.typingRow}>
            <View style={styles.theirAvatar}>
              <Text style={{ fontSize: 12 }}>👨‍⚕️</Text>
            </View>
            <View style={styles.typingBubble}>
              <Text style={styles.typingText}>Typing…</Text>
            </View>
          </View>
        )}

        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              value={message}
              onChangeText={handleTyping}
              placeholder="Type a message…"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            onPress={sendMessage}
            activeOpacity={0.8}
            disabled={!message.trim()}
          >
            <LinearGradient
              colors={message.trim() ? ["#6C63FF", "#764ba2"] : ["#D1D5DB", "#D1D5DB"]}
              style={styles.sendBtn}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Schedule Appointment Modal — opened from "missed schedule" notice */}
      <Modal
        visible={schedModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSchedModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSchedModalOpen(false)}
        />
        <View style={styles.schedSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Schedule Your Appointment</Text>
            <TouchableOpacity onPress={() => setSchedModalOpen(false)} style={styles.schedCloseBtn}>
              <Text style={{ color:"#fff", fontSize:13 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.schedSub}>Pick a date and an open time slot below.</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
            <View style={styles.calNavRow}>
              <TouchableOpacity
                onPress={() => goToMonth(-1)}
                disabled={schedMonth.getFullYear() === startOfToday().getFullYear() && schedMonth.getMonth() === startOfToday().getMonth()}
                style={[styles.calNavBtn, (schedMonth.getFullYear() === startOfToday().getFullYear() && schedMonth.getMonth() === startOfToday().getMonth()) && { opacity: 0.3 }]}
              >
                <Text style={{ color:"#fff", fontSize:16 }}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.calNavLabel}>
                {schedMonth.toLocaleDateString("en-US", { month:"long", year:"numeric" })}
              </Text>
              <TouchableOpacity onPress={() => goToMonth(1)} style={styles.calNavBtn}>
                <Text style={{ color:"#fff", fontSize:16 }}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.calWeekRow}>
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <Text key={i} style={styles.calWeekDay}>{d}</Text>
              ))}
            </View>

            {/* Day grid — built as explicit 7-cell week rows so a cell can
                never wrap onto the wrong row from pixel-rounding drift. */}
            <View style={{ marginBottom:18 }}>
              {chunkIntoWeeks(getMonthGrid(schedMonth)).map((week, wi) => (
                <View key={wi} style={styles.calWeekGridRow}>
                  {week.map((d, i) => {
                    if (!d) return <View key={i} style={styles.calDayCell} />;
                    const dStr = toDateStr(d);
                    const isSel = dStr === schedDate;
                    const isToday = dStr === toDateStr(startOfToday());
                    const selectable = isSelectableDay(d);
                    return (
                      <View key={i} style={styles.calDayCell}>
                        <TouchableOpacity
                          disabled={!selectable}
                          onPress={() => { setSchedDate(dStr); fetchSlotsForDate(dStr); }}
                          style={[
                            styles.calDay,
                            isSel && styles.calDayActive,
                            !selectable && styles.calDayDisabled,
                            isToday && !isSel && styles.calDayToday,
                          ]}
                        >
                          <Text style={[styles.calDayText, !selectable && { color:"rgba(255,255,255,0.15)" }]}>
                            {d.getDate()}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            <Text style={styles.schedSectionLabel}>AVAILABLE TIMES</Text>
            {schedLoading ? (
              <View style={{ paddingVertical:24, alignItems:"center" }}>
                <ActivityIndicator color="#6C63FF" />
              </View>
            ) : schedSlots.every(sl => !sl.available) ? (
              <Text style={styles.schedEmptyText}>No open slots this day — try another date.</Text>
            ) : (
              <View style={styles.slotGrid}>
                {schedSlots.map(sl => (
                  <TouchableOpacity
                    key={sl.value}
                    disabled={!sl.available}
                    onPress={() => setSchedTime(sl.value)}
                    style={[
                      styles.slotBtn,
                      schedTime === sl.value && styles.slotBtnActive,
                      !sl.available && styles.slotBtnDisabled,
                    ]}
                  >
                    <Text style={[styles.slotBtnText, !sl.available && styles.slotBtnTextDisabled]}>
                      {sl.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!!schedErr && <Text style={styles.schedErrText}>{schedErr}</Text>}

            <TouchableOpacity
              onPress={handleConfirmSchedule}
              disabled={!schedTime || reschedulingId === schedTargetItem?._id}
              style={[styles.schedConfirmBtn, (!schedTime || reschedulingId === schedTargetItem?._id) && { opacity: 0.5 }]}
            >
              <Text style={styles.schedConfirmBtnText}>
                {reschedulingId === schedTargetItem?._id ? "Scheduling…" : "Confirm Appointment"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    padding: 14, paddingTop: 8 + ANDROID_STATUS_BAR_PAD, gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  backText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  counselorAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  headerName: { color: "#fff", fontWeight: "700", fontSize: 15 },
  headerStatus: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 1 },
  headerHeart: { fontSize: 20 },
  emptyState: {
    flex: 1, justifyContent: "center",
    alignItems: "center", backgroundColor: "#F3F4F8", gap: 10,
  },
  emptyIcon: { fontSize: 52, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1A1A2E" },
  emptyText: {
    fontSize: 13, color: "#9CA3AF",
    textAlign: "center", paddingHorizontal: 40,
  },
  messageList: {
    padding: 14, paddingBottom: 4,
    backgroundColor: "#F3F4F8", flexGrow: 1,
  },
  msgRow: {
    flexDirection: "row", alignItems: "flex-end",
    marginBottom: 8, gap: 6,
  },
  msgRowMe:   { justifyContent: "flex-end" },
  msgRowThem: { justifyContent: "flex-start" },
  theirAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#EEF2FF",
    justifyContent: "center", alignItems: "center",
  },
  myBubble: {
    backgroundColor: "#6C63FF", borderRadius: 18,
    borderBottomRightRadius: 4, padding: 12, maxWidth: "72%",
    shadowColor: "#6C63FF", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  myBubbleText: { color: "#fff", fontSize: 14, lineHeight: 20 },
  theirBubble: {
    backgroundColor: "#fff", borderRadius: 18,
    borderBottomLeftRadius: 4, padding: 12, maxWidth: "72%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07, shadowRadius: 4, elevation: 2,
  },
  theirBubbleText: { color: "#1A1A2E", fontSize: 14, lineHeight: 20 },
  rescheduleBtn: {
    alignSelf: "flex-start", marginLeft: 32, marginBottom: 10, marginTop: -2,
    backgroundColor: "#6C63FF", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: "#6C63FF", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  rescheduleBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  timeText: { fontSize: 9, opacity: 0.65, color: "inherit" },
  seenText: { fontSize: 9, opacity: 0.65 },
  typingRow: {
    flexDirection: "row", alignItems: "center",
    gap: 6, paddingHorizontal: 14, paddingBottom: 6,
    backgroundColor: "#F3F4F8",
  },
  typingBubble: {
    backgroundColor: "#fff", borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  typingText: { color: "#9CA3AF", fontSize: 12, fontStyle: "italic" },
  inputBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#E5E7EB",
  },
  inputWrap: {
    flex: 1, backgroundColor: "#F9FAFB", borderRadius: 24,
    borderWidth: 2, borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 2,
    maxHeight: 100,
  },
  input: {
    fontSize: 14, color: "#1A1A2E",
    paddingVertical: Platform.OS === "android" ? 8 : 0,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#6C63FF", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  sendIcon: { color: "#fff", fontSize: 17, fontWeight: "700" },

  /* ── Schedule Appointment modal ── */
  modalOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.55)" },
  schedSheet: {
    backgroundColor:"#181830",
    borderTopLeftRadius:28, borderTopRightRadius:28,
    paddingBottom:Platform.OS === "ios" ? 34 : 20,
    paddingHorizontal:20,
    paddingTop:12,
    maxHeight:"88%",
    borderWidth:1, borderColor:"rgba(255,255,255,0.08)",
  },
  sheetHandle: {
    width:40, height:4, borderRadius:2,
    backgroundColor:"rgba(255,255,255,0.2)",
    alignSelf:"center", marginBottom:16,
  },
  sheetHeader: {
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    marginBottom:14,
  },
  sheetTitle: { fontSize:16, fontWeight:"800", color:"#fff" },
  schedCloseBtn: {
    width:26, height:26, borderRadius:13,
    backgroundColor:"rgba(255,255,255,0.1)",
    alignItems:"center", justifyContent:"center",
  },
  schedSub: { fontSize:13, color:"rgba(255,255,255,0.45)", marginBottom:16 },
  calNavRow: {
    flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    marginBottom:14,
  },
  calNavBtn: {
    width:30, height:30, borderRadius:15,
    backgroundColor:"rgba(255,255,255,0.08)",
    alignItems:"center", justifyContent:"center",
  },
  calNavLabel: { fontSize:14, fontWeight:"700", color:"#fff" },
  calWeekRow: { flexDirection:"row", marginBottom:4 },
  calWeekDay: {
    width:`${100/7}%`, textAlign:"center",
    fontSize:11, fontWeight:"700", color:"rgba(255,255,255,0.35)",
  },
  calGrid: { flexDirection:"row", flexWrap:"wrap", marginBottom:18 },
  calWeekGridRow: { flexDirection:"row" },
  // No padding here — padding on top of a percentage width can push 7
  // columns just past 100% and silently wrap the row after 6 cells instead.
  calDayCell: { width:`${100/7}%`, aspectRatio:1 },
  calDay: {
    flex:1, margin:2, borderRadius:10, alignItems:"center", justifyContent:"center",
    backgroundColor:"rgba(255,255,255,0.04)",
  },
  calDayText: { fontSize:13, fontWeight:"600", color:"#fff" },
  calDayToday: { borderWidth:1.5, borderColor:"rgba(108,99,255,0.6)" },
  calDayActive: { backgroundColor:"#6C63FF" },
  calDayDisabled: { backgroundColor:"transparent" },
  schedSectionLabel: {
    fontSize:11, fontWeight:"700", color:"rgba(255,255,255,0.4)",
    letterSpacing:1, marginBottom:10,
  },
  schedEmptyText: {
    fontSize:13, color:"rgba(255,255,255,0.4)", textAlign:"center",
    paddingVertical:20,
  },
  slotGrid: { flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:8 },
  slotBtn: {
    width:"31%", paddingVertical:10, borderRadius:10,
    backgroundColor:"rgba(255,255,255,0.05)",
    alignItems:"center",
  },
  slotBtnActive: { backgroundColor:"#6C63FF" },
  slotBtnDisabled: { backgroundColor:"rgba(255,255,255,0.02)" },
  slotBtnText: { fontSize:13, fontWeight:"600", color:"#fff" },
  slotBtnTextDisabled: { color:"rgba(255,255,255,0.2)", textDecorationLine:"line-through" },
  schedErrText: {
    fontSize:13, fontWeight:"600", color:"#F87171",
    textAlign:"center", marginTop:12,
  },
  schedConfirmBtn: {
    marginTop:20, paddingVertical:14, borderRadius:12,
    backgroundColor:"#6C63FF", alignItems:"center",
  },
  schedConfirmBtnText: { fontSize:15, fontWeight:"700", color:"#fff" },
});