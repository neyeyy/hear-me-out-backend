import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

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
  { key: "chat",      icon: "💬", label: "Chat"      }, // shows student picker, then navigates
];

/* ─── component ─────────────────────────────────────────── */
export default function CounselorDashboard() {
  const [tab,          setTab]          = useState("overview");
  const [students,     setStudents]     = useState([]);
  const [appointments, setAppointments] = useState({});
  const [analytics,    setAnalytics]    = useState(null);
  const [search,       setSearch]       = useState("");
  const [sevFilter,    setSevFilter]    = useState("ALL");
  const [loading,      setLoading]      = useState(true);
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
      const sorted = (res.data.students || []).sort(
        (a, b) => (SEV_ORDER[a.severity] || 4) - (SEV_ORDER[b.severity] || 4)
      );
      setStudents(sorted);
    } catch (e) { console.log(e); }
  };

  const fetchAppointments = async () => {
    try {
      const res = await API.get("/appointments");
      const map = {};
      (res.data.appointments || []).forEach(app => {
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

  const handleComplete = async (appointmentId) => {
    if (!window.confirm("Mark this session as completed?")) return;
    try {
      await API.patch(`/appointments/${appointmentId}`, { status: "DONE" });
      fetchAppointments();
    } catch (e) { console.error(e.response?.data || e.message); }
  };

  const openChat = (studentId) => {
    localStorage.setItem("chatStudentId", studentId);
    navigate("/chat");
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

  const highStudents = students.filter(s => s.severity === "HIGH");

  const filteredStudents = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = (s.name  || "").toLowerCase().includes(q) ||
                        (s.email || "").toLowerCase().includes(q);
    const matchSev = sevFilter === "ALL" || s.severity === sevFilter;
    return matchSearch && matchSev;
  });

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
      <main style={s.main}>

        {/* ── Top bar ── */}
        <div style={s.topBar}>
          <div>
            <h1 style={s.pageTitle}>
              {tab === "overview"  && `${greeting}, ${counselorName.split(" ")[0]} 👋`}
              {tab === "students"  && "Students"}
              {tab === "analytics" && "Analytics"}
              {tab === "chat"      && "Chat"}
            </h1>
            <p style={s.pageSub}>
              {new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
            </p>
          </div>
          {(tab === "students" || tab === "chat") && (
            <div style={s.topBarActions}>
              <div style={s.searchWrap}>
                <span style={s.searchIcon}>🔍</span>
                <input
                  placeholder={tab === "chat" ? "Search student to chat…" : "Search by name or email…"}
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
        </div>

        {/* ══════════ OVERVIEW TAB ══════════ */}
        {tab === "overview" && (
          <>
            {/* Stat cards */}
            <div style={s.statsGrid}>
              <StatCard icon="👥" label="Total Students"  value={total}  accent="#5B6BD8" sub={`${high} need attention`} />
              <StatCard icon="🚨" label="High Risk"       value={high}   accent="#F87171" sub="Immediate action needed" />
              <StatCard icon="⚠️" label="Medium Risk"     value={medium} accent="#F9A72B" sub="Monitoring required" />
              <StatCard icon="📅" label="Pending Sessions" value={pending} accent="#7C6FCD" sub={`${done} completed`} />
            </div>

            <div style={s.twoCol}>
              {/* High risk alerts */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitleRow}>
                    <span style={{ ...s.dot, background: "#F87171" }} />
                    <h2 style={s.cardTitle}>Urgent Alerts</h2>
                  </div>
                  <span style={{ ...s.pill, background:"#FFF0EE", color:"#F87171" }}>
                    {highStudents.length} student{highStudents.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {highStudents.length === 0 ? (
                  <div style={s.emptyBox}>
                    <span style={{ fontSize:"32px" }}>✅</span>
                    <p style={s.emptyText}>No high-risk students right now</p>
                  </div>
                ) : (
                  <div style={s.alertList}>
                    {highStudents.map(st => (
                      <div key={st._id} style={s.alertRow}>
                        <div style={s.alertAva}>{st.name.charAt(0).toUpperCase()}</div>
                        <div style={s.alertBody}>
                          <div style={s.alertName}>{st.name}</div>
                          <div style={s.alertMeta}>Needs immediate attention</div>
                        </div>
                        <button onClick={() => openChat(st._id)} style={s.alertChatBtn}>
                          💬 Chat
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Appointment summary */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitleRow}>
                    <span style={{ ...s.dot, background: "#7C6FCD" }} />
                    <h2 style={s.cardTitle}>Appointments</h2>
                  </div>
                </div>

                <div style={s.apptSummary}>
                  {[
                    { label:"Pending",   value: pending, color:"#F9A72B", bg:"#FFF8EC" },
                    { label:"Ongoing",   value: Object.values(appointments).filter(a=>a.status==="ONGOING").length, color:"#5B6BD8", bg:"#EEF0FD" },
                    { label:"Completed", value: done,    color:"#38C9B8", bg:"#E6FAF7" },
                  ].map(row => (
                    <div key={row.label} style={{ ...s.apptRow, background: row.bg }}>
                      <span style={{ ...s.apptLabel, color: row.color }}>{row.label}</span>
                      <span style={{ ...s.apptCount, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <div style={s.apptProgressWrap}>
                  <p style={s.apptProgressLabel}>Completion rate</p>
                  <div style={s.progressBar}>
                    <div style={{
                      ...s.progressFill,
                      width: (pending + done) > 0
                        ? `${Math.round(done / (pending + done) * 100)}%`
                        : "0%",
                      background: "linear-gradient(90deg,#38C9B8,#5B6BD8)",
                    }} />
                  </div>
                  <p style={s.progressPct}>
                    {(pending + done) > 0 ? Math.round(done / (pending + done) * 100) : 0}% complete
                  </p>
                </div>
              </div>
            </div>

            {/* Mood snapshot */}
            {analytics?.moods?.length > 0 && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitleRow}>
                    <span style={{ ...s.dot, background: "#5B6BD8" }} />
                    <h2 style={s.cardTitle}>Mood Snapshot</h2>
                  </div>
                  <span style={s.cardSub}>{totalMoods} entries total</span>
                </div>
                <div style={s.moodBars}>
                  {analytics.moods.map(m => {
                    const meta = MOOD_META[m._id] || { emoji:"❓", color:"#ccc" };
                    const pct  = totalMoods > 0 ? Math.round(m.count / totalMoods * 100) : 0;
                    return (
                      <div key={m._id} style={s.moodBarRow}>
                        <div style={s.moodBarLabel}>
                          <span style={s.moodEmoji}>{meta.emoji}</span>
                          <span style={s.moodName}>{m._id}</span>
                        </div>
                        <div style={s.moodBarTrack}>
                          <div style={{ ...s.moodBarFill, width:`${pct}%`, background: meta.color }} />
                        </div>
                        <span style={s.moodBarPct}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════ STUDENTS TAB ══════════ */}
        {tab === "students" && (
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitleRow}>
                <span style={{ ...s.dot, background: "#5B6BD8" }} />
                <h2 style={s.cardTitle}>All Students</h2>
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
              <div style={s.studentGrid}>
                {filteredStudents.map(student => {
                  const app = appointments[student._id];
                  const sev = student.severity;
                  return (
                    <div key={student._id} style={s.studentCard}>
                      {/* Left: avatar + info */}
                      <div style={s.studentCardLeft}>
                        <div style={{
                          ...s.studentAva,
                          background: `linear-gradient(135deg,${SEV_COLOR[sev] || "#5B6BD8"}99,${SEV_COLOR[sev] || "#7C6FCD"})`,
                        }}>
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={s.studentCardName}>{student.name}</div>
                          <div style={s.studentCardEmail}>{student.email}</div>
                        </div>
                      </div>

                      {/* Risk badge */}
                      {sev ? (
                        <span style={{
                          ...s.sevBadge,
                          background: SEV_BG[sev],
                          color: SEV_COLOR[sev],
                          border: `1.5px solid ${SEV_COLOR[sev]}55`,
                        }}>
                          {sev === "HIGH" ? "🔴" : sev === "MEDIUM" ? "🟡" : "🟢"} {sev}
                        </span>
                      ) : (
                        <span style={s.sevNone}>No assessment</span>
                      )}

                      {/* Appointment status */}
                      <div style={s.apptStatus}>
                        {app ? (
                          app.status === "DONE"
                            ? <span style={s.stDone}>✓ Completed</span>
                            : <span style={{
                                ...s.stPending,
                                color: app.status === "ONGOING" ? "#5B6BD8" : "#F9A72B",
                                background: app.status === "ONGOING" ? "#EEF0FD" : "#FFF8EC",
                              }}>{app.status}</span>
                        ) : (
                          <span style={s.stNone}>No appointment</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={s.studentCardActions}>
                        <button onClick={() => openChat(student._id)} style={s.btnChat}>
                          💬 Chat
                        </button>
                        {app && app.status !== "DONE" && (
                          <button onClick={() => handleComplete(app._id)} style={s.btnDone}>
                            ✓ Done
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══════════ ANALYTICS TAB ══════════ */}
        {tab === "analytics" && (
          <>
            {/* Risk distribution */}
            <div style={s.twoCol}>
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitleRow}>
                    <span style={{ ...s.dot, background:"#F87171" }} />
                    <h2 style={s.cardTitle}>Risk Distribution</h2>
                  </div>
                  <span style={s.cardSub}>{total} students</span>
                </div>
                <div style={s.riskBars}>
                  {[
                    { label:"High Risk",   value: high,   color:"#F87171", bg:"#FFF0EE" },
                    { label:"Medium Risk", value: medium, color:"#F9A72B", bg:"#FFF8EC" },
                    { label:"Low Risk",    value: low,    color:"#38C9B8", bg:"#E6FAF7" },
                  ].map(r => (
                    <div key={r.label} style={s.riskBarItem}>
                      <div style={s.riskBarHeader}>
                        <span style={{ ...s.riskLabel, color: r.color }}>{r.label}</span>
                        <span style={{ ...s.riskCount, color: r.color }}>{r.value}</span>
                      </div>
                      <div style={s.riskTrack}>
                        <div style={{
                          ...s.riskFill,
                          width: total > 0 ? `${Math.round(r.value/total*100)}%` : "0%",
                          background: r.color,
                        }} />
                      </div>
                      <span style={s.riskPct}>
                        {total > 0 ? Math.round(r.value/total*100) : 0}% of students
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Session stats */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitleRow}>
                    <span style={{ ...s.dot, background:"#7C6FCD" }} />
                    <h2 style={s.cardTitle}>Session Overview</h2>
                  </div>
                </div>
                <div style={s.sessionGrid}>
                  {[
                    { label:"Total Sessions", value: Object.keys(appointments).length, icon:"📋", color:"#5B6BD8" },
                    { label:"Completed",       value: done,    icon:"✅", color:"#38C9B8" },
                    { label:"Pending",         value: pending, icon:"⏳", color:"#F9A72B" },
                    { label:"Ongoing",         value: Object.values(appointments).filter(a=>a.status==="ONGOING").length, icon:"🔄", color:"#7C6FCD" },
                  ].map(item => (
                    <div key={item.label} style={{ ...s.sessionCard, borderLeft:`4px solid ${item.color}` }}>
                      <span style={s.sessionIcon}>{item.icon}</span>
                      <div style={{ ...s.sessionValue, color: item.color }}>{item.value}</div>
                      <div style={s.sessionLabel}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mood breakdown */}
            <div style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardTitleRow}>
                  <span style={{ ...s.dot, background:"#5B6BD8" }} />
                  <h2 style={s.cardTitle}>Mood Breakdown</h2>
                </div>
                <span style={s.cardSub}>{totalMoods} mood entries recorded</span>
              </div>

              {totalMoods === 0 ? (
                <div style={s.emptyBox}>
                  <span style={{ fontSize:"32px" }}>📊</span>
                  <p style={s.emptyText}>No mood data yet</p>
                </div>
              ) : (
                <div style={s.moodFullGrid}>
                  {(analytics?.moods || []).map(m => {
                    const meta = MOOD_META[m._id] || { emoji:"❓", color:"#ccc" };
                    const pct  = Math.round(m.count / totalMoods * 100);
                    return (
                      <div key={m._id} style={{ ...s.moodFullCard, borderTop:`4px solid ${meta.color}` }}>
                        <span style={s.moodFullEmoji}>{meta.emoji}</span>
                        <div style={{ ...s.moodFullValue, color: meta.color }}>{m.count}</div>
                        <div style={s.moodFullLabel}>{m._id}</div>
                        <div style={s.moodFullPct}>{pct}% of entries</div>
                        <div style={s.moodFullTrack}>
                          <div style={{ ...s.moodFullFill, width:`${pct}%`, background: meta.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Students needing follow-up */}
            {medium > 0 && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.cardTitleRow}>
                    <span style={{ ...s.dot, background:"#F9A72B" }} />
                    <h2 style={s.cardTitle}>Medium Risk — Follow Up</h2>
                  </div>
                  <span style={{ ...s.pill, background:"#FFF8EC", color:"#F9A72B" }}>{medium}</span>
                </div>
                <div style={s.alertList}>
                  {students.filter(s => s.severity === "MEDIUM").map(st => {
                    const app = appointments[st._id];
                    return (
                      <div key={st._id} style={{ ...s.alertRow, borderLeft:"3px solid #F9A72B" }}>
                        <div style={{ ...s.alertAva, background:"linear-gradient(135deg,#F9A72B,#FFD166)" }}>
                          {st.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={s.alertBody}>
                          <div style={s.alertName}>{st.name}</div>
                          <div style={s.alertMeta}>{st.email}</div>
                        </div>
                        <div style={{ display:"flex", gap:"8px" }}>
                          {app && app.status !== "DONE" && (
                            <button onClick={() => handleComplete(app._id)} style={s.btnDone}>
                              ✓ Done
                            </button>
                          )}
                          <button onClick={() => openChat(st._id)} style={s.alertChatBtn}>
                            💬 Chat
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════ CHAT TAB ══════════ */}
        {tab === "chat" && (
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardTitleRow}>
                <span style={{ ...s.dot, background:"#5B6BD8" }} />
                <h2 style={s.cardTitle}>Select a Student to Chat</h2>
              </div>
              <span style={{ ...s.pill, background:"#EEF0FD", color:"#5B6BD8" }}>
                {students.length} students
              </span>
            </div>

            {students.length === 0 ? (
              <div style={s.emptyBox}>
                <span style={{ fontSize:"32px" }}>👥</span>
                <p style={s.emptyText}>No students registered yet</p>
              </div>
            ) : (
              <div style={s.chatPickerList}>
                {students
                  .filter(st => {
                    const q = search.toLowerCase();
                    return (st.name  || "").toLowerCase().includes(q) ||
                           (st.email || "").toLowerCase().includes(q);
                  })
                  .map(st => {
                    const sev = st.severity;
                    const app = appointments[st._id];
                    return (
                      <div key={st._id} style={s.chatPickerRow}>
                        {/* Avatar */}
                        <div style={{
                          ...s.chatPickerAva,
                          background: sev
                            ? `linear-gradient(135deg,${SEV_COLOR[sev]}99,${SEV_COLOR[sev]})`
                            : "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
                        }}>
                          {st.name.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div style={s.chatPickerInfo}>
                          <div style={s.chatPickerName}>{st.name}</div>
                          <div style={s.chatPickerEmail}>{st.email}</div>
                        </div>

                        {/* Risk + appt badges */}
                        <div style={s.chatPickerMeta}>
                          {sev && (
                            <span style={{
                              ...s.sevBadge,
                              background: SEV_BG[sev],
                              color: SEV_COLOR[sev],
                              border: `1.5px solid ${SEV_COLOR[sev]}55`,
                            }}>
                              {sev === "HIGH" ? "🔴" : sev === "MEDIUM" ? "🟡" : "🟢"} {sev}
                            </span>
                          )}
                          {app && (
                            <span style={{
                              fontSize:"11px", fontWeight:"600",
                              fontFamily:"'Poppins',sans-serif",
                              padding:"3px 9px", borderRadius:"99px",
                              background: app.status==="DONE" ? "#E6FAF7" : "#FFF8EC",
                              color: app.status==="DONE" ? "#38C9B8" : "#F9A72B",
                            }}>
                              {app.status === "DONE" ? "✓ Done" : app.status}
                            </span>
                          )}
                        </div>

                        {/* Chat button */}
                        <button
                          onClick={() => openChat(st._id)}
                          style={s.chatPickerBtn}
                        >
                          💬 Open Chat
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
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

  /* chat tab — student picker */
  chatPickerList: { display: "flex", flexDirection: "column", gap: "8px" },
  chatPickerRow: {
    display: "flex", alignItems: "center", gap: "14px",
    padding: "14px 16px",
    background: "#FAFBFF",
    borderRadius: "12px",
    border: "1px solid #EEF0FD",
    transition: "box-shadow 0.15s",
    flexWrap: "wrap",
  },
  chatPickerAva: {
    width: "42px", height: "42px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "18px", fontWeight: "700", color: "#fff",
    fontFamily: "'Poppins',sans-serif", flexShrink: 0,
    boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
  },
  chatPickerInfo: { flex: 1, minWidth: "140px" },
  chatPickerName: {
    fontSize: "15px", fontWeight: "700",
    color: "#2D3047", fontFamily: "'Poppins',sans-serif",
  },
  chatPickerEmail: { fontSize: "12px", color: "#A8AECB", marginTop: "2px" },
  chatPickerMeta: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" },
  chatPickerBtn: {
    padding: "9px 18px",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff", border: "none",
    borderRadius: "10px",
    fontSize: "13px", fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    boxShadow: "0 4px 12px rgba(91,107,216,0.28)",
    flexShrink: 0,
    transition: "opacity 0.15s",
  },
};
