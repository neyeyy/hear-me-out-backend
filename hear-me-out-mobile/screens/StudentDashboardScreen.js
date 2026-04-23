import { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, SafeAreaView, StatusBar, TextInput,
  KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";
import MoodCalendar from "../components/MoodCalendar";

/* ─── constants ────────────────────────────────────── */
const MOODS = [
  { key: "HAPPY",    emoji: "😊", label: "Happy",    gradient: ["#4ECDC4","#44A08D"], glow: "#4ECDC4", quote: "Your joy matters — let it fill every corner of your day. You deserve every bit of this happiness. Keep shining, the world is brighter with you in it! 🌟" },
  { key: "SAD",      emoji: "😢", label: "Sad",      gradient: ["#6C63FF","#9B59B6"], glow: "#6C63FF", quote: "It takes real strength to sit with hard feelings. You are not alone in this — every storm runs out of rain. Reaching out today is already an act of courage. 💙" },
  { key: "STRESSED", emoji: "😫", label: "Stressed", gradient: ["#F7971E","#FFD200"], glow: "#F7971E", quote: "You have survived 100% of your hardest days — that record stays perfect. Take one slow breath. You don't have to solve everything right now. You are enough. 🌿" },
  { key: "ANXIOUS",  emoji: "😰", label: "Anxious",  gradient: ["#FF6B6B","#FF8E53"], glow: "#FF6B6B", quote: "Right here, right now — you are safe. Anxiety is your mind trying to protect you, not predict the future. This wave will pass, and you will still be standing. 🌈" },
];

const STATUS_META = {
  PENDING: { label: "Pending",   color: "#F7971E", bg: "rgba(247,151,30,0.12)",  border: "rgba(247,151,30,0.35)" },
  ONGOING: { label: "Ongoing",   color: "#6C63FF", bg: "rgba(108,99,255,0.12)", border: "rgba(108,99,255,0.35)" },
  DONE:    { label: "Completed", color: "#4ECDC4", bg: "rgba(78,205,196,0.12)",  border: "rgba(78,205,196,0.35)" },
};

/* ─── helpers ──────────────────────────────────────── */
function relTime(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

/* ─── component ────────────────────────────────────── */
// step: "pick" | "note" | "dashboard" | "profile"
export default function StudentDashboardScreen({ navigation, route }) {
  const [step,         setStep]        = useState(route.params?.step || "dashboard");
  const [selectedMood, setSelectedMood]= useState(null);
  const [note,         setNote]        = useState("");
  const [userName,     setUserName]    = useState("");
  const [userEmail,    setUserEmail]   = useState("");
  const [userId,       setUserId]      = useState(null);
  const [appointment,  setAppt]        = useState(null);
  const [calKey,       setCalKey]      = useState(0);
  const [notifications,setNotifs]      = useState([]);
  const [showNotif,    setShowNotif]   = useState(false);

  // profile
  const [curPw,    setCurPw]    = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [conPw,    setConPw]    = useState("");
  const [pwLoad,   setPwLoad]   = useState(false);
  const [pwMsg,    setPwMsg]    = useState({ text:"", ok:false });

  // cancel + history
  const [history,    setHistory]    = useState([]);
  const [cancelMsg,  setCancelMsg]  = useState({ text:"", ok:false });

  // refs
  const prevApptRef   = useRef(null);
  const prevUnreadRef = useRef(0);
  const firstLoadRef  = useRef(true);

  // mood-pick animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const cardAnims = useRef(MOODS.map(() => new Animated.Value(0))).current;

  /* ─── trigger pick animation on initial load ── */
  useEffect(() => {
    if (step === "pick") animateIn();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── init ── */
  useEffect(() => {
    AsyncStorage.multiGet(["name","userId","email"]).then(pairs => {
      const map = Object.fromEntries(pairs);
      setUserName(map.name || "");
      setUserEmail(map.email || "");
      setUserId(map.userId || null);
    });
    fetchAppointment();
    fetchHistory();
    const iv1 = setInterval(fetchAppointment, 5000);
    const iv2 = setInterval(fetchUnread, 8000);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── notification helper ── */
  const addNotif = (message, type = "info") => {
    setNotifs(prev => [
      { id: Date.now() + Math.random(), message, type, time: new Date(), read: false },
      ...prev,
    ].slice(0, 15));
  };

  /* ─── fetch appointment (with diff) ── */
  const fetchAppointment = async () => {
    try {
      const res  = await API.get("/appointments/my");
      const d    = res.data;
      const appt = Array.isArray(d) ? (d[0] || null) : d;

      if (!firstLoadRef.current) {
        const prev = prevApptRef.current;
        if (!prev && appt) {
          addNotif("📋 An appointment has been scheduled for you.", "info");
        } else if (prev && appt) {
          if (prev.status !== appt.status) {
            const msgs = {
              PENDING: "⏳ Your appointment is pending — a counselor will confirm soon.",
              ONGOING: "🔄 Your session has started. You're not alone.",
              DONE:    "✅ Your counseling session has been completed.",
            };
            addNotif(msgs[appt.status] || `Appointment updated to ${appt.status}.`, "info");
          }
          const prevDate = prev.scheduleDate ? String(prev.scheduleDate) : null;
          const newDate  = appt.scheduleDate ? String(appt.scheduleDate) : null;
          if (newDate && prevDate !== newDate) {
            const dt = new Date(appt.scheduleDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
            addNotif(`📅 Your appointment has been scheduled for ${dt}.`, "info");
          }
        }
      }

      prevApptRef.current  = appt;
      firstLoadRef.current = false;
      setAppt(appt);
    } catch (e) { console.log(e); }
  };

  /* ─── fetch appointment history ── */
  const fetchHistory = async () => {
    try {
      const res = await API.get("/appointments/history");
      if (res.data.success) setHistory(res.data.appointments || []);
    } catch (e) { /* silent */ }
  };

  /* ─── cancel appointment ── */
  const handleCancelAppointment = async () => {
    if (!appointment?._id) return;
    setCancelMsg({ text:"", ok:false });
    try {
      const res = await API.patch(`/appointments/${appointment._id}/cancel`);
      if (res.data.success) {
        setCancelMsg({ text:"Appointment cancelled.", ok:true });
        fetchAppointment();
        fetchHistory();
      } else {
        setCancelMsg({ text: res.data.message || "Could not cancel.", ok:false });
      }
    } catch (e) {
      setCancelMsg({ text: e.response?.data?.message || "Error cancelling.", ok:false });
    }
  };

  /* ─── fetch unread chat messages ── */
  const fetchUnread = async () => {
    const uid = await AsyncStorage.getItem("userId");
    if (firstLoadRef.current || !uid) return;
    try {
      const res   = await API.get(`/messages/unread/${uid}`);
      const count = res.data.count || 0;
      if (count > prevUnreadRef.current) {
        addNotif("💬 You have a new message from your counselor.", "info");
      }
      prevUnreadRef.current = count;
    } catch (e) {}
  };

  /* ─── mood pick animations ── */
  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    cardAnims.forEach(a => a.setValue(0));
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(70, cardAnims.map(a =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 })
      )).start();
    });
  };

  const handleTrackMood = () => {
    setStep("pick");
    animateIn();
  };

  const handleMoodPress = (mood) => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 6, useNativeDriver: true }).start();
    setSelectedMood(mood);
    setStep("note");
  };

  const handleSave = async () => {
    try { await API.post("/moods", { mood: selectedMood.key, note }); }
    catch (e) { console.log(e); }
    setCalKey(k => k + 1);
    setNote("");
    setSelectedMood(null);
    setStep("dashboard");
  };

  /* ─── logout ── */
  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["token","role","userId","name","email"]);
    navigation.replace("Login");
  };

  /* ─── change password ── */
  const handleChangePassword = async () => {
    if (!curPw || !newPw || !conPw) { setPwMsg({ text:"Please fill in all fields.", ok:false }); return; }
    if (newPw !== conPw)            { setPwMsg({ text:"New passwords do not match.", ok:false }); return; }
    if (newPw.length < 6)           { setPwMsg({ text:"Password must be at least 6 characters.", ok:false }); return; }
    try {
      setPwLoad(true); setPwMsg({ text:"", ok:false });
      const res = await API.patch("/auth/change-password", { currentPassword: curPw, newPassword: newPw });
      if (res.data.success) {
        setPwMsg({ text:"Password changed successfully!", ok:true });
        setCurPw(""); setNewPw(""); setConPw("");
      } else {
        setPwMsg({ text: res.data.message || "Please try again.", ok:false });
      }
    } catch (e) {
      setPwMsg({ text: e.response?.data?.message || "Something went wrong.", ok:false });
    } finally { setPwLoad(false); }
  };

  /* ─── derived ── */
  const firstName   = userName ? userName.split(" ")[0] : "there";
  const apptMeta    = appointment?.status ? STATUS_META[appointment.status] : null;
  const unreadCount = notifications.filter(n => !n.read).length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */

  /* ── DASHBOARD ── */
  if (step === "dashboard") {
    return (
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={["#1a1a2e","#16213e","#0f3460"]} style={s.page}>
          <View style={[s.blob, { width:300, height:300, top:-80, right:-80 }]} />
          <View style={[s.blob, { width:200, height:200, bottom:120, left:-60, opacity:0.07 }]} />

          <SafeAreaView style={{ flex:1 }}>
            <ScrollView
              contentContainerStyle={s.dashContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={s.dashHeader}>
                <View style={{ flex:1 }}>
                  <Text style={s.dashTitle}>Your Dashboard</Text>
                  <Text style={s.dashSub}>Track your mood and appointments</Text>
                </View>

                <View style={s.dashHeaderBtns}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("Chat")}
                    style={s.headerChatBtn}
                    activeOpacity={0.85}
                  >
                    <Text style={s.headerChatBtnText}>💬 Chat Counselor</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setStep("profile")}
                    style={s.headerProfileBtn}
                    activeOpacity={0.85}
                  >
                    <Text style={s.headerProfileBtnText}>👤 Profile</Text>
                  </TouchableOpacity>

                  {/* Bell */}
                  <TouchableOpacity
                    onPress={() => {
                      setShowNotif(true);
                      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
                    }}
                    style={s.bellBtn}
                  >
                    <Text style={{ fontSize:18 }}>🔔</Text>
                    {unreadCount > 0 && (
                      <View style={s.bellBadge}>
                        <Text style={s.bellBadgeText}>{unreadCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Mood calendar */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>MOOD CALENDAR</Text>
                <MoodCalendar key={calKey} />
              </View>

              {/* Appointment card */}
              <View style={s.section}>
                <Text style={s.sectionLabel}>APPOINTMENT</Text>
                {appointment && apptMeta ? (
                  <View style={[s.apptCard, { backgroundColor: apptMeta.bg, borderColor: apptMeta.border }]}>
                    <View style={s.apptRow}>
                      <Text style={s.apptKey}>Status</Text>
                      <View style={[s.statusBadge, { backgroundColor: apptMeta.color + "22" }]}>
                        <Text style={[s.statusText, { color: apptMeta.color }]}>{apptMeta.label}</Text>
                      </View>
                    </View>
                    <View style={s.apptRow}>
                      <Text style={s.apptKey}>Counselor</Text>
                      <Text style={s.apptVal}>{appointment.assignedTo || "—"}</Text>
                    </View>
                    <View style={s.apptRow}>
                      <Text style={s.apptKey}>Severity</Text>
                      <Text style={[s.apptVal, { fontWeight:"700" }]}>{appointment.severity}</Text>
                    </View>
                    {appointment.scheduleDate && (
                      <View style={[s.apptRow, { borderBottomWidth:0 }]}>
                        <Text style={s.apptKey}>Scheduled</Text>
                        <Text style={[s.apptVal, { color: "#4ECDC4", fontWeight:"600" }]}>
                          {new Date(appointment.scheduleDate).toLocaleString("en-US",{ dateStyle:"medium", timeStyle:"short" })}
                        </Text>
                      </View>
                    )}
                    {appointment.status === "PENDING" && (
                      <View style={{ paddingTop:12 }}>
                        {!!cancelMsg.text && (
                          <Text style={{ color: cancelMsg.ok ? "#4ECDC4" : "#F87171", fontSize:13, fontWeight:"600", textAlign:"center", marginBottom:8 }}>
                            {cancelMsg.text}
                          </Text>
                        )}
                        <TouchableOpacity onPress={handleCancelAppointment} style={s.cancelApptBtn}>
                          <Text style={s.cancelApptBtnText}>✕ Cancel Appointment</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={s.noAppt}>
                    <Text style={{ fontSize:28, marginBottom:8 }}>📋</Text>
                    <Text style={s.noApptText}>No appointment scheduled yet</Text>
                    <Text style={s.noApptSub}>Complete your mood check-in to get started</Text>
                  </View>
                )}
              </View>

              {/* Appointment history */}
              {history.length > 1 && (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>APPOINTMENT HISTORY</Text>
                  {history.map((h, i) => {
                    const colors = { PENDING:"#F7971E", ONGOING:"#6C63FF", DONE:"#4ECDC4", CANCELLED:"#9CA3AF" };
                    const c = colors[h.status] || "#9CA3AF";
                    return (
                      <View key={h._id || i} style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", paddingVertical:10, borderBottomWidth: i < history.length-1 ? 1 : 0, borderBottomColor:"rgba(255,255,255,0.06)" }}>
                        <View>
                          <Text style={{ fontSize:12, color:c, fontWeight:"700" }}>{h.status}</Text>
                          <Text style={{ fontSize:11, color:"rgba(255,255,255,0.38)", marginTop:2 }}>
                            {h.scheduleDate ? new Date(h.scheduleDate).toLocaleDateString("en-US",{ month:"short", day:"numeric", year:"numeric" }) : "Not scheduled"}
                          </Text>
                        </View>
                        <Text style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{h.severity}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Action buttons */}
              <View style={s.btnRow}>
                <TouchableOpacity onPress={handleTrackMood} activeOpacity={0.85} style={{ flex:1 }}>
                  <LinearGradient colors={["#6C63FF","#764ba2"]} style={s.trackMoodBtn}>
                    <Text style={s.trackMoodBtnText}>➕ Track Mood</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate("Chat")} activeOpacity={0.85} style={{ flex:1 }}>
                  <View style={s.chatCounselorBtn}>
                    <Text style={s.chatCounselorBtnText}>💬 Chat Counselor</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Ad Banner */}
              <View style={s.adCard}>
                <Image
                  source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/4/48/Cabanatuan_garlic_longganisa6.jpg" }}
                  style={s.adImg}
                  resizeMode="cover"
                />
                <View style={s.adContent}>
                  <Text style={s.adTag}>Featured Local Product 🇵🇭</Text>
                  <Text style={s.adTitle}>Cabanatuan Garlic Longganisa</Text>
                  <Text style={s.adDesc}>
                    Nueva Ecija's pride — sweet, garlicky, and bursting with flavor.
                    The perfect breakfast treat to brighten your morning! 🧄🌟
                  </Text>
                  <Text style={s.adCta}>Order now at your local market →</Text>
                </View>
              </View>

              {/* Logout */}
              <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
                <Text style={s.logoutText}>Sign out</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>

        {/* Notification Modal */}
        <Modal
          visible={showNotif}
          transparent
          animationType="slide"
          onRequestClose={() => setShowNotif(false)}
        >
          <TouchableOpacity
            style={s.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowNotif(false)}
          />
          <View style={s.notifSheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Notifications</Text>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={() => setNotifs([])}>
                  <Text style={s.sheetClear}>Clear all</Text>
                </TouchableOpacity>
              )}
            </View>

            {notifications.length === 0 ? (
              <View style={s.notifEmpty}>
                <Text style={{ fontSize:36, marginBottom:10 }}>🔔</Text>
                <Text style={s.notifEmptyText}>No notifications yet</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight:340 }} showsVerticalScrollIndicator={false}>
                {notifications.map(n => (
                  <View
                    key={n.id}
                    style={[
                      s.notifItem,
                      { borderLeftColor: n.type === "danger" ? "#F87171" : "#4ECDC4", opacity: n.read ? 0.65 : 1 },
                    ]}
                  >
                    <Text style={s.notifMsg}>{n.message}</Text>
                    <Text style={s.notifTime}>{relTime(n.time)}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Modal>
      </View>
    );
  }

  /* ── PICK MOOD ── */
  if (step === "pick") {
    return (
      <View style={{ flex:1 }}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={["#1a1a2e","#16213e","#0f3460"]} style={s.page}>
          <View style={[s.blob, { width:280, height:280, top:-80, right:-60, opacity:0.12 }]} />
          <View style={[s.blob, { width:200, height:200, bottom:100, left:-50, opacity:0.08 }]} />

          <SafeAreaView style={{ flex:1 }}>
            <ScrollView contentContainerStyle={s.pickContent} showsVerticalScrollIndicator={false}>
              <Animated.View style={{ opacity: fadeAnim, transform:[{ translateY: slideAnim }] }}>
                <View style={s.topRow}>
                  <TouchableOpacity onPress={() => setStep("dashboard")} style={s.backCircle}>
                    <Text style={s.backCircleText}>←</Text>
                  </TouchableOpacity>
                  <View style={{ flex:1, marginLeft:12 }}>
                    <Text style={s.greeting2}>How are you feeling?</Text>
                    <Text style={s.dateText}>
                      {new Date().toLocaleDateString("en-US",{ weekday:"long", month:"long", day:"numeric" })}
                    </Text>
                  </View>
                </View>

                <View style={s.heroWrap}>
                  <Text style={s.heroEmoji}>💙</Text>
                  <Text style={s.heroTitle}>Check in with{"\n"}yourself today</Text>
                  <Text style={s.heroSub}>Your feelings matter. Tap a mood to continue.</Text>
                </View>
              </Animated.View>

              <View style={s.moodGrid}>
                {MOODS.map((mood, i) => (
                  <Animated.View
                    key={mood.key}
                    style={{
                      opacity: cardAnims[i],
                      transform:[
                        { scale: cardAnims[i] },
                        { translateY: cardAnims[i].interpolate({ inputRange:[0,1], outputRange:[20,0] }) },
                      ],
                      width: "47%",
                    }}
                  >
                    <TouchableOpacity onPress={() => handleMoodPress(mood)} activeOpacity={0.88} style={s.moodCardTouch}>
                      <LinearGradient colors={mood.gradient} start={{x:0,y:0}} end={{x:1,y:1}} style={s.moodCard}>
                        <View style={s.cardShine} />
                        <Text style={s.moodEmoji}>{mood.emoji}</Text>
                        <Text style={s.moodLabel}>{mood.label}</Text>
                        <View style={s.moodArrow}><Text style={s.moodArrowText}>→</Text></View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>

              <Animated.View style={{ opacity: fadeAnim, alignItems:"center", marginTop:8, marginBottom:20 }}>
                <Text style={s.hint}>Tap a mood to continue</Text>
              </Animated.View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  /* ── NOTE STEP ── */
  if (step === "note" && selectedMood) {
    return (
      <View style={{ flex:1 }}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={selectedMood.gradient} style={s.page}>
          <View style={[s.blob, { width:300, height:300, top:-100, right:-80, opacity:0.15 }]} />
          <View style={[s.blob, { width:220, height:220, bottom:80, left:-60, opacity:0.1 }]} />

          <SafeAreaView style={{ flex:1 }}>
            <ScrollView
              contentContainerStyle={s.noteContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity onPress={() => setStep("pick")} style={s.backBtn}>
                <Text style={s.backBtnText}>← Back</Text>
              </TouchableOpacity>

              <Animated.View style={{ alignItems:"center", transform:[{ scale: scaleAnim }] }}>
                <View style={s.bigEmojiWrap}>
                  <Text style={s.bigEmoji}>{selectedMood.emoji}</Text>
                </View>
                <Text style={s.noteYouFeel}>You're feeling</Text>
                <Text style={s.noteMoodLabel}>{selectedMood.label}</Text>
              </Animated.View>

              {/* Affirmation card */}
              <View style={s.affirmCard}>
                <View style={s.affirmTopRow}>
                  <Text style={s.affirmIcon}>💬</Text>
                  <Text style={s.affirmTag}>A message for you</Text>
                </View>
                <Text style={s.affirmQuote}>{selectedMood.quote}</Text>
                <View style={s.affirmDivider} />
                <Text style={s.affirmSub}>
                  Your feelings are valid. You're doing better than you think. 🌱
                </Text>
              </View>

              {/* Note group */}
              <View style={s.noteSection}>
                <View style={s.noteGroupHeader}>
                  <Text style={s.noteSectionTitle}>📝 Add a note</Text>
                  <View style={s.privacyBadge}>
                    <Text style={s.privacyBadgeText}>🔒 Private</Text>
                  </View>
                </View>
                <Text style={s.noteSectionSub}>Share what's on your mind — only you can see this</Text>
                <View style={s.noteInputWrap}>
                  <TextInput
                    placeholder="e.g. I had a tough day, but I kept going…"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={note}
                    onChangeText={t => setNote(t.slice(0,200))}
                    multiline
                    maxLength={200}
                    style={s.noteInput}
                  />
                  <View style={s.charCount}>
                    <Text style={s.charCountText}>{note.length}/200</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity onPress={handleSave} activeOpacity={0.88} style={s.saveBtn}>
                <View style={s.saveBtnInner}>
                  <Text style={s.saveBtnText}>Save & Continue →</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSave} style={s.skipBtn}>
                <Text style={s.skipBtnText}>Skip for now</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  /* ── PROFILE ── */
  if (step === "profile") {
    return (
      <View style={{ flex:1 }}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={["#1a1a2e","#16213e","#0f3460"]} style={s.page}>
          <View style={[s.blob, { width:280, height:280, top:-80, right:-60, opacity:0.1 }]} />

          <SafeAreaView style={{ flex:1 }}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex:1 }}
            >
              <ScrollView
                contentContainerStyle={s.profileContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Header */}
                <View style={s.topRow}>
                  <TouchableOpacity onPress={() => setStep("dashboard")} style={s.backCircle}>
                    <Text style={s.backCircleText}>←</Text>
                  </TouchableOpacity>
                  <Text style={[s.greeting2, { marginLeft:12 }]}>Profile</Text>
                </View>

                {/* Avatar */}
                <View style={s.avatarWrap}>
                  <LinearGradient colors={["#6C63FF","#764ba2"]} style={s.avatarCircle}>
                    <Text style={s.avatarLetter}>{userName ? userName.charAt(0).toUpperCase() : "?"}</Text>
                  </LinearGradient>
                  <Text style={s.profileName}>{userName}</Text>
                  {userEmail ? <Text style={s.profileEmail}>{userEmail}</Text> : null}
                  <View style={s.roleBadge}>
                    <Text style={s.roleBadgeText}>🎓 Student</Text>
                  </View>
                </View>

                {/* Change password */}
                <View style={s.profileCard}>
                  <Text style={s.profileCardTitle}>Change Password</Text>

                  {[
                    { label:"Current Password", val:curPw, set:setCurPw },
                    { label:"New Password",     val:newPw, set:setNewPw },
                    { label:"Confirm Password", val:conPw, set:setConPw },
                  ].map((f, i) => (
                    <View key={i} style={s.pwGroup}>
                      <Text style={s.pwLabel}>{f.label.toUpperCase()}</Text>
                      <TextInput
                        placeholder="••••••••"
                        placeholderTextColor="#9CA3AF"
                        value={f.val}
                        onChangeText={f.set}
                        secureTextEntry
                        style={s.pwInput}
                      />
                    </View>
                  ))}

                  {!!pwMsg.text && (
                    <Text style={{ color: pwMsg.ok ? "#4ECDC4" : "#F87171", fontSize:13, fontWeight:"600", textAlign:"center", marginBottom:8 }}>
                      {pwMsg.text}
                    </Text>
                  )}

                  <TouchableOpacity
                    onPress={handleChangePassword}
                    disabled={pwLoad}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={["#6C63FF","#764ba2"]} style={[s.pwBtn, pwLoad && { opacity:0.7 }]}>
                      {pwLoad
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={s.pwBtnText}>Update Password</Text>
                      }
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Logout */}
                <TouchableOpacity onPress={handleLogout} style={s.logoutBtnLg}>
                  <Text style={s.logoutLgText}>🚪 Sign out</Text>
                </TouchableOpacity>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  return null;
}

/* ─── styles ────────────────────────────────────────── */
const s = StyleSheet.create({
  page: { flex:1, overflow:"hidden" },
  blob: { position:"absolute", borderRadius:999, backgroundColor:"#6C63FF", opacity:0.1 },

  /* ── Dashboard ── */
  dashContent: { paddingHorizontal:22, paddingTop:16, paddingBottom:40 },
  dashHeader: {
    flexDirection:"row", alignItems:"flex-start",
    marginBottom:24, flexWrap:"wrap", gap:10,
  },
  dashTitle: { fontSize:22, fontWeight:"800", color:"#fff", letterSpacing:-0.4 },
  dashSub: { fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:2 },

  dashHeaderBtns: {
    flexDirection:"row", alignItems:"center", gap:6, flexShrink:0, marginTop:4,
  },
  headerChatBtn: {
    backgroundColor:"rgba(108,99,255,0.85)",
    borderRadius:99, paddingHorizontal:12, paddingVertical:7,
    borderWidth:1, borderColor:"rgba(108,99,255,0.5)",
  },
  headerChatBtnText: { color:"#fff", fontSize:11, fontWeight:"700" },
  headerProfileBtn: {
    backgroundColor:"rgba(255,255,255,0.1)",
    borderRadius:99, paddingHorizontal:12, paddingVertical:7,
    borderWidth:1, borderColor:"rgba(255,255,255,0.18)",
  },
  headerProfileBtnText: { color:"rgba(255,255,255,0.75)", fontSize:11, fontWeight:"700" },

  bellBtn: {
    width:34, height:34, borderRadius:17,
    backgroundColor:"rgba(255,255,255,0.08)",
    borderWidth:1, borderColor:"rgba(255,255,255,0.15)",
    justifyContent:"center", alignItems:"center",
    position:"relative",
  },
  bellBadge: {
    position:"absolute", top:-3, right:-3,
    backgroundColor:"#F87171",
    borderRadius:99, minWidth:16, height:16,
    justifyContent:"center", alignItems:"center",
    paddingHorizontal:3,
    borderWidth:1.5, borderColor:"#16213e",
  },
  bellBadgeText: { color:"#fff", fontSize:8, fontWeight:"800" },

  section: { marginBottom:20 },
  sectionLabel: {
    fontSize:10, fontWeight:"800", color:"rgba(255,255,255,0.4)",
    letterSpacing:1.2, textTransform:"uppercase", marginBottom:10,
  },

  apptCard: {
    borderRadius:20, borderWidth:1.5, overflow:"hidden",
  },
  apptRow: {
    flexDirection:"row", justifyContent:"space-between", alignItems:"center",
    paddingHorizontal:16, paddingVertical:13,
    borderBottomWidth:1, borderBottomColor:"rgba(255,255,255,0.07)",
  },
  apptKey: { fontSize:13, color:"rgba(255,255,255,0.5)", fontWeight:"600" },
  apptVal: { fontSize:13, color:"#fff", fontWeight:"500", textAlign:"right", flex:1, marginLeft:12 },
  statusBadge: { borderRadius:99, paddingHorizontal:12, paddingVertical:4 },
  statusText: { fontSize:12, fontWeight:"700" },

  noAppt: {
    backgroundColor:"rgba(255,255,255,0.05)",
    borderRadius:20, padding:24, alignItems:"center",
    borderWidth:1, borderColor:"rgba(255,255,255,0.08)",
  },
  noApptText: { fontSize:15, color:"rgba(255,255,255,0.6)", fontWeight:"600" },
  noApptSub: { fontSize:12, color:"rgba(255,255,255,0.3)", marginTop:4, textAlign:"center" },
  cancelApptBtn: { borderWidth:1.5, borderColor:"rgba(248,113,113,0.4)", borderRadius:10, paddingVertical:10, alignItems:"center" },
  cancelApptBtnText: { color:"#F87171", fontSize:13, fontWeight:"700" },

  btnRow: { flexDirection:"row", gap:10, marginBottom:20 },
  trackMoodBtn: {
    borderRadius:14, paddingVertical:16, alignItems:"center",
    shadowColor:"#6C63FF", shadowOffset:{width:0,height:6},
    shadowOpacity:0.35, shadowRadius:12, elevation:6,
  },
  trackMoodBtnText: { color:"#fff", fontSize:14, fontWeight:"700" },
  chatCounselorBtn: {
    borderRadius:14, paddingVertical:16, alignItems:"center",
    backgroundColor:"rgba(255,255,255,0.08)",
    borderWidth:1.5, borderColor:"rgba(255,255,255,0.18)",
  },
  chatCounselorBtnText: { color:"rgba(255,255,255,0.8)", fontSize:14, fontWeight:"700" },

  logoutBtn: {
    alignItems:"center", paddingVertical:14,
    borderRadius:14, borderWidth:1,
    borderColor:"rgba(255,255,255,0.12)",
    backgroundColor:"rgba(255,255,255,0.04)",
  },
  logoutText: { fontSize:14, color:"rgba(255,255,255,0.4)", fontWeight:"600" },

  /* ── Notification Modal ── */
  modalOverlay: {
    flex:1, backgroundColor:"rgba(0,0,0,0.55)",
  },
  notifSheet: {
    backgroundColor:"#1E2037",
    borderTopLeftRadius:28, borderTopRightRadius:28,
    paddingBottom:Platform.OS === "ios" ? 34 : 20,
    paddingHorizontal:20,
    paddingTop:12,
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
  sheetClear: { fontSize:12, color:"rgba(255,255,255,0.4)", fontWeight:"600" },
  notifEmpty: { alignItems:"center", paddingVertical:32 },
  notifEmptyText: { fontSize:14, color:"rgba(255,255,255,0.35)", fontWeight:"600" },
  notifItem: {
    paddingVertical:12, paddingHorizontal:14,
    borderLeftWidth:3,
    backgroundColor:"rgba(255,255,255,0.04)",
    borderRadius:12,
    marginBottom:8,
  },
  notifMsg: { fontSize:13, color:"rgba(255,255,255,0.85)", lineHeight:19 },
  notifTime: { fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:4 },

  /* ── Pick mood ── */
  pickContent: { paddingHorizontal:22, paddingTop:16, paddingBottom:32 },
  topRow: { flexDirection:"row", alignItems:"center", marginBottom:28 },
  backCircle: {
    width:40, height:40, borderRadius:20,
    backgroundColor:"rgba(255,255,255,0.1)",
    justifyContent:"center", alignItems:"center",
    borderWidth:1, borderColor:"rgba(255,255,255,0.15)",
  },
  backCircleText: { color:"#fff", fontSize:18, fontWeight:"700" },
  greeting2: { fontSize:20, fontWeight:"800", color:"#fff", letterSpacing:-0.3 },
  dateText: { fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:2 },
  heroWrap: { alignItems:"center", marginBottom:32 },
  heroEmoji: { fontSize:52, marginBottom:14 },
  heroTitle: { fontSize:30, fontWeight:"800", color:"#fff", textAlign:"center", lineHeight:38, letterSpacing:-0.5, marginBottom:10 },
  heroSub: { fontSize:14, color:"rgba(255,255,255,0.5)", textAlign:"center", lineHeight:21 },
  moodGrid: { flexDirection:"row", flexWrap:"wrap", justifyContent:"space-between", gap:14 },
  moodCardTouch: { borderRadius:24, shadowColor:"#000", shadowOffset:{width:0,height:10}, shadowOpacity:0.3, shadowRadius:18, elevation:10 },
  moodCard: { borderRadius:24, padding:22, height:156, justifyContent:"space-between", overflow:"hidden" },
  cardShine: { position:"absolute", top:-28, right:-28, width:80, height:80, borderRadius:40, backgroundColor:"rgba(255,255,255,0.12)" },
  moodEmoji: { fontSize:44 },
  moodLabel: { fontSize:18, fontWeight:"800", color:"#fff", letterSpacing:-0.3 },
  moodArrow: { alignSelf:"flex-end", width:26, height:26, borderRadius:13, backgroundColor:"rgba(255,255,255,0.25)", justifyContent:"center", alignItems:"center" },
  moodArrowText: { color:"#fff", fontSize:14, fontWeight:"700" },
  hint: { color:"rgba(255,255,255,0.3)", fontSize:12, fontWeight:"500", letterSpacing:0.5 },

  /* ── Note step ── */
  noteContent: { paddingHorizontal:24, paddingTop:20, paddingBottom:48 },
  backBtn: { alignSelf:"flex-start", paddingVertical:8, paddingHorizontal:4, marginBottom:20 },
  backBtnText: { color:"rgba(255,255,255,0.75)", fontSize:15, fontWeight:"600" },
  bigEmojiWrap: { width:120, height:120, borderRadius:60, backgroundColor:"rgba(255,255,255,0.2)", justifyContent:"center", alignItems:"center", marginBottom:14, borderWidth:2, borderColor:"rgba(255,255,255,0.3)" },
  bigEmoji: { fontSize:58 },
  noteMoodLabel: { fontSize:26, fontWeight:"800", color:"#fff", marginBottom:22, letterSpacing:-0.4 },
  quoteCard: { backgroundColor:"rgba(0,0,0,0.18)", borderRadius:20, padding:20, marginBottom:28, borderWidth:1, borderColor:"rgba(255,255,255,0.15)" },
  quoteIcon: { fontSize:26, color:"rgba(255,255,255,0.35)", marginBottom:4, fontStyle:"italic" },
  quoteText: { fontSize:15, color:"rgba(255,255,255,0.88)", lineHeight:23, fontStyle:"italic" },
  noteSection: { marginBottom:28 },
  noteSectionTitle: { fontSize:18, fontWeight:"700", color:"#fff", marginBottom:4 },
  noteSectionSub: { fontSize:13, color:"rgba(255,255,255,0.5)", marginBottom:14 },
  noteInputWrap: { backgroundColor:"rgba(0,0,0,0.2)", borderRadius:18, borderWidth:1.5, borderColor:"rgba(255,255,255,0.2)", overflow:"hidden" },
  noteInput: { color:"#fff", fontSize:15, padding:16, minHeight:110, textAlignVertical:"top", lineHeight:22 },
  charCount: { alignItems:"flex-end", paddingRight:14, paddingBottom:10 },
  charCountText: { fontSize:11, color:"rgba(255,255,255,0.35)" },
  saveBtn: { marginBottom:14, borderRadius:18, overflow:"hidden", shadowColor:"#000", shadowOffset:{width:0,height:8}, shadowOpacity:0.25, shadowRadius:16, elevation:8 },
  saveBtnInner: { backgroundColor:"rgba(255,255,255,0.95)", paddingVertical:18, alignItems:"center", borderRadius:18 },
  saveBtnText: { fontSize:16, fontWeight:"800", color:"#1A1A2E", letterSpacing:0.2 },
  skipBtn: { alignItems:"center", paddingVertical:10 },
  skipBtnText: { color:"rgba(255,255,255,0.45)", fontSize:13, fontWeight:"500" },

  /* ── Profile ── */
  profileContent: { paddingHorizontal:22, paddingTop:16, paddingBottom:48 },
  avatarWrap: { alignItems:"center", marginBottom:28, marginTop:8 },
  avatarCircle: { width:80, height:80, borderRadius:40, justifyContent:"center", alignItems:"center", marginBottom:12 },
  avatarLetter: { fontSize:34, fontWeight:"800", color:"#fff" },
  profileName: { fontSize:20, fontWeight:"800", color:"#fff", letterSpacing:-0.3 },
  profileCard: {
    backgroundColor:"rgba(255,255,255,0.06)",
    borderRadius:22, padding:20,
    borderWidth:1, borderColor:"rgba(255,255,255,0.1)",
    marginBottom:16,
  },
  profileCardTitle: { fontSize:16, fontWeight:"700", color:"#fff", marginBottom:18, letterSpacing:-0.2 },
  pwGroup: { marginBottom:14 },
  pwLabel: { fontSize:10, fontWeight:"700", color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:7 },
  pwInput: {
    backgroundColor:"rgba(255,255,255,0.08)",
    borderRadius:14, borderWidth:1.5, borderColor:"rgba(255,255,255,0.12)",
    paddingHorizontal:16,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize:15, color:"#fff",
  },
  pwBtn: { borderRadius:14, paddingVertical:16, alignItems:"center", marginTop:4, shadowColor:"#6C63FF", shadowOffset:{width:0,height:6}, shadowOpacity:0.3, shadowRadius:12, elevation:5 },
  pwBtnText: { color:"#fff", fontSize:15, fontWeight:"700" },
  logoutBtnLg: {
    borderRadius:16, paddingVertical:16, alignItems:"center",
    backgroundColor:"rgba(248,113,113,0.1)",
    borderWidth:1, borderColor:"rgba(248,113,113,0.25)",
  },
  logoutLgText: { fontSize:15, fontWeight:"700", color:"#F87171" },

  /* ── Profile extras ── */
  profileEmail: { fontSize:13, color:"rgba(255,255,255,0.45)", marginTop:4 },
  roleBadge: {
    marginTop:8, backgroundColor:"rgba(108,99,255,0.25)",
    borderRadius:99, paddingHorizontal:14, paddingVertical:5,
    borderWidth:1, borderColor:"rgba(108,99,255,0.4)",
  },
  roleBadgeText: { fontSize:12, color:"#A78BFA", fontWeight:"700" },

  /* ── Note affirmation card ── */
  noteYouFeel: { fontSize:14, color:"rgba(255,255,255,0.65)", marginBottom:4, fontWeight:"500" },
  affirmCard: {
    backgroundColor:"rgba(0,0,0,0.18)", borderRadius:20, padding:18,
    marginBottom:22, borderWidth:1, borderColor:"rgba(255,255,255,0.15)",
  },
  affirmTopRow: { flexDirection:"row", alignItems:"center", gap:8, marginBottom:10 },
  affirmIcon: { fontSize:18 },
  affirmTag: { fontSize:12, fontWeight:"700", color:"rgba(255,255,255,0.7)", letterSpacing:0.3 },
  affirmQuote: { fontSize:14, color:"rgba(255,255,255,0.88)", lineHeight:22, fontStyle:"italic", marginBottom:12 },
  affirmDivider: { height:1, backgroundColor:"rgba(255,255,255,0.12)", marginBottom:10 },
  affirmSub: { fontSize:12, color:"rgba(255,255,255,0.6)", lineHeight:18 },

  noteGroupHeader: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:4 },
  privacyBadge: {
    backgroundColor:"rgba(0,0,0,0.22)", borderRadius:99,
    paddingHorizontal:10, paddingVertical:3,
    borderWidth:1, borderColor:"rgba(255,255,255,0.15)",
  },
  privacyBadgeText: { fontSize:11, color:"rgba(255,255,255,0.55)", fontWeight:"600" },

  /* ── Ad banner ── */
  adCard: {
    borderRadius:20, overflow:"hidden",
    backgroundColor:"rgba(255,255,255,0.06)",
    borderWidth:1, borderColor:"rgba(255,255,255,0.1)",
    marginBottom:20,
  },
  adImg: { width:"100%", height:160 },
  adContent: { padding:16 },
  adTag: { fontSize:10, fontWeight:"700", color:"#F7971E", letterSpacing:1, textTransform:"uppercase", marginBottom:6 },
  adTitle: { fontSize:16, fontWeight:"800", color:"#fff", marginBottom:6, letterSpacing:-0.3 },
  adDesc: { fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:20, marginBottom:8 },
  adCta: { fontSize:12, fontWeight:"700", color:"#4ECDC4" },
});
