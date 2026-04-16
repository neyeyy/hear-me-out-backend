import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import API from "../services/api";

const socket = io("http://localhost:5000");

/* ─── constants ──────────────────────────────────────────── */
const SEV_COLOR = { HIGH: "#F87171", MEDIUM: "#F9A72B", LOW: "#38C9B8" };
const SEV_BG    = { HIGH: "#FFF0EE", MEDIUM: "#FFF8EC", LOW: "#E6FAF7" };
const SEV_ORDER = { HIGH: 1, MEDIUM: 2, LOW: 3 };

const MOOD_META = {
  HAPPY:    { emoji: "😊", color: "#4ECDC4" },
  SAD:      { emoji: "😢", color: "#7C6FCD" },
  STRESSED: { emoji: "😫", color: "#F9A72B" },
  ANXIOUS:  { emoji: "😰", color: "#F87171" },
};

const NAV = [
  { key: "overview",  icon: "📊", label: "Overview"  },
  { key: "students",  icon: "👥", label: "Students"  },
  { key: "analytics", icon: "📈", label: "Analytics" },
  { key: "schedule",  icon: "📅", label: "Schedule"  },
  { key: "chat",      icon: "💬", label: "Chat"      },
];

const SCHED_SLOTS = [
  { label: "9:00 AM",  value: "09:00" },
  { label: "9:30 AM",  value: "09:30" },
  { label: "10:00 AM", value: "10:00" },
  { label: "10:30 AM", value: "10:30" },
  { label: "11:00 AM", value: "11:00" },
  { label: "11:30 AM", value: "11:30" },
  { break: true },
  { label: "1:00 PM",  value: "13:00" },
  { label: "1:30 PM",  value: "13:30" },
  { label: "2:00 PM",  value: "14:00" },
  { label: "2:30 PM",  value: "14:30" },
  { label: "3:00 PM",  value: "15:00" },
  { label: "3:30 PM",  value: "15:30" },
];

function getWeekDates(offset) {
  const today = new Date();
  const dow = today.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMon + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/* ─── component ─────────────────────────────────────────── */
export default function CounselorDashboard() {
  const [tab,            setTab]          = useState("overview");
  const [students,       setStudents]     = useState([]);
  const [appointments,   setAppointments] = useState({});
  const [apptList,       setApptList]     = useState([]);
  const [analytics,      setAnalytics]    = useState(null);
  const [search,         setSearch]       = useState("");
  const [sevFilter,      setSevFilter]    = useState("ALL");
  const [loading,        setLoading]      = useState(true);
  // schedule tab
  const [weekOffset,     setWeekOffset]   = useState(0);
  const [ovWeekOffset,   setOvWeekOffset] = useState(0);
  const [rescheduleAppt, setRescheduleAppt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [rescheduling,   setRescheduling]   = useState(false);
  // chat tab
  const [conversations,  setConversations]  = useState([]);
  const [chatRoom,       setChatRoom]       = useState(null);
  const [chatStudent,    setChatStudent]    = useState(null);
  const [chatMessages,   setChatMessages]   = useState([]);
  const [chatInput,      setChatInput]      = useState("");
  const [chatTyping,     setChatTyping]     = useState(false);
  const [chatSearch,     setChatSearch]     = useState("");
  const chatEndRef       = useRef(null);
  const chatRoomRef      = useRef(null);
  const schedInitRef     = useRef(false);
  const ovInitRef        = useRef(false);
  const chatTypingTimer  = useRef(null);
  const navigate = useNavigate();

  const counselorName = localStorage.getItem("name") || "Counselor";

  useEffect(() => {
    Promise.all([fetchStudents(), fetchAppointments(), fetchAnalytics()])
      .finally(() => setLoading(false));
    const iv = setInterval(() => { fetchStudents(); fetchAppointments(); }, 15000);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line

  const fetchStudents = async () => {
    try {
      const res = await API.get("/users/students");
      setStudents(res.data.students || []);
    } catch (e) { console.log(e); }
  };

  const fetchAppointments = async () => {
    try {
      const res = await API.get("/appointments");
      const list = res.data.appointments || [];
      setApptList(list);
      const map = {};
      list.forEach(app => {
        const sid = typeof app.studentId === "object" ? app.studentId._id : app.studentId;
        map[sid] = app;
      });
      setAppointments(map);
    } catch (e) { console.log(e); }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await API.get("/analytics/dashboard");
      setAnalytics(res.data);
    } catch (e) { console.log(e); }
  };

  const loadConversations = useCallback(async () => {
    try {
      const res = await API.get("/messages/conversations");
      setConversations(res.data || []);
    } catch (e) { console.log(e); }
  }, []);

  // Auto-jump to the week of the nearest appointment (past OR future)
  const jumpToNearestAppt = (setOffset) => {
    const withDates = apptList.filter(a => a.scheduleDate);
    if (!withDates.length) return;
    const now = new Date();
    // Find the appointment whose date is closest to today
    const closest = withDates.reduce((best, a) => {
      const diff    = Math.abs(new Date(a.scheduleDate) - now);
      const bestDiff = Math.abs(new Date(best.scheduleDate) - now);
      return diff < bestDiff ? a : best;
    });
    const nearDate = new Date(closest.scheduleDate);
    const dow = now.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const thisMon = new Date(now);
    thisMon.setDate(now.getDate() + diffToMon);
    thisMon.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((nearDate - thisMon) / 86400000);
    setOffset(Math.floor(diffDays / 7));
  };

  useEffect(() => {
    if (tab !== "schedule" || apptList.length === 0 || schedInitRef.current) return;
    schedInitRef.current = true;
    jumpToNearestAppt(setWeekOffset);
  }, [tab, apptList]); // eslint-disable-line

  useEffect(() => {
    if (tab !== "overview" || apptList.length === 0 || ovInitRef.current) return;
    ovInitRef.current = true;
    jumpToNearestAppt(setOvWeekOffset);
  }, [tab, apptList]); // eslint-disable-line

  // Refresh conversations every 15 s while chat tab is open
  useEffect(() => {
    if (tab !== "chat") return;
    loadConversations();
    const iv = setInterval(loadConversations, 15000);
    return () => clearInterval(iv);
  }, [tab, loadConversations]);

  // Keep chatRoomRef in sync
  useEffect(() => { chatRoomRef.current = chatRoom; }, [chatRoom]);

  // Auto-scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Socket listeners for in-dashboard chat
  useEffect(() => {
    if (!chatRoom) return;
    const counselorId = localStorage.getItem("userId");
    socket.emit("joinRoom", chatRoom);

    const onLoad = (data) => {
      setChatMessages(data);
      const hasUnseen = data.some(m => !m.seen && String(m.senderId) !== String(counselorId));
      if (hasUnseen) {
        socket.emit("markSeen", { roomId: String(chatRoom), userId: String(counselorId) });
        loadConversations();
      }
    };
    const onReceive = (data) => {
      if (String(data.roomId) !== String(chatRoomRef.current)) {
        loadConversations(); return;
      }
      setChatMessages(prev => [...prev, data]);
      if (String(data.senderId) !== String(counselorId)) {
        socket.emit("markSeen", { roomId: String(chatRoom), userId: String(counselorId) });
        loadConversations();
      }
    };
    const onSeen     = (updated) => setChatMessages(updated);
    const onTyping   = () => setChatTyping(true);
    const onStopType = () => setChatTyping(false);

    socket.on("loadMessages",   onLoad);
    socket.on("receiveMessage", onReceive);
    socket.on("messagesSeen",   onSeen);
    socket.on("typing",         onTyping);
    socket.on("stopTyping",     onStopType);

    return () => {
      socket.off("loadMessages",   onLoad);
      socket.off("receiveMessage", onReceive);
      socket.off("messagesSeen",   onSeen);
      socket.off("typing",         onTyping);
      socket.off("stopTyping",     onStopType);
    };
  }, [chatRoom, loadConversations]);

  const handleComplete = async (appointmentId) => {
    if (!window.confirm("Mark this session as completed?")) return;
    try {
      await API.patch(`/appointments/${appointmentId}`, { status: "DONE" });
      fetchAppointments();
    } catch (e) { console.error(e.response?.data || e.message); }
  };

  const openChat = (student) => {
    setTab("chat");
    setChatRoom(student._id);
    setChatStudent(student);
    setChatMessages([]);
    setChatTyping(false);
  };

  const selectConversation = (conv) => {
    setChatRoom(conv.roomId);
    setChatStudent({ _id: conv.roomId, name: conv.studentName, email: conv.studentEmail });
    setChatMessages([]);
    setChatTyping(false);
  };

  const sendChatMessage = () => {
    const counselorId = localStorage.getItem("userId");
    if (!chatInput.trim() || !chatRoom) return;
    socket.emit("sendMessage", {
      roomId:   String(chatRoom),
      senderId: String(counselorId),
      message:  chatInput,
    });
    socket.emit("stopTyping", { roomId: chatRoom });
    setChatInput("");
  };

  const handleChatTyping = (e) => {
    setChatInput(e.target.value);
    socket.emit("typing", { roomId: chatRoom });
    clearTimeout(chatTypingTimer.current);
    chatTypingTimer.current = setTimeout(() => {
      socket.emit("stopTyping", { roomId: chatRoom });
    }, 1000);
  };

  const chatFormatTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts); const now = new Date();
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const openReschedule = (appt) => {
    const current = appt.scheduleDate ? new Date(appt.scheduleDate) : new Date();
    const yyyy = current.getFullYear();
    const mm   = String(current.getMonth() + 1).padStart(2, "0");
    const dd   = String(current.getDate()).padStart(2, "0");
    const hh   = String(current.getHours()).padStart(2, "0");
    const min  = String(current.getMinutes()).padStart(2, "0");
    setRescheduleAppt(appt);
    setRescheduleDate(`${yyyy}-${mm}-${dd}`);
    setRescheduleTime(`${hh}:${min}`);
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) return;
    const dow = new Date(rescheduleDate + "T00:00:00").getDay();
    if (dow === 0 || dow === 6) { alert("Please select a weekday (Mon–Fri)."); return; }
    try {
      setRescheduling(true);
      const dt = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
      const res = await API.patch(`/appointments/${rescheduleAppt._id}`, { scheduleDate: dt });
      if (!res.data.success) { alert(res.data.message || "Failed to reschedule."); return; }
      setRescheduleAppt(null);
      fetchAppointments();
    } catch (e) {
      alert(e.response?.data?.message || "Error rescheduling.");
    } finally { setRescheduling(false); }
  };

  const handleLogout = () => {
    ["token","role","userId","name","email"].forEach(k => localStorage.removeItem(k));
    navigate("/");
  };

  /* ── derived counts ── */
  const total    = students.length;
  const high     = students.filter(s => s.severity === "HIGH").length;
  const medium   = students.filter(s => s.severity === "MEDIUM").length;
  const low      = students.filter(s => s.severity === "LOW").length;
  const pending  = Object.values(appointments).filter(a => a.status === "PENDING").length;
  const done     = Object.values(appointments).filter(a => a.status === "DONE").length;

  const ongoingCount     = Object.values(appointments).filter(a => a.status === "ONGOING").length;
  const completionRate   = (pending + done) > 0 ? Math.round(done / (pending + done) * 100) : 0;


  // Count HIGH-severity students with no resolved appointment
  const needsActionCount = students.filter(s =>
    s.severity === "HIGH" &&
    (!appointments[s._id] || appointments[s._id].status !== "DONE")
  ).length;

  /* Sort key: active (PENDING/ONGOING) HIGH → MEDIUM → LOW → no-sev,
     then completed/no-appt in the same severity order at the bottom */
  const studentSortKey = (student) => {
    const app = appointments[student._id];
    const isActive = app && app.status !== "DONE"; // PENDING or ONGOING
    const sevNum = SEV_ORDER[student.severity] || 4;
    return isActive ? sevNum : sevNum + 10;
  };

  const filteredStudents = students
    .filter(s => {
      const q = search.toLowerCase();
      const matchSearch = (s.name  || "").toLowerCase().includes(q) ||
                          (s.email || "").toLowerCase().includes(q);
      const matchSev = sevFilter === "ALL" || s.severity === sevFilter;
      return matchSearch && matchSev;
    })
    .sort((a, b) => studentSortKey(a) - studentSortKey(b));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  /* ── mood analytics ── */
  const totalMoods = analytics?.moods?.reduce((s, m) => s + m.count, 0) || 0;

  if (loading) {
    return (
      <div style={s.loadingScreen}>
        <div style={s.loadingSpinner} />
        <p style={s.loadingText}>Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div style={s.layout}>

      {/* ══════════ SIDEBAR ══════════ */}
      <aside style={s.sidebar}>
        <div style={s.sideTop}>
          <div style={s.brand}>
            <div style={s.brandLogo}>💙</div>
            <div>
              <div style={s.brandName}>Hear Me Out</div>
              <div style={s.brandRole}>Counselor Panel</div>
            </div>
          </div>
        </div>

        <nav style={s.nav}>
          {NAV.map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              style={{
                ...s.navItem,
                background: tab === item.key ? "rgba(255,255,255,0.13)" : "transparent",
                color:      tab === item.key ? "#fff" : "rgba(255,255,255,0.58)",
                borderLeft: tab === item.key ? "3px solid #38C9B8" : "3px solid transparent",
              }}
            >
              <span style={s.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
              {item.key === "students" && high > 0 && (
                <span style={s.navBadge}>{high}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={s.sideBottom}>
          <div style={s.profileRow}>
            <div style={s.profileAvatar}>
              {counselorName.charAt(0).toUpperCase()}
            </div>
            <div style={s.profileInfo}>
              <div style={s.profileName}>{counselorName}</div>
              <div style={s.profileOnline}>● Online</div>
            </div>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn}>
            🚪 Sign out
          </button>
        </div>
      </aside>

      {/* ══════════ MAIN ══════════ */}
      <main style={{ ...s.main, padding: (tab === "chat" || tab === "schedule" || tab === "analytics") ? "0" : "28px 32px" }}>

        {/* ── Top bar — hidden on chat, schedule, analytics tabs ── */}
        {tab !== "chat" && tab !== "schedule" && tab !== "analytics" && <div style={s.topBar}>
          <div>
            <h1 style={s.pageTitle}>
              {tab === "overview"  && `${greeting}, ${counselorName.split(" ")[0]} 👋`}
              {tab === "students"  && "Students"}
            </h1>
            <p style={s.pageSub}>
              {new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
            </p>
          </div>
          {tab === "students" && (
            <div style={s.topBarActions}>
              <div style={s.searchWrap}>
                <span style={s.searchIcon}>🔍</span>
                <input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={s.searchInput}
                />
              </div>
              {tab === "students" && (
                <div style={s.filterRow}>
                  {["ALL","HIGH","MEDIUM","LOW"].map(f => (
                    <button
                      key={f}
                      onClick={() => setSevFilter(f)}
                      style={{
                        ...s.filterBtn,
                        background: sevFilter === f
                          ? (f === "ALL" ? "#5B6BD8" : SEV_COLOR[f])
                          : "#fff",
                        color: sevFilter === f ? "#fff"
                          : (f === "ALL" ? "#5B6BD8" : SEV_COLOR[f]),
                        borderColor: f === "ALL" ? "#5B6BD8" : (SEV_COLOR[f] || "#5B6BD8"),
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>}

        {/* ══════════ OVERVIEW TAB ══════════ */}
        {tab === "overview" && (
          <>
            {/* Smart stat row */}
            <div style={s.statsGrid}>
              <StatCard icon="🚨" label="Needs Action"     value={needsActionCount} accent="#F87171" sub="HIGH risk, unresolved" />
              <StatCard icon="🔄" label="Active Sessions"  value={ongoingCount}     accent="#5B6BD8" sub="Currently in progress" />
              <StatCard icon="⏳" label="Awaiting Session" value={pending}          accent="#F9A72B" sub="Appointments pending" />
              <StatCard icon="✅" label="Completion Rate"  value={`${completionRate}%`} accent="#38C9B8" sub={`${done} of ${pending + done} sessions done`} />
            </div>

            {/* Overview Mini Calendar */}
            {(() => {
              const ovDates = getWeekDates(ovWeekOffset);
              const ovStart = ovDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" });
              const ovEnd   = ovDates[4].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const isToday = (d) => d.toDateString() === new Date().toDateString();

              const ovSameDay = (d, day) =>
                d.getFullYear() === day.getFullYear() &&
                d.getMonth()    === day.getMonth()    &&
                d.getDate()     === day.getDate();

              const ovMatchSlot = (d, slot) => {
                const [sh, sm] = slot.value.split(":").map(Number);
                if (d.getHours() === sh && d.getMinutes() === sm) return true;
                if (d.getUTCHours() === sh && d.getUTCMinutes() === sm) return true;
                return false;
              };

              const findSlot = (day, slot) =>
                apptList.find(a => {
                  if (!a.scheduleDate) return false;
                  const d = new Date(a.scheduleDate);
                  return ovSameDay(d, day) && ovMatchSlot(d, slot);
                });

              const weekAppts = apptList.filter(a => {
                if (!a.scheduleDate) return false;
                const d = new Date(a.scheduleDate);
                return ovDates.some(wd => ovSameDay(d, wd));
              });

              return (
                <div style={s.card}>
                  {/* Card header */}
                  <div style={s.cardHeader}>
                    <div style={s.cardTitleRow}>
                      <span style={{ ...s.dot, background: "#5B6BD8" }} />
                      <h2 style={s.cardTitle}>Schedule</h2>
                    </div>
                    {/* Week nav */}
                    <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                      <button onClick={() => setOvWeekOffset(o => o - 1)} style={s.ovNavBtn}>←</button>
                      <span style={s.ovWeekLabel}>{ovStart} – {ovEnd}</span>
                      <button onClick={() => setOvWeekOffset(o => o + 1)} style={s.ovNavBtn}>→</button>
                      {ovWeekOffset !== 0 && (
                        <button onClick={() => setOvWeekOffset(0)} style={s.ovTodayBtn}>Today</button>
                      )}
                    </div>
                  </div>

                  {/* Scrollable calendar body */}
                  <div style={{ overflowX:"auto" }}>
                    {/* Day headers */}
                    <div style={s.ovCalRow}>
                      <div style={s.ovTimeCol} />
                      {ovDates.map((d, i) => (
                        <div key={i} style={{ ...s.ovDayHeader, background: isToday(d) ? "rgba(91,107,216,0.07)" : undefined }}>
                          <div style={s.ovDayName}>{d.toLocaleDateString("en-US",{ weekday:"short" })}</div>
                          <div style={{ ...s.ovDayNum, color: isToday(d) ? "#5B6BD8" : undefined, fontWeight: isToday(d) ? "800" : "600" }}>
                            {d.toLocaleDateString("en-US",{ month:"short", day:"numeric" })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Slot rows — scrollable */}
                    <div style={{ maxHeight:"260px", overflowY:"auto" }}>
                      {SCHED_SLOTS.map((slot, si) => {
                        if (slot.break) return (
                          <div key="lunch" style={s.ovLunchRow}>☕ 12:00–1:00 PM Lunch</div>
                        );
                        return (
                          <div key={si} style={s.ovCalRow}>
                            <div style={s.ovTimeCol}>{slot.label}</div>
                            {ovDates.map((d, di) => {
                              const appt = findSlot(d, slot);
                              const sn   = appt && typeof appt.studentId === "object" ? (appt.studentId.name || "Student") : "";
                              return (
                                <div key={di} style={{ ...s.ovSlot, background: isToday(d) ? "rgba(91,107,216,0.02)" : undefined }}>
                                  {appt && (
                                    <div
                                      style={{ ...s.ovChip, borderLeftColor: SEV_COLOR[appt.severity] || "#5B6BD8" }}
                                      onClick={() => openReschedule(appt)}
                                      title={`${sn} — ${appt.severity} — Click to reschedule`}
                                    >
                                      <div style={s.ovChipName}>{sn}</div>
                                      <div style={{ ...s.ovChipSev, color: SEV_COLOR[appt.severity] }}>{appt.severity}</div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {weekAppts.length === 0 && (
                    <div style={{ ...s.emptyBox, paddingTop:"12px", paddingBottom:"12px" }}>
                      <span style={{ fontSize:"28px" }}>📅</span>
                      <p style={s.emptyText}>No appointments this week</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Two-col: Mood Climate + Session Pipeline */}
            <div style={s.twoCol}>

              {/* Mood Climate */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitleRow}>
                    <span style={{ ...s.dot, background: "#5B6BD8" }} />
                    <h2 style={s.cardTitle}>Mood Climate</h2>
                  </div>
                  <span style={s.cardSub}>{totalMoods} entries</span>
                </div>

                {totalMoods === 0 ? (
                  <div style={s.emptyBox}>
                    <span style={{ fontSize: "28px" }}>📊</span>
                    <p style={s.emptyText}>No mood data recorded yet</p>
                  </div>
                ) : (() => {
                  const top  = (analytics?.moods || []).slice().sort((a, b) => b.count - a.count)[0];
                  const meta = top ? (MOOD_META[top._id] || { emoji: "❓", color: "#ccc" }) : null;
                  return (
                    <>
                      {top && meta && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: "14px",
                          padding: "14px 16px",
                          background: meta.color + "18",
                          borderRadius: "12px",
                          marginBottom: "16px",
                          border: `1.5px solid ${meta.color}33`,
                        }}>
                          <span style={{ fontSize: "38px", lineHeight: 1 }}>{meta.emoji}</span>
                          <div>
                            <div style={{ fontSize: "10px", fontWeight: "700", color: "#A8AECB", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Poppins',sans-serif", marginBottom: "3px" }}>
                              Most reported mood
                            </div>
                            <div style={{ fontSize: "19px", fontWeight: "700", color: meta.color, fontFamily: "'Poppins',sans-serif", lineHeight: 1.2 }}>
                              {top._id}
                            </div>
                            <div style={{ fontSize: "12px", color: "#A8AECB", marginTop: "2px" }}>
                              {top.count} of {totalMoods} entries ({Math.round(top.count / totalMoods * 100)}%)
                            </div>
                          </div>
                        </div>
                      )}
                      <div style={s.moodBars}>
                        {(analytics?.moods || []).map(m => {
                          const mm  = MOOD_META[m._id] || { emoji: "❓", color: "#ccc" };
                          const pct = Math.round(m.count / totalMoods * 100);
                          return (
                            <div key={m._id} style={s.moodBarRow}>
                              <div style={s.moodBarLabel}>
                                <span style={s.moodEmoji}>{mm.emoji}</span>
                                <span style={s.moodName}>{m._id}</span>
                              </div>
                              <div style={s.moodBarTrack}>
                                <div style={{ ...s.moodBarFill, width: `${pct}%`, background: mm.color }} />
                              </div>
                              <span style={s.moodBarPct}>{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Session Pipeline */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitleRow}>
                    <span style={{ ...s.dot, background: "#7C6FCD" }} />
                    <h2 style={s.cardTitle}>Session Pipeline</h2>
                  </div>
                  <span style={s.cardSub}>{completionRate}% complete</span>
                </div>

                <div style={s.apptSummary}>
                  {[
                    { label: "⏳ Pending",   value: pending,      color: "#F9A72B", bg: "#FFF8EC", desc: "Waiting to start" },
                    { label: "🔄 Ongoing",   value: ongoingCount, color: "#5B6BD8", bg: "#EEF0FD", desc: "In progress now" },
                    { label: "✅ Completed", value: done,          color: "#38C9B8", bg: "#E6FAF7", desc: "Sessions closed" },
                  ].map(row => (
                    <div key={row.label} style={{ ...s.apptRow, background: row.bg, flexDirection: "column", alignItems: "flex-start", gap: "2px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                        <span style={{ ...s.apptLabel, color: row.color }}>{row.label}</span>
                        <span style={{ ...s.apptCount, color: row.color }}>{row.value}</span>
                      </div>
                      <span style={{ fontSize: "11px", color: row.color, opacity: 0.7, fontFamily: "'Lato',sans-serif" }}>{row.desc}</span>
                    </div>
                  ))}
                </div>

                <div style={s.apptProgressWrap}>
                  <p style={s.apptProgressLabel}>Overall completion rate</p>
                  <div style={s.progressBar}>
                    <div style={{
                      ...s.progressFill,
                      width: `${completionRate}%`,
                      background: "linear-gradient(90deg,#38C9B8,#5B6BD8)",
                    }} />
                  </div>
                  <p style={s.progressPct}>{completionRate}% of sessions completed</p>
                </div>

              </div>
            </div>
          </>
        )}

        {/* ══════════ STUDENTS TAB — full caseload registry ══════════ */}
        {tab === "students" && (
          <>
            {/* Summary strip */}
            <div style={{ display:"flex", gap:"10px", marginBottom:"16px", flexWrap:"wrap" }}>
              {[
                { label:"Total",         value: total,                                                                color:"#5B6BD8", bg:"#EEF0FD" },
                { label:"High Risk",     value: high,                                                                color:"#F87171", bg:"#FFF0EE" },
                { label:"Medium Risk",   value: medium,                                                              color:"#F9A72B", bg:"#FFF8EC" },
                { label:"Low Risk",      value: low,                                                                 color:"#38C9B8", bg:"#E6FAF7" },
                { label:"Unresolved",    value: students.filter(s => !appointments[s._id] || appointments[s._id].status !== "DONE").length, color:"#7C6FCD", bg:"#F3F0FF" },
              ].map(c => (
                <div key={c.label} style={{ display:"flex", alignItems:"center", gap:"7px", padding:"7px 14px", background:c.bg, borderRadius:"99px" }}>
                  <span style={{ fontSize:"15px", fontWeight:"800", color:c.color, fontFamily:"'Poppins',sans-serif", lineHeight:1 }}>{c.value}</span>
                  <span style={{ fontSize:"11px", color:c.color, fontWeight:"600", fontFamily:"'Poppins',sans-serif" }}>{c.label}</span>
                </div>
              ))}
            </div>

            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitleRow}>
                  <span style={{ ...s.dot, background:"#5B6BD8" }} />
                  <h2 style={s.cardTitle}>Student Roster</h2>
                </div>
                <span style={{ ...s.pill, background:"#EEF0FD", color:"#5B6BD8" }}>
                  {filteredStudents.length} shown
                </span>
              </div>

              {filteredStudents.length === 0 ? (
                <div style={s.emptyBox}>
                  <span style={{ fontSize:"32px" }}>🔍</span>
                  <p style={s.emptyText}>No students match your filter</p>
                </div>
              ) : (
                <>
                  {[
                    { sev:"HIGH",   label:"🔴 High Risk",    color:"#F87171" },
                    { sev:"MEDIUM", label:"🟡 Medium Risk",   color:"#F9A72B" },
                    { sev:"LOW",    label:"🟢 Low Risk",      color:"#38C9B8" },
                    { sev:null,     label:"⚪ No Assessment", color:"#A8AECB" },
                  ].map(({ sev, label, color }) => {
                    const group = filteredStudents.filter(s => sev ? s.severity === sev : !s.severity);
                    if (group.length === 0) return null;
                    return (
                      <div key={label} style={{ marginBottom:"22px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px", paddingBottom:"8px", borderBottom:`2px solid ${color}22` }}>
                          <span style={{ fontSize:"12px", fontWeight:"700", color, fontFamily:"'Poppins',sans-serif" }}>{label}</span>
                          <span style={{ fontSize:"11px", color:"#A8AECB" }}>({group.length} student{group.length !== 1 ? "s" : ""})</span>
                        </div>
                        <div style={s.studentGrid}>
                          {group.map(student => {
                            const app    = appointments[student._id];
                            const isDone = !app || app.status === "DONE";
                            return (
                              <div key={student._id} style={{ ...s.studentCard, opacity: isDone ? 0.58 : 1, borderLeft:`3px solid ${color}44` }}>
                                <div style={s.studentCardLeft}>
                                  <div style={{ ...s.studentAva, background: sev ? `linear-gradient(135deg,${color}99,${color})` : "linear-gradient(135deg,#A8AECB,#7B7F9E)" }}>
                                    {(student.name || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={s.studentCardName}>{student.name}</div>
                                    <div style={s.studentCardEmail}>{student.email}</div>
                                  </div>
                                </div>
                                <div style={s.apptStatus}>
                                  {app ? (
                                    app.status === "DONE"
                                      ? <span style={s.stDone}>✓ Session done</span>
                                      : <span style={{ ...s.stPending, color: app.status === "ONGOING" ? "#5B6BD8" : "#F9A72B", background: app.status === "ONGOING" ? "#EEF0FD" : "#FFF8EC" }}>{app.status}</span>
                                  ) : <span style={s.stNone}>No appointment</span>}
                                </div>
                                <div style={s.studentCardActions}>
                                  <button onClick={() => openChat(student)} style={s.btnChat}>💬 Chat</button>
                                  {app && app.status !== "DONE" && (
                                    <button onClick={() => handleComplete(app._id)} style={s.btnDone}>✓ Done</button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </>
        )}

        {/* ══════════ ANALYTICS TAB — aggregate data only, no actions ══════════ */}
        {tab === "analytics" && (
          <div style={{ padding: "28px 32px" }}>
            {/* Wellness headline */}
            <div style={{ ...s.card, background:"linear-gradient(135deg,#1E2140 0%,#2D3166 100%)", marginBottom:"20px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"16px" }}>
                <div>
                  <p style={{ fontSize:"11px", fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.1em", color:"rgba(255,255,255,0.5)", margin:"0 0 6px", fontFamily:"'Poppins',sans-serif" }}>
                    Program Wellness Report
                  </p>
                  <p style={{ fontSize:"28px", fontWeight:"800", color:"#fff", margin:0, fontFamily:"'Poppins',sans-serif", lineHeight:1 }}>
                    {total > 0 ? Math.round(low / total * 100) : 0}% Low Risk
                  </p>
                  <p style={{ fontSize:"13px", color:"rgba(255,255,255,0.55)", margin:"6px 0 0", fontFamily:"'Lato',sans-serif" }}>
                    {low} of {total} students in healthy range · {high > 0 ? `${high} need immediate attention` : "no urgent cases"}
                  </p>
                </div>
                <div style={{ display:"flex", gap:"24px" }}>
                  {[
                    { label:"Students",    value: total },
                    { label:"Sessions",    value: Object.keys(appointments).length },
                    { label:"Mood Entries",value: totalMoods },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign:"center" }}>
                      <div style={{ fontSize:"26px", fontWeight:"800", color:"#fff", fontFamily:"'Poppins',sans-serif", lineHeight:1 }}>{item.value}</div>
                      <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.5)", fontWeight:"600", marginTop:"4px", fontFamily:"'Poppins',sans-serif" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Risk distribution + Session statistics */}
            <div style={s.twoCol}>
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitleRow}>
                    <span style={{ ...s.dot, background:"#F87171" }} />
                    <h2 style={s.cardTitle}>Risk Distribution</h2>
                  </div>
                  <span style={s.cardSub}>{total} students total</span>
                </div>
                <div style={s.riskBars}>
                  {[
                    { label:"High Risk",   value:high,   color:"#F87171" },
                    { label:"Medium Risk", value:medium, color:"#F9A72B" },
                    { label:"Low Risk",    value:low,    color:"#38C9B8" },
                  ].map(r => (
                    <div key={r.label} style={s.riskBarItem}>
                      <div style={s.riskBarHeader}>
                        <span style={{ ...s.riskLabel, color:r.color }}>{r.label}</span>
                        <span style={{ ...s.riskCount, color:r.color }}>{r.value} student{r.value !== 1 ? "s" : ""}</span>
                      </div>
                      <div style={s.riskTrack}>
                        <div style={{ ...s.riskFill, width: total > 0 ? `${Math.round(r.value/total*100)}%` : "0%", background:r.color }} />
                      </div>
                      <span style={s.riskPct}>{total > 0 ? Math.round(r.value/total*100) : 0}% of all students</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitleRow}>
                    <span style={{ ...s.dot, background:"#7C6FCD" }} />
                    <h2 style={s.cardTitle}>Session Statistics</h2>
                  </div>
                  <span style={s.cardSub}>{completionRate}% completion rate</span>
                </div>
                <div style={s.sessionGrid}>
                  {[
                    { label:"Total",     value:Object.keys(appointments).length, icon:"📋", color:"#5B6BD8" },
                    { label:"Completed", value:done,         icon:"✅", color:"#38C9B8" },
                    { label:"Pending",   value:pending,      icon:"⏳", color:"#F9A72B" },
                    { label:"Ongoing",   value:ongoingCount, icon:"🔄", color:"#7C6FCD" },
                  ].map(item => (
                    <div key={item.label} style={{ ...s.sessionCard, borderLeft:`4px solid ${item.color}` }}>
                      <span style={s.sessionIcon}>{item.icon}</span>
                      <div style={{ ...s.sessionValue, color:item.color }}>{item.value}</div>
                      <div style={s.sessionLabel}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:"16px", paddingTop:"14px", borderTop:"1px solid #F0F2F8" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                    <span style={{ fontSize:"12px", color:"#A8AECB", fontFamily:"'Poppins',sans-serif" }}>Session completion rate</span>
                    <span style={{ fontSize:"12px", fontWeight:"700", color:"#38C9B8", fontFamily:"'Poppins',sans-serif" }}>{completionRate}%</span>
                  </div>
                  <div style={s.progressBar}>
                    <div style={{ ...s.progressFill, width:`${completionRate}%`, background:"linear-gradient(90deg,#38C9B8,#5B6BD8)" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Mood breakdown — full detail */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitleRow}>
                  <span style={{ ...s.dot, background:"#5B6BD8" }} />
                  <h2 style={s.cardTitle}>Mood Frequency Breakdown</h2>
                </div>
                <span style={s.cardSub}>{totalMoods} total mood entries</span>
              </div>
              {totalMoods === 0 ? (
                <div style={s.emptyBox}>
                  <span style={{ fontSize:"32px" }}>📊</span>
                  <p style={s.emptyText}>No mood data recorded yet</p>
                </div>
              ) : (
                <div style={s.moodFullGrid}>
                  {(analytics?.moods || []).sort((a,b) => b.count - a.count).map(m => {
                    const meta = MOOD_META[m._id] || { emoji:"❓", color:"#ccc" };
                    const pct  = Math.round(m.count / totalMoods * 100);
                    return (
                      <div key={m._id} style={{ ...s.moodFullCard, borderTop:`4px solid ${meta.color}` }}>
                        <span style={s.moodFullEmoji}>{meta.emoji}</span>
                        <div style={{ ...s.moodFullValue, color:meta.color }}>{m.count}</div>
                        <div style={s.moodFullLabel}>{m._id}</div>
                        <div style={s.moodFullPct}>{pct}% of entries</div>
                        <div style={s.moodFullTrack}>
                          <div style={{ ...s.moodFullFill, width:`${pct}%`, background:meta.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ SCHEDULE TAB ══════════ */}
        {tab === "schedule" && (() => {
          const weekDates = getWeekDates(weekOffset);
          const weekStart = weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" });
          const weekEnd   = weekDates[4].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

          const sameDay = (d, day) =>
            d.getFullYear() === day.getFullYear() &&
            d.getMonth()    === day.getMonth()    &&
            d.getDate()     === day.getDate();

          const matchesSlot = (d, slot) => {
            const [sh, sm] = slot.value.split(":").map(Number);
            // Try local time first, then UTC (handles server/browser timezone mismatch)
            if (d.getHours() === sh && d.getMinutes() === sm) return true;
            if (d.getUTCHours() === sh && d.getUTCMinutes() === sm) return true;
            return false;
          };

          const findApptInSlot = (day, slot) =>
            apptList.find(a => {
              if (!a.scheduleDate) return false;
              const d = new Date(a.scheduleDate);
              return sameDay(d, day) && matchesSlot(d, slot);
            });

          const isToday = (d) => d.toDateString() === new Date().toDateString();
          const studentName = (appt) => typeof appt.studentId === "object" ? (appt.studentId.name || "Student") : "Student";

          return (
            <>
              <div style={{ ...s.card, margin: 0, borderRadius: 0, minHeight: "100vh", boxShadow: "none" }}>
                {/* Week nav header */}
                <div style={s.weekNavBar}>
                  <button onClick={() => setWeekOffset(o => o - 1)} style={s.weekNavBtn}>← Prev</button>
                  <div style={{ textAlign:"center" }}>
                    <div style={s.weekTitle}>{weekStart} – {weekEnd}</div>
                    {weekOffset !== 0 && (
                      <button onClick={() => setWeekOffset(0)} style={s.todayPill}>Today</button>
                    )}
                  </div>
                  <button onClick={() => setWeekOffset(o => o + 1)} style={s.weekNavBtn}>Next →</button>
                </div>

                {/* Calendar table */}
                <div style={s.calWrap}>
                  {/* Day headers */}
                  <div style={s.calRow}>
                    <div style={s.calTimeCol} />
                    {weekDates.map((d, i) => (
                      <div key={i} style={{ ...s.calDayHeader, background: isToday(d) ? "rgba(91,107,216,0.08)" : undefined }}>
                        <div style={s.calDayName}>{d.toLocaleDateString("en-US",{ weekday:"short" })}</div>
                        <div style={{ ...s.calDayNum, color: isToday(d) ? "#5B6BD8" : undefined, fontWeight: isToday(d) ? "800" : "600" }}>
                          {d.toLocaleDateString("en-US",{ month:"short", day:"numeric" })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Slot rows */}
                  {SCHED_SLOTS.map((slot, si) => {
                    if (slot.break) return (
                      <div key="lunch" style={s.lunchRow}>
                        ☕ Lunch Break — 12:00 PM to 1:00 PM
                      </div>
                    );
                    return (
                      <div key={si} style={s.calRow}>
                        <div style={s.calTimeCol}>{slot.label}</div>
                        {weekDates.map((d, di) => {
                          const appt = findApptInSlot(d, slot);
                          return (
                            <div key={di} style={{ ...s.calSlot, background: isToday(d) ? "rgba(91,107,216,0.02)" : undefined }}>
                              {appt && (
                                <div
                                  style={{ ...s.apptChip, borderLeftColor: SEV_COLOR[appt.severity] || "#5B6BD8" }}
                                  onClick={() => openReschedule(appt)}
                                  title="Click to reschedule"
                                >
                                  <div style={s.apptChipName}>{studentName(appt)}</div>
                                  <div style={{ ...s.apptChipMeta, color: SEV_COLOR[appt.severity] }}>
                                    {appt.severity}
                                  </div>
                                  <div style={{ ...s.apptChipMeta, color: appt.status === "DONE" ? "#38C9B8" : appt.status === "ONGOING" ? "#5B6BD8" : "#F9A72B" }}>
                                    {appt.status}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {apptList.filter(a => a.scheduleDate).length === 0 && (
                  <div style={s.emptyBox}>
                    <span style={{ fontSize:"32px" }}>📅</span>
                    <p style={s.emptyText}>No appointments scheduled yet</p>
                  </div>
                )}
              </div>

              {/* Reschedule modal */}
              {rescheduleAppt && (
                <div style={s.modalOverlay}>
                  <div style={s.modal}>
                    <h3 style={s.modalTitle}>Reschedule Appointment</h3>
                    <div style={s.modalInfoRow}>
                      <span style={s.modalInfoLabel}>Student</span>
                      <span style={s.modalInfoValue}>{studentName(rescheduleAppt)}</span>
                    </div>
                    <div style={s.modalInfoRow}>
                      <span style={s.modalInfoLabel}>Severity</span>
                      <span style={{ ...s.modalInfoValue, color: SEV_COLOR[rescheduleAppt.severity], fontWeight:"700" }}>
                        {rescheduleAppt.severity}
                      </span>
                    </div>
                    {rescheduleAppt.scheduleDate && (
                      <div style={s.modalInfoRow}>
                        <span style={s.modalInfoLabel}>Current</span>
                        <span style={s.modalInfoValue}>
                          {new Date(rescheduleAppt.scheduleDate).toLocaleString("en-US",{ dateStyle:"medium", timeStyle:"short" })}
                        </span>
                      </div>
                    )}
                    <div style={s.modalGroup}>
                      <label style={s.modalLabel}>New Date <span style={{ color:"#A8AECB", fontWeight:"400" }}>(Mon–Fri only)</span></label>
                      <input
                        type="date"
                        value={rescheduleDate}
                        onChange={e => setRescheduleDate(e.target.value)}
                        style={s.modalInput}
                      />
                    </div>
                    <div style={s.modalGroup}>
                      <label style={s.modalLabel}>Time Slot</label>
                      <select value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} style={s.modalInput}>
                        {SCHED_SLOTS.filter(sl => !sl.break).map(sl => (
                          <option key={sl.value} value={sl.value}>{sl.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display:"flex", gap:"10px", marginTop:"22px" }}>
                      <button onClick={handleReschedule} disabled={rescheduling} style={s.modalSaveBtn}>
                        {rescheduling ? "Saving…" : "Save Schedule"}
                      </button>
                      <button onClick={() => setRescheduleAppt(null)} style={s.modalCancelBtn}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* ══════════ CHAT TAB — inline messenger ══════════ */}
        {tab === "chat" && (() => {
          const counselorId     = localStorage.getItem("userId");
          const filteredConvs   = conversations.filter(c =>
            c.studentName.toLowerCase().includes(chatSearch.toLowerCase())
          );

          return (
            <div style={s.messengerWrap}>

              {/* ── Left: conversation list ── */}
              <div style={s.messengerSidebar}>
                <div style={s.msHeader}>
                  <span style={s.msHeaderTitle}>💬 Recent Chats</span>
                  <span style={{ ...s.pill, background:"#EEF0FD", color:"#5B6BD8", fontSize:"11px" }}>
                    {conversations.length}
                  </span>
                </div>

                {/* Search */}
                <div style={s.msSrchWrap}>
                  <span style={s.msSrchIcon}>🔍</span>
                  <input
                    value={chatSearch}
                    onChange={e => setChatSearch(e.target.value)}
                    placeholder="Search conversations…"
                    style={s.msSrchInput}
                  />
                </div>

                {/* Conversation rows */}
                <div style={s.msConvList}>
                  {filteredConvs.length === 0 ? (
                    <div style={s.msEmpty}>
                      <span style={{ fontSize:"32px" }}>💬</span>
                      <p style={s.msEmptyText}>No conversations yet</p>
                    </div>
                  ) : filteredConvs.map(conv => {
                    const isActive = String(chatRoom) === String(conv.roomId);
                    const sev      = students.find(st => String(st._id) === String(conv.roomId))?.severity;
                    return (
                      <div
                        key={conv.roomId}
                        onClick={() => selectConversation(conv)}
                        style={{
                          ...s.msConvRow,
                          background:  isActive ? "#EEF0FD" : "#fff",
                          borderLeft:  isActive ? "3px solid #5B6BD8" : "3px solid transparent",
                        }}
                      >
                        <div style={{
                          ...s.msConvAva,
                          background: sev ? `linear-gradient(135deg,${SEV_COLOR[sev]}99,${SEV_COLOR[sev]})` : "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
                        }}>
                          {conv.studentName?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div style={s.msConvInfo}>
                          <div style={s.msConvTop}>
                            <span style={s.msConvName}>{conv.studentName}</span>
                            <span style={s.msConvTime}>{chatFormatTime(conv.lastAt)}</span>
                          </div>
                          <div style={s.msConvBottom}>
                            <span style={s.msConvPreview}>
                              {String(conv.lastSenderId) === String(counselorId) ? "You: " : ""}
                              {conv.lastMessage
                                ? (conv.lastMessage.length > 34 ? conv.lastMessage.slice(0, 34) + "…" : conv.lastMessage)
                                : "No messages yet"}
                            </span>
                            {conv.unread > 0 && (
                              <span style={s.msUnread}>{conv.unread}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Right: chat pane ── */}
              <div style={s.msChatPane}>
                {!chatRoom ? (
                  <div style={s.msNoneSelected}>
                    <span style={{ fontSize:"56px" }}>💬</span>
                    <div style={s.msNoneTitle}>Select a conversation</div>
                    <div style={s.msNoneSub}>Choose a student from the list to start chatting</div>
                  </div>
                ) : (
                  <>
                    {/* Chat header */}
                    <div style={s.msChatHeader}>
                      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                        {(() => {
                          const sev = students.find(st => String(st._id) === String(chatRoom))?.severity;
                          return (
                            <div style={{
                              ...s.msChatAva,
                              background: sev ? `linear-gradient(135deg,${SEV_COLOR[sev]}99,${SEV_COLOR[sev]})` : "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
                            }}>
                              {chatStudent?.name?.[0]?.toUpperCase() || "?"}
                            </div>
                          );
                        })()}
                        <div>
                          <div style={s.msChatName}>{chatStudent?.name || "Student"}</div>
                          <div style={s.msChatSub}>
                            {chatTyping ? (
                              <span style={{ color:"#5B6BD8" }}>typing…</span>
                            ) : (
                              <span>● Online</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const sev = students.find(st => String(st._id) === String(chatRoom))?.severity;
                        return sev ? (
                          <span style={{ ...s.sevBadge, background:SEV_BG[sev], color:SEV_COLOR[sev], border:`1.5px solid ${SEV_COLOR[sev]}55` }}>
                            {sev === "HIGH" ? "🔴" : sev === "MEDIUM" ? "🟡" : "🟢"} {sev}
                          </span>
                        ) : null;
                      })()}
                    </div>

                    {/* Messages */}
                    <div style={s.msMsgs}>
                      {chatMessages.length === 0 && (
                        <div style={s.msNoMsgs}>
                          <span style={{ fontSize:"40px" }}>💬</span>
                          <p style={{ color:"#A8AECB", fontSize:"14px", margin:0, fontFamily:"'Poppins',sans-serif" }}>
                            No messages yet. Start the conversation!
                          </p>
                        </div>
                      )}
                      {chatMessages.map((msg, i) => {
                        const isMe   = String(msg.senderId) === String(counselorId);
                        const isLast = i === chatMessages.length - 1;
                        return (
                          <div key={i} style={{ display:"flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom:"6px", alignItems:"flex-end", gap:"8px" }}>
                            {!isMe && (
                              <div style={s.msMsgAva}>
                                {chatStudent?.name?.[0]?.toUpperCase() || "🎓"}
                              </div>
                            )}
                            <div style={isMe ? s.msMyBubble : s.msTheirBubble}>
                              <span style={s.msMsgText}>{msg.message}</span>
                              <div style={s.msMsgMeta}>
                                <span>{new Date(msg.createdAt).toLocaleTimeString([],{ hour:"2-digit", minute:"2-digit" })}</span>
                                {isMe && isLast && <span style={{ marginLeft:"4px" }}>{msg.seen ? "✓✓" : "✓"}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {chatTyping && (
                        <div style={{ display:"flex", alignItems:"flex-end", gap:"8px", marginBottom:"6px" }}>
                          <div style={s.msMsgAva}>{chatStudent?.name?.[0]?.toUpperCase() || "🎓"}</div>
                          <div style={s.msTypingBubble}>
                            <span style={{ ...s.msDot, animationDelay:"0ms" }} />
                            <span style={{ ...s.msDot, animationDelay:"180ms" }} />
                            <span style={{ ...s.msDot, animationDelay:"360ms" }} />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input bar */}
                    <div style={s.msInputBar}>
                      <input
                        value={chatInput}
                        onChange={handleChatTyping}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                        placeholder="Type a message…"
                        style={s.msInput}
                      />
                      <button
                        onClick={sendChatMessage}
                        style={{ ...s.msSendBtn, opacity: chatInput.trim() ? 1 : 0.5 }}
                      >➤</button>
                    </div>
                  </>
                )}
              </div>

            </div>
          );
        })()}
      </main>
    </div>
  );
}

/* ─── sub-components ─────────────────────────────────────── */
function StatCard({ icon, label, value, accent, sub }) {
  return (
    <div className="animate-fadeInUp" style={{ ...s.statCard, borderTop: `4px solid ${accent}` }}>
      <div style={{ ...s.statIcon, background: accent + "18", color: accent }}>{icon}</div>
      <div style={{ ...s.statValue, color: accent }}>{value}</div>
      <div style={s.statLabel}>{label}</div>
      {sub && <div style={s.statSub}>{sub}</div>}
    </div>
  );
}

/* ─── styles ─────────────────────────────────────────────── */
const s = {
  /* layout */
  layout: {
    display: "flex",
    height: "100vh",
    fontFamily: "'Lato',sans-serif",
    background: "#F0F2F8",
    overflow: "hidden",
  },
  loadingScreen: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", height: "100vh", gap: "16px",
    background: "#F0F2F8",
  },
  loadingSpinner: {
    width: "36px", height: "36px",
    border: "3px solid rgba(91,107,216,0.2)",
    borderTopColor: "#5B6BD8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: { color: "#7B7F9E", fontFamily: "'Poppins',sans-serif", fontSize: "15px" },

  /* sidebar */
  sidebar: {
    width: "252px",
    flexShrink: 0,
    background: "linear-gradient(180deg,#1E2140 0%,#2D3166 100%)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  sideTop: {
    padding: "26px 20px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  brand: { display: "flex", alignItems: "center", gap: "12px" },
  brandLogo: {
    width: "40px", height: "40px",
    background: "rgba(255,255,255,0.1)",
    borderRadius: "12px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "22px", flexShrink: 0,
  },
  brandName: {
    fontSize: "16px", fontWeight: "700", color: "#fff",
    letterSpacing: "-0.3px", fontFamily: "'Poppins',sans-serif",
  },
  brandRole: {
    fontSize: "10px", color: "rgba(255,255,255,0.45)",
    marginTop: "2px", fontWeight: "600",
    textTransform: "uppercase", letterSpacing: "0.08em",
    fontFamily: "'Poppins',sans-serif",
  },
  nav: {
    flex: 1, padding: "16px 10px",
    display: "flex", flexDirection: "column", gap: "2px",
  },
  navItem: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "11px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px", fontWeight: "600",
    fontFamily: "'Poppins',sans-serif",
    transition: "all 0.18s",
    textAlign: "left",
    position: "relative",
  },
  navIcon: { fontSize: "17px", width: "20px", textAlign: "center", flexShrink: 0 },
  navBadge: {
    marginLeft: "auto",
    background: "#F87171",
    color: "#fff",
    fontSize: "10px",
    fontWeight: "700",
    padding: "2px 7px",
    borderRadius: "99px",
    fontFamily: "'Poppins',sans-serif",
  },
  sideBottom: {
    padding: "14px 16px 20px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  profileRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" },
  profileAvatar: {
    width: "36px", height: "36px",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "16px", fontWeight: "700", color: "#fff",
    fontFamily: "'Poppins',sans-serif", flexShrink: 0,
  },
  profileInfo: { display: "flex", flexDirection: "column" },
  profileName: { color: "#fff", fontWeight: "600", fontSize: "13px", fontFamily: "'Poppins',sans-serif" },
  profileOnline: { color: "#38C9B8", fontSize: "11px", marginTop: "1px" },
  logoutBtn: {
    width: "100%", padding: "9px 14px",
    background: "rgba(248,113,113,0.1)",
    color: "rgba(255,255,255,0.6)",
    border: "1px solid rgba(248,113,113,0.22)",
    borderRadius: "9px",
    fontSize: "13px", fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    textAlign: "left",
    transition: "all 0.2s",
  },

  /* main */
  main: {
    flex: 1, overflowY: "auto",
    padding: "28px 32px",
    display: "flex", flexDirection: "column", gap: "0",
  },
  topBar: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: "24px",
    flexWrap: "wrap", gap: "14px",
  },
  pageTitle: {
    fontSize: "24px", fontWeight: "700",
    color: "#2D3047", margin: "0 0 2px",
    fontFamily: "'Poppins',sans-serif", letterSpacing: "-0.4px",
  },
  pageSub: { fontSize: "14px", color: "#A8AECB", margin: 0 },
  topBarActions: { display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" },
  searchWrap: { position: "relative", display: "flex", alignItems: "center" },
  searchIcon: { position: "absolute", left: "12px", fontSize: "14px", zIndex: 1, pointerEvents: "none" },
  searchInput: {
    padding: "10px 14px 10px 36px",
    borderRadius: "10px",
    border: "2px solid rgba(91,107,216,0.18)",
    fontSize: "14px", outline: "none",
    width: "260px",
    fontFamily: "'Lato',sans-serif",
    background: "#fff", color: "#2D3047",
  },
  filterRow: { display: "flex", gap: "6px" },
  filterBtn: {
    padding: "6px 14px",
    borderRadius: "99px",
    border: "1.5px solid",
    fontSize: "11px", fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    transition: "all 0.15s",
  },

  /* stat cards */
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px,1fr))",
    gap: "16px", marginBottom: "20px",
  },
  statCard: {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px 18px",
    boxShadow: "0 2px 14px rgba(0,0,0,0.06)",
    display: "flex", flexDirection: "column", gap: "6px",
  },
  statIcon: {
    width: "38px", height: "38px", borderRadius: "10px",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "18px", marginBottom: "4px",
  },
  statValue: { fontSize: "30px", fontWeight: "700", lineHeight: 1, fontFamily: "'Poppins',sans-serif" },
  statLabel: { fontSize: "13px", color: "#7B7F9E", fontWeight: "600" },
  statSub:   { fontSize: "11px", color: "#A8AECB" },

  /* generic card */
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "22px",
    boxShadow: "0 2px 14px rgba(0,0,0,0.06)",
    marginBottom: "20px",
  },
  cardHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", marginBottom: "18px",
  },
  cardTitleRow: { display: "flex", alignItems: "center", gap: "9px" },
  cardTitle: {
    fontSize: "16px", fontWeight: "700",
    color: "#2D3047", margin: 0,
    fontFamily: "'Poppins',sans-serif",
  },
  cardSub: { fontSize: "12px", color: "#A8AECB" },
  dot: { width: "9px", height: "9px", borderRadius: "50%", flexShrink: 0 },
  pill: {
    padding: "4px 12px", borderRadius: "99px",
    fontSize: "12px", fontWeight: "700",
    fontFamily: "'Poppins',sans-serif",
  },

  /* two-column layout */
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px", marginBottom: "0",
  },

  /* alerts */
  alertList: { display: "flex", flexDirection: "column", gap: "10px" },
  alertRow: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "12px 14px",
    background: "#FAFBFF",
    borderRadius: "12px",
    border: "1px solid #EEF0FD",
  },
  alertAva: {
    width: "36px", height: "36px",
    background: "linear-gradient(135deg,#F87171,#F97B6B)",
    borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "15px", fontWeight: "700", color: "#fff",
    fontFamily: "'Poppins',sans-serif", flexShrink: 0,
  },
  alertBody: { flex: 1 },
  alertName: { fontWeight: "700", fontSize: "14px", color: "#2D3047", fontFamily: "'Poppins',sans-serif" },
  alertMeta: { fontSize: "12px", color: "#A8AECB", marginTop: "2px" },
  alertChatBtn: {
    padding: "7px 14px",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff", border: "none",
    borderRadius: "9px", fontSize: "12px",
    fontWeight: "600", cursor: "pointer",
    fontFamily: "'Poppins',sans-serif", flexShrink: 0,
    boxShadow: "0 4px 10px rgba(91,107,216,0.3)",
  },

  /* appointment summary */
  apptSummary: { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" },
  apptRow: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px", borderRadius: "10px",
  },
  apptLabel: { fontSize: "13px", fontWeight: "600", fontFamily: "'Poppins',sans-serif" },
  apptCount: { fontSize: "18px", fontWeight: "700", fontFamily: "'Poppins',sans-serif" },
  apptProgressWrap: {},
  apptProgressLabel: { fontSize: "12px", color: "#A8AECB", margin: "0 0 6px", fontFamily: "'Poppins',sans-serif" },
  progressBar: { height: "8px", background: "#F0F2F8", borderRadius: "99px", overflow: "hidden", marginBottom: "4px" },
  progressFill: { height: "100%", borderRadius: "99px", transition: "width 0.6s ease" },
  progressPct: { fontSize: "12px", color: "#7B7F9E", margin: 0, fontFamily: "'Poppins',sans-serif" },

  /* mood bars (overview) */
  moodBars: { display: "flex", flexDirection: "column", gap: "14px" },
  moodBarRow: { display: "flex", alignItems: "center", gap: "12px" },
  moodBarLabel: { display: "flex", alignItems: "center", gap: "6px", width: "110px", flexShrink: 0 },
  moodEmoji: { fontSize: "18px" },
  moodName: { fontSize: "13px", fontWeight: "600", color: "#2D3047", fontFamily: "'Poppins',sans-serif" },
  moodBarTrack: { flex: 1, height: "10px", background: "#F0F2F8", borderRadius: "99px", overflow: "hidden" },
  moodBarFill: { height: "100%", borderRadius: "99px", transition: "width 0.6s ease" },
  moodBarPct: { fontSize: "12px", color: "#A8AECB", width: "36px", textAlign: "right", fontFamily: "'Poppins',sans-serif" },

  /* students tab */
  studentGrid: { display: "flex", flexDirection: "column", gap: "10px" },
  studentCard: {
    display: "flex", alignItems: "center",
    gap: "16px", padding: "14px 16px",
    background: "#FAFBFF", borderRadius: "12px",
    border: "1px solid #EEF0FD",
    flexWrap: "wrap",
  },
  studentCardLeft: { display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "180px" },
  studentAva: {
    width: "38px", height: "38px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "16px", fontWeight: "700", color: "#fff",
    fontFamily: "'Poppins',sans-serif", flexShrink: 0,
  },
  studentCardName: { fontWeight: "700", fontSize: "14px", color: "#2D3047", fontFamily: "'Poppins',sans-serif" },
  studentCardEmail: { fontSize: "12px", color: "#A8AECB", marginTop: "2px" },
  sevBadge: {
    padding: "4px 12px", borderRadius: "99px",
    fontSize: "11px", fontWeight: "700",
    fontFamily: "'Poppins',sans-serif", flexShrink: 0,
  },
  sevNone: { fontSize: "12px", color: "#A8AECB" },
  apptStatus: { minWidth: "120px" },
  stDone:    { fontSize: "13px", fontWeight: "700", color: "#34D399" },
  stPending: { fontSize: "12px", fontWeight: "700", padding: "4px 10px", borderRadius: "99px" },
  stNone:    { fontSize: "12px", color: "#A8AECB" },
  studentCardActions: { display: "flex", gap: "8px", flexShrink: 0 },
  btnChat: {
    padding: "7px 14px",
    background: "#EEF0FD", color: "#5B6BD8",
    border: "1.5px solid rgba(91,107,216,0.28)",
    borderRadius: "9px", fontSize: "12px",
    fontWeight: "600", cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
  },
  btnDone: {
    padding: "7px 14px",
    background: "#E6FAF7", color: "#38C9B8",
    border: "1.5px solid rgba(56,201,184,0.3)",
    borderRadius: "9px", fontSize: "12px",
    fontWeight: "600", cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
  },

  /* analytics */
  riskBars: { display: "flex", flexDirection: "column", gap: "18px" },
  riskBarItem: {},
  riskBarHeader: { display: "flex", justifyContent: "space-between", marginBottom: "6px" },
  riskLabel: { fontSize: "13px", fontWeight: "700", fontFamily: "'Poppins',sans-serif" },
  riskCount: { fontSize: "13px", fontWeight: "700", fontFamily: "'Poppins',sans-serif" },
  riskTrack: { height: "10px", background: "#F0F2F8", borderRadius: "99px", overflow: "hidden", marginBottom: "4px" },
  riskFill: { height: "100%", borderRadius: "99px", transition: "width 0.6s ease" },
  riskPct: { fontSize: "11px", color: "#A8AECB", fontFamily: "'Poppins',sans-serif" },

  sessionGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
  },
  sessionCard: {
    padding: "14px 16px", background: "#FAFBFF",
    borderRadius: "12px", border: "1px solid #EEF0FD",
    display: "flex", flexDirection: "column", gap: "4px",
  },
  sessionIcon: { fontSize: "20px" },
  sessionValue: { fontSize: "26px", fontWeight: "700", fontFamily: "'Poppins',sans-serif", lineHeight: 1 },
  sessionLabel: { fontSize: "12px", color: "#7B7F9E", fontWeight: "500" },

  moodFullGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: "14px",
  },
  moodFullCard: {
    padding: "18px 16px", background: "#FAFBFF",
    borderRadius: "14px", border: "1px solid #EEF0FD",
    display: "flex", flexDirection: "column", gap: "4px",
  },
  moodFullEmoji: { fontSize: "28px", lineHeight: 1, marginBottom: "6px" },
  moodFullValue: { fontSize: "28px", fontWeight: "700", fontFamily: "'Poppins',sans-serif", lineHeight: 1 },
  moodFullLabel: { fontSize: "13px", fontWeight: "600", color: "#2D3047", fontFamily: "'Poppins',sans-serif" },
  moodFullPct:   { fontSize: "11px", color: "#A8AECB" },
  moodFullTrack: { height: "6px", background: "#EEF0FD", borderRadius: "99px", overflow: "hidden", marginTop: "8px" },
  moodFullFill:  { height: "100%", borderRadius: "99px", transition: "width 0.6s ease" },

  emptyBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "36px", gap: "10px",
  },
  emptyText: { color: "#A8AECB", fontSize: "14px", margin: 0, fontFamily: "'Poppins',sans-serif" },

  /* ── Schedule tab ── */
  weekNavBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: "20px", paddingBottom: "16px",
    borderBottom: "1px solid #EEF0FD",
  },
  weekNavBtn: {
    padding: "8px 16px", background: "#EEF0FD", color: "#5B6BD8",
    border: "1.5px solid rgba(91,107,216,0.25)", borderRadius: "9px",
    fontSize: "13px", fontWeight: "600", cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
  },
  weekTitle: { fontSize: "15px", fontWeight: "700", color: "#2D3047", fontFamily: "'Poppins',sans-serif" },
  todayPill: {
    marginTop: "4px", padding: "3px 12px",
    background: "#5B6BD8", color: "#fff", border: "none",
    borderRadius: "99px", fontSize: "11px", fontWeight: "600",
    cursor: "pointer", fontFamily: "'Poppins',sans-serif",
  },

  calWrap: { overflowX: "auto" },
  calRow: {
    display: "flex", borderBottom: "1px solid #F0F2F8", minWidth: "600px",
  },
  calTimeCol: {
    width: "80px", flexShrink: 0,
    fontSize: "11px", fontWeight: "600", color: "#A8AECB",
    padding: "10px 8px", textAlign: "right",
    fontFamily: "'Poppins',sans-serif",
    borderRight: "1px solid #F0F2F8",
  },
  calDayHeader: {
    flex: 1, textAlign: "center", padding: "10px 4px",
    borderRight: "1px solid #F0F2F8",
  },
  calDayName: { fontSize: "11px", fontWeight: "700", color: "#A8AECB", textTransform: "uppercase", letterSpacing: "0.06em" },
  calDayNum:  { fontSize: "13px", color: "#2D3047", marginTop: "2px", fontFamily: "'Poppins',sans-serif" },
  calSlot: {
    flex: 1, minHeight: "48px", padding: "4px 6px",
    borderRight: "1px solid #F0F2F8",
    display: "flex", alignItems: "flex-start",
  },
  lunchRow: {
    textAlign: "center", padding: "8px",
    background: "#FFF8EC",
    color: "#F9A72B", fontSize: "12px", fontWeight: "600",
    fontFamily: "'Poppins',sans-serif",
    borderBottom: "1px solid #F0F2F8",
    minWidth: "600px",
  },

  apptChip: {
    width: "100%", padding: "6px 8px",
    background: "#FAFBFF",
    borderRadius: "8px", borderLeft: "3px solid #5B6BD8",
    cursor: "pointer",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
    transition: "box-shadow 0.15s",
  },
  apptChipName: { fontSize: "12px", fontWeight: "700", color: "#2D3047", fontFamily: "'Poppins',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  apptChipMeta: { fontSize: "10px", fontWeight: "600", marginTop: "2px" },

  /* ── Reschedule modal ── */
  modalOverlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#fff", borderRadius: "20px",
    padding: "28px 32px", width: "100%", maxWidth: "420px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
  },
  modalTitle: { margin: "0 0 16px", fontSize: "18px", fontWeight: "800", color: "#2D3047", fontFamily: "'Poppins',sans-serif" },
  modalInfoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #F0F2F8" },
  modalInfoLabel: { fontSize: "12px", color: "#A8AECB", fontWeight: "600", fontFamily: "'Poppins',sans-serif" },
  modalInfoValue: { fontSize: "13px", color: "#2D3047", fontFamily: "'Poppins',sans-serif" },
  modalGroup: { marginTop: "16px" },
  modalLabel: { display: "block", fontSize: "11px", fontWeight: "700", color: "#374151", letterSpacing: "0.06em", marginBottom: "6px", fontFamily: "'Poppins',sans-serif" },
  modalInput: {
    width: "100%", padding: "10px 12px",
    border: "2px solid #E5E7EB", borderRadius: "10px",
    fontSize: "14px", color: "#1A1A2E",
    fontFamily: "'Poppins',sans-serif", boxSizing: "border-box",
    outline: "none",
  },
  modalSaveBtn: {
    flex: 1, padding: "12px 0",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff", border: "none", borderRadius: "10px",
    fontSize: "14px", fontWeight: "700", cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    boxShadow: "0 4px 14px rgba(91,107,216,0.35)",
  },
  modalCancelBtn: {
    flex: 1, padding: "12px 0",
    background: "#F3F4F8", color: "#7B7F9E",
    border: "1.5px solid #E5E7EB", borderRadius: "10px",
    fontSize: "14px", fontWeight: "600", cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
  },

  /* ── Overview mini-calendar ── */
  ovNavBtn: {
    width: "28px", height: "28px",
    background: "#EEF0FD", color: "#5B6BD8",
    border: "1.5px solid rgba(91,107,216,0.25)", borderRadius: "7px",
    fontSize: "14px", fontWeight: "700", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
  },
  ovWeekLabel: {
    fontSize: "12px", fontWeight: "600", color: "#2D3047",
    fontFamily: "'Poppins',sans-serif", whiteSpace: "nowrap",
  },
  ovTodayBtn: {
    padding: "3px 10px",
    background: "#5B6BD8", color: "#fff", border: "none",
    borderRadius: "99px", fontSize: "10px", fontWeight: "600",
    cursor: "pointer", fontFamily: "'Poppins',sans-serif",
  },
  ovCalRow: {
    display: "flex", borderBottom: "1px solid #F0F2F8", minWidth: "500px",
  },
  ovTimeCol: {
    width: "68px", flexShrink: 0,
    fontSize: "10px", fontWeight: "600", color: "#A8AECB",
    padding: "7px 6px", textAlign: "right",
    fontFamily: "'Poppins',sans-serif",
    borderRight: "1px solid #F0F2F8",
  },
  ovDayHeader: {
    flex: 1, textAlign: "center", padding: "7px 4px",
    borderRight: "1px solid #F0F2F8",
  },
  ovDayName: { fontSize: "10px", fontWeight: "700", color: "#A8AECB", textTransform: "uppercase", letterSpacing: "0.05em" },
  ovDayNum:  { fontSize: "12px", color: "#2D3047", marginTop: "2px", fontFamily: "'Poppins',sans-serif" },
  ovSlot: {
    flex: 1, minHeight: "38px", padding: "3px 4px",
    borderRight: "1px solid #F0F2F8",
    display: "flex", alignItems: "flex-start",
  },
  ovLunchRow: {
    textAlign: "center", padding: "5px",
    background: "#FFF8EC", color: "#F9A72B",
    fontSize: "10px", fontWeight: "600",
    fontFamily: "'Poppins',sans-serif",
    borderBottom: "1px solid #F0F2F8",
    minWidth: "500px",
  },
  ovChip: {
    width: "100%", padding: "4px 6px",
    background: "#FAFBFF", borderRadius: "6px",
    borderLeft: "3px solid #5B6BD8",
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  ovChipName: {
    fontSize: "10px", fontWeight: "700", color: "#2D3047",
    fontFamily: "'Poppins',sans-serif",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  ovChipSev: { fontSize: "9px", fontWeight: "600", marginTop: "1px" },

  /* ── Chat tab — inline messenger ── */
  messengerWrap: {
    display: "flex", gap: 0,
    height: "100vh",
    background: "#fff",
    borderRadius: "16px",
    boxShadow: "0 2px 14px rgba(0,0,0,0.06)",
    overflow: "hidden",
    border: "1px solid #EEF0FD",
  },
  messengerSidebar: {
    width: "300px", flexShrink: 0,
    display: "flex", flexDirection: "column",
    borderRight: "1px solid #EEF0FD",
    background: "#FAFBFF",
  },
  msHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 16px 12px",
    borderBottom: "1px solid #EEF0FD",
  },
  msHeaderTitle: {
    fontSize: "15px", fontWeight: "700",
    color: "#2D3047", fontFamily: "'Poppins',sans-serif",
  },
  msSrchWrap: {
    display: "flex", alignItems: "center", gap: "8px",
    margin: "10px 12px 6px",
    background: "#F0F2F8",
    borderRadius: "10px",
    padding: "8px 12px",
    border: "1.5px solid #EEF0FD",
  },
  msSrchIcon: { fontSize: "13px", flexShrink: 0 },
  msSrchInput: {
    flex: 1, background: "transparent",
    border: "none", outline: "none",
    color: "#2D3047", fontSize: "13px",
    fontFamily: "'Lato',sans-serif",
  },
  msConvList: { flex: 1, overflowY: "auto" },
  msEmpty: {
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: "10px", paddingTop: "50px", opacity: 0.55,
  },
  msEmptyText: {
    fontSize: "13px", color: "#A8AECB",
    margin: 0, fontFamily: "'Poppins',sans-serif",
  },
  msConvRow: {
    display: "flex", alignItems: "center", gap: "12px",
    padding: "12px 14px",
    cursor: "pointer",
    borderBottom: "1px solid #F0F2F8",
    transition: "background 0.15s",
    borderLeft: "3px solid transparent",
  },
  msConvAva: {
    width: "40px", height: "40px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "16px", fontWeight: "700", color: "#fff",
    fontFamily: "'Poppins',sans-serif", flexShrink: 0,
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  msConvInfo: { flex: 1, minWidth: 0 },
  msConvTop: {
    display: "flex", justifyContent: "space-between",
    alignItems: "baseline", marginBottom: "3px",
  },
  msConvName: {
    fontSize: "14px", fontWeight: "700",
    color: "#2D3047", fontFamily: "'Poppins',sans-serif",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    maxWidth: "130px",
  },
  msConvTime: { fontSize: "11px", color: "#A8AECB", flexShrink: 0 },
  msConvBottom: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: "6px",
  },
  msConvPreview: {
    fontSize: "12px", color: "#7B7F9E",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    flex: 1,
  },
  msUnread: {
    background: "#5B6BD8", color: "#fff",
    borderRadius: "99px", fontSize: "10px",
    fontWeight: "700", padding: "2px 7px", flexShrink: 0,
  },
  msChatPane: {
    flex: 1, display: "flex",
    flexDirection: "column", overflow: "hidden",
    background: "#F3F4F8",
  },
  msNoneSelected: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: "14px", opacity: 0.45,
  },
  msNoneTitle: {
    fontSize: "18px", fontWeight: "700",
    color: "#5B6BD8", fontFamily: "'Poppins',sans-serif",
  },
  msNoneSub: { fontSize: "13px", color: "#7B7F9E" },
  msChatHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 20px",
    background: "linear-gradient(135deg,#5B6BD8 0%,#7C6FCD 100%)",
    boxShadow: "0 2px 10px rgba(91,107,216,0.2)",
  },
  msChatAva: {
    width: "38px", height: "38px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "15px", fontWeight: "700", color: "#fff",
    border: "2px solid rgba(255,255,255,0.3)", flexShrink: 0,
  },
  msChatName: {
    fontSize: "15px", fontWeight: "700",
    color: "#fff", fontFamily: "'Poppins',sans-serif",
  },
  msChatSub: { fontSize: "12px", color: "rgba(255,255,255,0.75)", marginTop: "2px" },
  msMsgs: {
    flex: 1, padding: "16px", overflowY: "auto",
    display: "flex", flexDirection: "column",
  },
  msNoMsgs: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: "12px", opacity: 0.45, marginTop: "60px",
  },
  msMsgAva: {
    width: "28px", height: "28px", borderRadius: "50%",
    background: "#EEF2FF",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "12px", fontWeight: "700", color: "#5B6BD8", flexShrink: 0,
  },
  msMyBubble: {
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff", padding: "10px 14px",
    borderRadius: "18px 18px 4px 18px",
    maxWidth: "70%", boxShadow: "0 2px 10px rgba(91,107,216,0.3)",
  },
  msTheirBubble: {
    background: "#fff", color: "#2D3047",
    padding: "10px 14px",
    borderRadius: "18px 18px 18px 4px",
    maxWidth: "70%", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  msMsgText: {
    display: "block", fontSize: "14px",
    lineHeight: 1.6, fontFamily: "'Lato',sans-serif",
  },
  msMsgMeta: {
    display: "flex", justifyContent: "flex-end",
    fontSize: "10px", opacity: 0.7,
    marginTop: "4px", gap: "2px",
  },
  msTypingBubble: {
    background: "#fff", padding: "10px 14px",
    borderRadius: "18px 18px 18px 4px",
    display: "flex", gap: "5px", alignItems: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  msDot: {
    display: "inline-block", width: "7px", height: "7px",
    background: "#9CA3AF", borderRadius: "50%",
    animation: "typingBounce 0.9s ease infinite",
  },
  msInputBar: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "12px 16px",
    background: "#fff", borderTop: "1px solid #E5E7EB",
  },
  msInput: {
    flex: 1, padding: "11px 18px",
    borderRadius: "24px",
    border: "2px solid rgba(91,107,216,0.2)",
    outline: "none", fontSize: "14px",
    fontFamily: "'Lato',sans-serif",
    background: "#FAFBFF", color: "#2D3047",
  },
  msSendBtn: {
    width: "42px", height: "42px", borderRadius: "50%",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff", border: "none",
    fontSize: "17px", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 12px rgba(91,107,216,0.35)",
    transition: "opacity 0.2s", flexShrink: 0,
  },
};
