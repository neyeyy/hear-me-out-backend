import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import API from "../services/api";

const socket = io(process.env.REACT_APP_SOCKET_URL || "https://hear-me-out-backend-production-8100.up.railway.app", {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

function Chat() {
  const navigate  = useNavigate();
  const userId    = localStorage.getItem("userId");
  const role      = localStorage.getItem("role");
  const isStudent = role === "student";

  // ── Sidebar state (counselor only) ──────────────────────────
  const [conversations, setConversations] = useState([]);
  const [searchQuery,   setSearchQuery]   = useState("");

  // ── Active chat state ────────────────────────────────────────
  const [activeRoom,    setActiveRoom]    = useState(isStudent ? userId : null);
  const [activeStudent, setActiveStudent] = useState(null);
  const [messages,      setMessages]      = useState([]);
  const [message,       setMessage]       = useState("");
  const [isTyping,      setIsTyping]      = useState(false);

  const messagesEndRef   = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeRoomRef    = useRef(activeRoom);
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  // ── Automated system notices → one-click action buttons ──
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduledIds, setRescheduledIds] = useState(new Set());

  // Recognize the two automated notices and what action/label each takes
  const getSystemAction = (msg) => {
    if (msg.senderId !== "system") return null;
    const text = msg.message || "";
    if (text.startsWith("You missed your schedule")) {
      return { type: "missed", label: "📅 Reschedule Appointment" };
    }
    if (text.startsWith("Hello, we have a vacant schedule today")) {
      return { type: "vacancy", endpoint: "/appointments/accept-vacancy", label: "✅ Yes, move me to today" };
    }
    return null;
  };

  const handleSystemAction = async (msg, endpoint) => {
    if (reschedulingId) return;
    setReschedulingId(msg._id);
    try {
      const res = await API.post(endpoint);
      const confirmText = res.data.success && res.data.appointment?.scheduleDate
        ? `✅ New appointment scheduled: ${new Date(res.data.appointment.scheduleDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
        : (res.data.message || "Could not schedule an appointment right now.");
      socket.emit("sendMessage", {
        roomId:   String(activeRoom),
        senderId: String(userId),
        message:  confirmText,
      });
      setRescheduledIds(prev => new Set(prev).add(msg._id));
    } catch (e) {
      console.log("System action error:", e);
    } finally {
      setReschedulingId(null);
    }
  };

  // ── Calendar-based reschedule (opened from the "missed schedule" notice) ──
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [schedTargetMsg, setSchedTargetMsg] = useState(null);
  const [schedDate,      setSchedDate]      = useState("");
  const [schedMonth,     setSchedMonth]     = useState(new Date());
  const [schedSlots,     setSchedSlots]     = useState([]);
  const [schedTime,      setSchedTime]      = useState("");
  const [schedLoading,   setSchedLoading]   = useState(false);
  const [schedErr,       setSchedErr]       = useState("");

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

  const openScheduleModal = (msg) => {
    let d = startOfToday();
    while (!isSelectableDay(d)) d = new Date(d.getTime() + 86400000);
    const firstDay = toDateStr(d);
    setSchedTargetMsg(msg);
    setSchedErr("");
    setSchedMonth(d);
    setSchedDate(firstDay);
    setSchedModalOpen(true);
    fetchSlotsForDate(firstDay);
  };

  const handleConfirmSchedule = async () => {
    if (!schedDate || !schedTime) return;
    setReschedulingId(schedTargetMsg?._id);
    setSchedErr("");
    try {
      const dt = new Date(`${schedDate}T${schedTime}:00`);
      const res = await API.post("/appointments", { scheduleDate: dt });
      if (res.data.success) {
        const confirmText = res.data.appointment?.scheduleDate
          ? `✅ New appointment scheduled: ${new Date(res.data.appointment.scheduleDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
          : "✅ Appointment scheduled!";
        socket.emit("sendMessage", { roomId: String(activeRoom), senderId: String(userId), message: confirmText });
        if (schedTargetMsg) setRescheduledIds(prev => new Set(prev).add(schedTargetMsg._id));
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

  // ── Load conversations for counselor sidebar ─────────────────
  const loadConversations = useCallback(async () => {
    if (isStudent) return;
    try {
      const res = await API.get("/messages/conversations");
      setConversations(res.data || []);
    } catch (e) {
      console.log("Conversations error:", e);
    }
  }, [isStudent]);

  // Initial load + poll every 15 s so unread counts stay fresh
  useEffect(() => {
    loadConversations();
    if (!isStudent) {
      const timer = setInterval(loadConversations, 15000);
      return () => clearInterval(timer);
    }
  }, [loadConversations, isStudent]);

  // Auto-select first conversation once sidebar is populated
  useEffect(() => {
    if (!isStudent && !activeRoom && conversations.length > 0) {
      const first = conversations[0];
      setActiveRoom(first.roomId);
      setActiveStudent(first);
    }
  }, [conversations, isStudent, activeRoom]);

  // ── Socket listeners ─────────────────────────────────────────
  useEffect(() => {
    if (!activeRoom) return;

    socket.emit("joinRoom", activeRoom);

    // Re-join room on reconnect so messages resume automatically
    const onReconnect = () => {
      socket.emit("joinRoom", String(activeRoomRef.current));
    };
    socket.on("connect", onReconnect);

    const onLoad = (data) => {
      setMessages(data);
      const hasUnseen = data.some(
        (m) => !m.seen && String(m.senderId) !== String(userId)
      );
      if (hasUnseen) {
        socket.emit("markSeen", {
          roomId: String(activeRoom),
          userId: String(userId),
        });
        if (!isStudent) loadConversations();
      }
    };

    const onReceive = (data) => {
      // Only add to message list if this is the active room
      if (String(data.roomId) !== String(activeRoomRef.current)) {
        if (!isStudent) loadConversations(); // refresh unread badge
        return;
      }
      setMessages((prev) => [...prev, data]);
      if (String(data.senderId) !== String(userId)) {
        socket.emit("markSeen", {
          roomId: String(activeRoom),
          userId: String(userId),
        });
        if (!isStudent) loadConversations();
      }
    };

    const onSeen      = (updated) => setMessages(updated);
    const onTyping    = () => setIsTyping(true);
    const onStopType  = () => setIsTyping(false);

    socket.on("loadMessages",  onLoad);
    socket.on("receiveMessage", onReceive);
    socket.on("messagesSeen",  onSeen);
    socket.on("typing",        onTyping);
    socket.on("stopTyping",    onStopType);

    return () => {
      socket.off("connect",        onReconnect);
      socket.off("loadMessages",   onLoad);
      socket.off("receiveMessage", onReceive);
      socket.off("messagesSeen",   onSeen);
      socket.off("typing",         onTyping);
      socket.off("stopTyping",     onStopType);
    };
  }, [activeRoom, userId, isStudent, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Actions ──────────────────────────────────────────────────
  const selectConversation = (conv) => {
    setActiveRoom(conv.roomId);
    setActiveStudent(conv);
    setMessages([]);
    setIsTyping(false);
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    socket.emit("typing", { roomId: activeRoom });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", { roomId: activeRoom });
    }, 1000);
  };

  const sendMessage = () => {
    if (!message.trim() || !activeRoom) return;
    socket.emit("sendMessage", {
      roomId:   String(activeRoom),
      senderId: String(userId),
      message,
    });
    socket.emit("stopTyping", { roomId: activeRoom });
    setMessage("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    const d   = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatMsgTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ── Shared: message list + input bar ─────────────────────────
  const MessageList = () => (
    <div style={s.messages}>
      {messages.length === 0 && (
        <div style={s.emptyState}>
          <div style={{ fontSize: "48px" }}>💬</div>
          <p style={s.emptyText}>No messages yet.<br />Start the conversation!</p>
        </div>
      )}

      {messages.map((msg, i) => {
        const isMe      = String(msg.senderId) === String(userId);
        const isLast    = i === messages.length - 1;
        const action    = isStudent ? getSystemAction(msg) : null;
        const showAction = action && !rescheduledIds.has(msg._id);
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: isMe ? "flex-end" : "flex-start",
              marginBottom: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
              {!isMe && (
                <div style={s.msgAvatar}>
                  {isStudent
                    ? "👨‍⚕️"
                    : (activeStudent?.studentName?.[0]?.toUpperCase() || "🎓")}
                </div>
              )}
              <div style={isMe ? s.myBubble : s.theirBubble}>
                <span style={s.msgText}>{msg.message}</span>
                <div style={s.msgMeta}>
                  <span>{formatMsgTime(msg.createdAt)}</span>
                  {isMe && isLast && (
                    <span style={{ marginLeft: "4px" }}>
                      {msg.seen ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {showAction && (
              <button
                onClick={() => action.type === "missed" ? openScheduleModal(msg) : handleSystemAction(msg, action.endpoint)}
                disabled={reschedulingId === msg._id}
                style={{ ...s.rescheduleBtn, marginLeft: "36px", opacity: reschedulingId === msg._id ? 0.6 : 1 }}
              >
                {reschedulingId === msg._id ? "Scheduling…" : action.label}
              </button>
            )}
          </div>
        );
      })}

      {isTyping && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "6px" }}>
          <div style={s.msgAvatar}>
            {isStudent ? "👨‍⚕️" : (activeStudent?.studentName?.[0]?.toUpperCase() || "🎓")}
          </div>
          <div style={s.typingBubble}>
            <span style={{ ...s.typingDot, animationDelay: "0ms" }} />
            <span style={{ ...s.typingDot, animationDelay: "180ms" }} />
            <span style={{ ...s.typingDot, animationDelay: "360ms" }} />
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );

  const InputBar = () => (
    <div style={s.inputBar}>
      <input
        value={message}
        onChange={handleTyping}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        style={s.input}
      />
      <button
        onClick={sendMessage}
        style={{ ...s.sendBtn, opacity: message.trim() ? 1 : 0.5 }}
      >➤</button>
    </div>
  );

  // ── STUDENT VIEW ─────────────────────────────────────────────
  if (isStudent) {
    return (
      <div style={s.page}>
        <div style={s.phoneFrame}>
          <div style={s.statusBar} />

          {/* Student header */}
          <div style={s.header}>
            <div style={s.headerLeft}>
              <button
                onClick={() => navigate("/student", { state: { step: "dashboard" } })}
                style={s.backBtn}
              >←</button>
              <div style={s.avatar}>👨‍⚕️</div>
              <div>
                <div style={s.headerName}>Your Counselor</div>
                <div style={s.headerSub}>
                  {isTyping ? (
                    <span style={s.typingText}>
                      <span style={{ ...s.dot, animationDelay: "0ms" }} />
                      <span style={{ ...s.dot, animationDelay: "160ms" }} />
                      <span style={{ ...s.dot, animationDelay: "320ms" }} />
                      typing…
                    </span>
                  ) : "Online ●"}
                </div>
              </div>
            </div>
            <span style={{ fontSize: "20px" }}>💙</span>
          </div>

          <MessageList />
          <InputBar />
        </div>

        {/* ── Schedule Appointment modal (opened from "missed schedule" notice) ── */}
        {schedModalOpen && (
          <div style={s.modalOverlay} onClick={() => setSchedModalOpen(false)}>
            <div style={s.modalCard} onClick={e => e.stopPropagation()}>
              <div style={s.modalHeader}>
                <h3 style={s.modalTitle}>Schedule Your Appointment</h3>
                <button onClick={() => setSchedModalOpen(false)} style={s.modalCloseBtn}>✕</button>
              </div>
              <p style={s.modalSub}>Pick a date and an open time slot below.</p>

              <div style={s.calNavRow}>
                <button
                  onClick={() => goToMonth(-1)}
                  disabled={schedMonth.getFullYear() === startOfToday().getFullYear() && schedMonth.getMonth() === startOfToday().getMonth()}
                  style={{ ...s.calNavBtn, opacity: (schedMonth.getFullYear() === startOfToday().getFullYear() && schedMonth.getMonth() === startOfToday().getMonth()) ? 0.3 : 1 }}
                >‹</button>
                <span style={s.calNavLabel}>
                  {schedMonth.toLocaleDateString("en-US", { month:"long", year:"numeric" })}
                </span>
                <button onClick={() => goToMonth(1)} style={s.calNavBtn}>›</button>
              </div>

              <div style={s.calWeekRow}>
                {["S","M","T","W","T","F","S"].map((d,i) => (
                  <span key={i} style={s.calWeekDay}>{d}</span>
                ))}
              </div>

              <div style={s.calGrid}>
                {getMonthGrid(schedMonth).map((d, i) => {
                  if (!d) return <span key={i} />;
                  const dStr = toDateStr(d);
                  const isSel = dStr === schedDate;
                  const isToday = dStr === toDateStr(startOfToday());
                  const selectable = isSelectableDay(d);
                  return (
                    <button
                      key={i}
                      disabled={!selectable}
                      onClick={() => { setSchedDate(dStr); fetchSlotsForDate(dStr); }}
                      style={{
                        ...s.calDay,
                        ...(isSel ? s.calDayActive : {}),
                        ...(!selectable ? s.calDayDisabled : {}),
                        ...(isToday && !isSel ? s.calDayToday : {}),
                      }}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>

              <p style={s.schedSectionLabel}>AVAILABLE TIMES</p>
              {schedLoading ? (
                <div style={{ padding:"30px 0", textAlign:"center", color:"rgba(45,48,71,0.4)", fontSize:"13px" }}>
                  Loading slots…
                </div>
              ) : schedSlots.every(sl => !sl.available) ? (
                <div style={{ padding:"20px 0", textAlign:"center", color:"rgba(45,48,71,0.4)", fontSize:"13px" }}>
                  No open slots this day — try another date.
                </div>
              ) : (
                <div style={s.slotGrid}>
                  {schedSlots.map(sl => (
                    <button
                      key={sl.value}
                      disabled={!sl.available}
                      onClick={() => setSchedTime(sl.value)}
                      style={{
                        ...s.slotBtn,
                        ...(schedTime === sl.value ? s.slotBtnActive : {}),
                        ...(!sl.available ? s.slotBtnDisabled : {}),
                      }}
                    >
                      {sl.label}
                    </button>
                  ))}
                </div>
              )}

              {schedErr && (
                <div style={{ fontSize:"13px", fontWeight:600, textAlign:"center", color:"#F87171", marginTop:"12px" }}>
                  {schedErr}
                </div>
              )}

              <button
                onClick={handleConfirmSchedule}
                disabled={!schedTime || reschedulingId === schedTargetMsg?._id}
                style={{ ...s.modalConfirmBtn, opacity: (!schedTime || reschedulingId === schedTargetMsg?._id) ? 0.5 : 1 }}
              >
                {reschedulingId === schedTargetMsg?._id ? "Scheduling…" : "Confirm Appointment"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── COUNSELOR VIEW (messenger layout) ────────────────────────
  const filteredConvs = conversations.filter((c) =>
    c.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={s.counselorPage}>

      {/* ── Sidebar ── */}
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <div style={s.sidebarBrand}>
            <span style={{ fontSize: "22px" }}>💬</span>
            <span style={s.brandName}>Messages</span>
          </div>
          <button
            onClick={() => navigate("/admin")}
            style={s.sidebarBackBtn}
            title="Back to Dashboard"
          >←</button>
        </div>

        <div style={s.searchWrap}>
          <span style={s.searchIcon}>🔍</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search students…"
            style={s.searchInput}
          />
        </div>

        <div style={s.convList}>
          {filteredConvs.length === 0 ? (
            <div style={s.noConvs}>
              <span style={{ fontSize: "36px" }}>💬</span>
              <span style={s.noConvsText}>No conversations yet</span>
            </div>
          ) : (
            filteredConvs.map((conv) => {
              const isActive = String(activeRoom) === String(conv.roomId);
              return (
                <div
                  key={conv.roomId}
                  onClick={() => selectConversation(conv)}
                  style={{
                    ...s.convItem,
                    background:  isActive ? "rgba(167,139,250,0.18)" : "transparent",
                    borderLeft:  isActive ? "3px solid #a78bfa" : "3px solid transparent",
                  }}
                >
                  <div style={s.convAvatar}>
                    {conv.studentName?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={s.convInfo}>
                    <div style={s.convTop}>
                      <span style={s.convName}>{conv.studentName}</span>
                      <span style={s.convTime}>{formatTime(conv.lastAt)}</span>
                    </div>
                    <div style={s.convBottom}>
                      <span style={s.convPreview}>
                        {String(conv.lastSenderId) === String(userId) ? "You: " : ""}
                        {conv.lastMessage
                          ? (conv.lastMessage.length > 36
                              ? conv.lastMessage.slice(0, 36) + "…"
                              : conv.lastMessage)
                          : "No messages yet"}
                      </span>
                      {conv.unread > 0 && (
                        <span style={s.unreadBadge}>{conv.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Chat pane ── */}
      <div style={s.chatPane}>
        {activeRoom ? (
          <>
            {/* Counselor chat header */}
            <div style={s.chatHeader}>
              <div style={s.headerLeft}>
                <div style={s.chatAvatar}>
                  {activeStudent?.studentName?.[0]?.toUpperCase() || "🎓"}
                </div>
                <div>
                  <div style={s.headerName}>{activeStudent?.studentName || "Student"}</div>
                  <div style={s.headerSub}>
                    {isTyping ? (
                      <span style={s.typingText}>
                        <span style={{ ...s.dot, animationDelay: "0ms" }} />
                        <span style={{ ...s.dot, animationDelay: "160ms" }} />
                        <span style={{ ...s.dot, animationDelay: "320ms" }} />
                        typing…
                      </span>
                    ) : "Online ●"}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: "20px" }}>💙</span>
            </div>

            <MessageList />
            <InputBar />
          </>
        ) : (
          <div style={s.noChatSelected}>
            <div style={{ fontSize: "64px" }}>💬</div>
            <div style={s.noChatTitle}>Select a conversation</div>
            <div style={s.noChatSub}>
              Choose a student from the sidebar to start chatting
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const s = {
  // ── Student page wrapper (centered phone frame)
  page: {
    display:         "flex",
    justifyContent:  "center",
    alignItems:      "center",
    height:          "100vh",
    background:      "linear-gradient(145deg,#5B6BD8 0%,#7C6FCD 50%,#9B87E8 100%)",
    fontFamily:      "'Lato',sans-serif",
  },
  phoneFrame: {
    width:          "390px",
    height:         "780px",
    display:        "flex",
    flexDirection:  "column",
    background:     "#F3F4F8",
    borderRadius:   "36px",
    overflow:       "hidden",
    boxShadow:      "0 30px 80px rgba(0,0,0,0.35)",
  },
  statusBar: {
    height:     "14px",
    background: "linear-gradient(90deg,#5B6BD8,#7C6FCD)",
  },

  // ── Counselor messenger layout
  counselorPage: {
    display:    "flex",
    height:     "100vh",
    background: "#F3F4F8",
    fontFamily: "'Lato',sans-serif",
  },

  // ── Sidebar
  sidebar: {
    width:          "300px",
    flexShrink:     0,
    display:        "flex",
    flexDirection:  "column",
    background:     "linear-gradient(180deg,#3d3a8c 0%,#5B6BD8 100%)",
    boxShadow:      "4px 0 24px rgba(0,0,0,0.18)",
  },
  sidebarHeader: {
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "space-between",
    padding:         "20px 18px 14px",
  },
  sidebarBrand: {
    display:     "flex",
    alignItems:  "center",
    gap:         "10px",
  },
  brandName: {
    fontSize:    "18px",
    fontWeight:  "700",
    color:       "#fff",
    fontFamily:  "'Poppins',sans-serif",
    letterSpacing: "-0.3px",
  },
  sidebarBackBtn: {
    background:   "rgba(255,255,255,0.15)",
    border:       "1px solid rgba(255,255,255,0.25)",
    color:        "#fff",
    borderRadius: "50%",
    width:        "34px",
    height:       "34px",
    display:      "flex",
    alignItems:   "center",
    justifyContent: "center",
    cursor:       "pointer",
    fontSize:     "16px",
    fontWeight:   700,
    flexShrink:   0,
  },
  searchWrap: {
    display:       "flex",
    alignItems:    "center",
    gap:           "8px",
    margin:        "0 14px 12px",
    background:    "rgba(255,255,255,0.12)",
    borderRadius:  "12px",
    padding:       "8px 12px",
    border:        "1px solid rgba(255,255,255,0.15)",
  },
  searchIcon: { fontSize: "14px" },
  searchInput: {
    flex:        1,
    background:  "transparent",
    border:      "none",
    outline:     "none",
    color:       "#fff",
    fontSize:    "13px",
    fontFamily:  "'Lato',sans-serif",
  },
  convList: {
    flex:       1,
    overflowY:  "auto",
    paddingBottom: "12px",
  },
  noConvs: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "10px",
    paddingTop:     "60px",
    opacity:        0.6,
  },
  noConvsText: {
    fontSize: "13px",
    color:    "rgba(255,255,255,0.5)",
  },
  convItem: {
    display:        "flex",
    alignItems:     "center",
    gap:            "12px",
    padding:        "12px 16px",
    cursor:         "pointer",
    transition:     "background 0.15s",
    borderLeft:     "3px solid transparent",
  },
  convAvatar: {
    width:           "42px",
    height:          "42px",
    background:      "linear-gradient(135deg,rgba(255,255,255,0.25),rgba(255,255,255,0.1))",
    borderRadius:    "50%",
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    fontSize:        "17px",
    fontWeight:      "700",
    color:           "#fff",
    flexShrink:      0,
    border:          "1.5px solid rgba(255,255,255,0.2)",
  },
  convInfo: {
    flex:    1,
    minWidth: 0,
  },
  convTop: {
    display:         "flex",
    justifyContent:  "space-between",
    alignItems:      "baseline",
    marginBottom:    "3px",
  },
  convName: {
    fontSize:    "14px",
    fontWeight:  "600",
    color:       "rgba(255,255,255,0.92)",
    fontFamily:  "'Poppins',sans-serif",
    whiteSpace:  "nowrap",
    overflow:    "hidden",
    textOverflow: "ellipsis",
    maxWidth:    "130px",
  },
  convTime: {
    fontSize:   "11px",
    color:      "rgba(255,255,255,0.45)",
    flexShrink: 0,
  },
  convBottom: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "6px",
  },
  convPreview: {
    fontSize:     "12px",
    color:        "rgba(255,255,255,0.5)",
    whiteSpace:   "nowrap",
    overflow:     "hidden",
    textOverflow: "ellipsis",
    flex:         1,
  },
  unreadBadge: {
    background:    "#a78bfa",
    color:         "#fff",
    borderRadius:  "99px",
    fontSize:      "10px",
    fontWeight:    "700",
    padding:       "2px 7px",
    flexShrink:    0,
  },

  // ── Chat pane (counselor right side)
  chatPane: {
    flex:          1,
    display:       "flex",
    flexDirection: "column",
    overflow:      "hidden",
  },
  noChatSelected: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "14px",
    opacity:        0.45,
  },
  noChatTitle: {
    fontSize:   "20px",
    fontWeight: "700",
    color:      "#5B6BD8",
    fontFamily: "'Poppins',sans-serif",
  },
  noChatSub: {
    fontSize: "14px",
    color:    "#7B7F9E",
  },

  // ── Shared header (student + counselor)
  header: {
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "space-between",
    padding:         "16px 20px",
    background:      "linear-gradient(135deg,#5B6BD8 0%,#7C6FCD 100%)",
    color:           "white",
  },
  chatHeader: {
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "space-between",
    padding:         "14px 22px",
    background:      "linear-gradient(135deg,#5B6BD8 0%,#7C6FCD 100%)",
    color:           "white",
    boxShadow:       "0 2px 12px rgba(91,107,216,0.2)",
  },
  headerLeft: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
  },
  backBtn: {
    background:    "rgba(255,255,255,0.18)",
    border:        "1px solid rgba(255,255,255,0.25)",
    color:         "#fff",
    borderRadius:  "50%",
    width:         "34px",
    height:        "34px",
    display:       "flex",
    alignItems:    "center",
    justifyContent: "center",
    cursor:        "pointer",
    fontSize:      "16px",
    fontWeight:    700,
    flexShrink:    0,
    fontFamily:    "'Lato',sans-serif",
  },
  avatar: {
    width:           "42px",
    height:          "42px",
    background:      "rgba(255,255,255,0.2)",
    borderRadius:    "50%",
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    fontSize:        "22px",
  },
  chatAvatar: {
    width:           "42px",
    height:          "42px",
    background:      "rgba(255,255,255,0.25)",
    borderRadius:    "50%",
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    fontSize:        "18px",
    fontWeight:      "700",
    color:           "#fff",
    flexShrink:      0,
    border:          "2px solid rgba(255,255,255,0.3)",
  },
  headerName: {
    fontWeight:  "700",
    fontSize:    "16px",
    fontFamily:  "'Poppins',sans-serif",
  },
  headerSub: {
    fontSize:  "13px",
    opacity:   0.85,
    marginTop: "2px",
  },
  typingText: {
    display:    "flex",
    alignItems: "center",
    gap:        "3px",
  },
  dot: {
    display:    "inline-block",
    width:      "5px",
    height:     "5px",
    background: "rgba(255,255,255,0.8)",
    borderRadius: "50%",
    animation:  "typingBounce 0.9s ease infinite",
  },

  // ── Messages area
  messages: {
    flex:          1,
    padding:       "16px",
    overflowY:     "auto",
    display:       "flex",
    flexDirection: "column",
    background:    "#F3F4F8",
  },
  emptyState: {
    flex:           1,
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "12px",
    opacity:        0.5,
    marginTop:      "80px",
  },
  emptyText: {
    textAlign:   "center",
    color:       "#7B7F9E",
    lineHeight:  1.65,
    fontSize:    "15px",
  },
  msgAvatar: {
    width:           "28px",
    height:          "28px",
    background:      "#EEF2FF",
    borderRadius:    "50%",
    display:         "flex",
    alignItems:      "center",
    justifyContent:  "center",
    fontSize:        "14px",
    fontWeight:      "700",
    color:           "#5B6BD8",
    flexShrink:      0,
  },
  myBubble: {
    background:   "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color:        "white",
    padding:      "10px 14px",
    borderRadius: "18px 18px 4px 18px",
    maxWidth:     "72%",
    boxShadow:    "0 2px 10px rgba(91,107,216,0.3)",
  },
  theirBubble: {
    background:   "white",
    color:        "#2D3047",
    padding:      "10px 14px",
    borderRadius: "18px 18px 18px 4px",
    maxWidth:     "72%",
    boxShadow:    "0 2px 8px rgba(0,0,0,0.08)",
  },
  rescheduleBtn: {
    marginTop:    "6px",
    padding:      "8px 14px",
    background:   "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color:        "#fff",
    border:       "none",
    borderRadius: "99px",
    fontSize:     "13px",
    fontWeight:   700,
    fontFamily:   "'Poppins',sans-serif",
    cursor:       "pointer",
    boxShadow:    "0 4px 12px rgba(91,107,216,0.3)",
  },

  /* ── Schedule Appointment modal ── */
  modalOverlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 999, padding: "20px",
  },
  modalCard: {
    width: "100%", maxWidth: "400px", maxHeight: "86vh", overflowY: "auto",
    background: "#fff", borderRadius: "20px", padding: "22px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
  },
  modalHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: "4px",
  },
  modalTitle: {
    fontSize: "17px", fontWeight: 800, color: "#2D3047", margin: 0,
    fontFamily: "'Poppins',sans-serif",
  },
  modalCloseBtn: {
    background: "#F3F4F8", border: "none", color: "#2D3047",
    width: "26px", height: "26px", borderRadius: "50%", cursor: "pointer",
    fontSize: "12px", flexShrink: 0,
  },
  modalSub: { fontSize: "13px", color: "#7B7F9E", margin: "0 0 16px" },
  calNavRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: "12px",
  },
  calNavBtn: {
    width: "28px", height: "28px", borderRadius: "50%", flexShrink: 0,
    background: "#F3F4F8", border: "none", color: "#2D3047",
    fontSize: "15px", cursor: "pointer",
  },
  calNavLabel: { fontSize: "13px", fontWeight: 700, color: "#2D3047", fontFamily: "'Poppins',sans-serif" },
  calWeekRow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "4px" },
  calWeekDay: { textAlign: "center", fontSize: "10px", fontWeight: 700, color: "#A8AECB" },
  calGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "16px" },
  calDay: {
    aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: "8px", background: "#F8F9FF", border: "none",
    color: "#2D3047", fontSize: "12px", fontWeight: 600, cursor: "pointer",
  },
  calDayToday: { border: "1.5px solid #5B6BD8" },
  calDayActive: { background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)", color: "#fff", fontWeight: 800 },
  calDayDisabled: { color: "#D1D5F0", cursor: "not-allowed", background: "transparent" },
  schedSectionLabel: { fontSize: "10px", fontWeight: 700, color: "#A8AECB", letterSpacing: "0.06em", margin: "0 0 8px" },
  slotGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" },
  slotBtn: {
    padding: "8px 4px", borderRadius: "8px", fontSize: "11px", fontWeight: 600,
    background: "#F8F9FF", border: "none", color: "#2D3047", cursor: "pointer",
  },
  slotBtnActive: { background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)", color: "#fff" },
  slotBtnDisabled: { color: "#D1D5F0", cursor: "not-allowed", textDecoration: "line-through" },
  modalConfirmBtn: {
    width: "100%", marginTop: "16px", padding: "12px", border: "none",
    borderRadius: "10px", background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff", fontSize: "14px", fontWeight: 700, fontFamily: "'Poppins',sans-serif",
  },
  msgText: {
    display:    "block",
    fontSize:   "15px",
    lineHeight: 1.6,
    fontFamily: "'Lato',sans-serif",
  },
  msgMeta: {
    display:         "flex",
    justifyContent:  "flex-end",
    fontSize:        "10px",
    opacity:         0.7,
    marginTop:       "4px",
    gap:             "2px",
  },
  typingBubble: {
    background:   "white",
    padding:      "12px 16px",
    borderRadius: "18px 18px 18px 4px",
    display:      "flex",
    gap:          "5px",
    alignItems:   "center",
    boxShadow:    "0 2px 8px rgba(0,0,0,0.08)",
  },
  typingDot: {
    display:      "inline-block",
    width:        "7px",
    height:       "7px",
    background:   "#9CA3AF",
    borderRadius: "50%",
    animation:    "typingBounce 0.9s ease infinite",
  },

  // ── Input bar
  inputBar: {
    display:     "flex",
    alignItems:  "center",
    gap:         "10px",
    padding:     "12px 16px",
    background:  "white",
    borderTop:   "1px solid #E5E7EB",
  },
  input: {
    flex:         1,
    padding:      "12px 18px",
    borderRadius: "24px",
    border:       "2px solid rgba(91,107,216,0.2)",
    outline:      "none",
    fontSize:     "15px",
    fontFamily:   "'Lato',sans-serif",
    background:   "#FAFBFF",
    color:        "#2D3047",
  },
  sendBtn: {
    width:         "44px",
    height:        "44px",
    borderRadius:  "50%",
    background:    "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color:         "white",
    border:        "none",
    fontSize:      "18px",
    cursor:        "pointer",
    display:       "flex",
    alignItems:    "center",
    justifyContent: "center",
    boxShadow:     "0 4px 12px rgba(91,107,216,0.38)",
    transition:    "opacity 0.2s",
    flexShrink:    0,
  },
};

export default Chat;
