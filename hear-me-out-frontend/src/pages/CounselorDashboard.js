import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

const SEVERITY_COLOR = { HIGH: "#F87171", MEDIUM: "#F9A72B", LOW: "#38C9B8" };
const SEVERITY_BG = { HIGH: "#FFF0EE", MEDIUM: "#FFF8EC", LOW: "#E6FAF7" };

function CounselorDashboard() {
  const [students, setStudents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [appointments, setAppointments] = useState({});
  const [activeNav, setActiveNav] = useState("dashboard");
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudents();
    fetchAppointments();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await API.get("/users/students");
      const sorted = res.data.students.sort((a, b) => {
        const p = { HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (p[a.severity] || 4) - (p[b.severity] || 4);
      });
      setStudents(sorted);
      setFiltered(sorted);
    } catch (err) {
      console.log(err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await API.get("/appointments");
      const map = {};
      res.data.appointments.forEach((app) => {
        const studentId =
          typeof app.studentId === "object" ? app.studentId._id : app.studentId;
        map[studentId] = app;
      });
      setAppointments(map);
    } catch (err) {
      console.log(err);
    }
  };

  const handleComplete = async (appointmentId) => {
    try {
      if (!window.confirm("Mark this session as completed?")) return;
      await API.patch(`/appointments/${appointmentId}`, { status: "DONE" });
      alert("Session marked as completed");
      fetchAppointments();
    } catch (err) {
      console.error("ERROR:", err.response?.data || err.message);
    }
  };

  useEffect(() => {
    const result = students.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [search, students]);

  const openChat = (studentId) => {
    localStorage.setItem("chatStudentId", studentId);
    navigate("/chat");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    navigate("/");
  };

  const total = students.length;
  const high = students.filter((s) => s.severity === "HIGH").length;
  const medium = students.filter((s) => s.severity === "MEDIUM").length;
  const low = students.filter((s) => s.severity === "LOW").length;

  return (
    <div style={s.layout}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.sideTop}>
          <div style={s.brandRow}>
            <span style={s.brandIcon}>💙</span>
            <div>
              <div style={s.brandName}>Hear Me Out</div>
              <div style={s.brandRole}>Counselor Panel</div>
            </div>
          </div>
        </div>

        <nav style={s.nav}>
          {[
            { key: "dashboard", icon: "📊", label: "Dashboard" },
            { key: "students", icon: "👥", label: "Students" },
            { key: "chat", icon: "💬", label: "Chat" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveNav(item.key)}
              style={{
                ...s.navItem,
                background: activeNav === item.key
                  ? "rgba(255,255,255,0.15)"
                  : "transparent",
                color: activeNav === item.key ? "#fff" : "rgba(255,255,255,0.65)",
              }}
            >
              <span style={s.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={s.sideBottom}>
          <div style={s.counselorCard}>
            <div style={s.counselorAvatar}>👨‍⚕️</div>
            <div>
              <div style={s.counselorName}>Counselor</div>
              <div style={s.counselorStatus}>● Active</div>
            </div>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn}>
            🚪 Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={s.main}>
        {/* Top bar */}
        <div style={s.topBar}>
          <div>
            <h1 style={s.pageTitle}>Overview</h1>
            <p style={s.pageSubtitle}>Student mental health dashboard</p>
          </div>
          <div style={s.topBarRight}>
            <div style={s.searchWrap}>
              <span style={s.searchIcon}>🔍</span>
              <input
                placeholder="Search student…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={s.searchInput}
              />
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div style={s.statsGrid}>
          <StatCard icon="👥" title="Total Students" value={total} accent="#5B6BD8" />
          <StatCard icon="🚨" title="High Risk" value={high} accent="#F87171" />
          <StatCard icon="⚠️" title="Medium Risk" value={medium} accent="#F9A72B" />
          <StatCard icon="✅" title="Low Risk" value={low} accent="#38C9B8" />
        </div>

        {/* High-risk alerts */}
        {high > 0 && (
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionDot("#FF6B6B")} />
              <h2 style={s.sectionTitle}>High Risk Students</h2>
              <span style={s.badge("#FF6B6B")}>{high}</span>
            </div>
            <div style={s.alertGrid}>
              {students
                .filter((st) => st.severity === "HIGH")
                .map((st) => (
                  <div key={st._id} style={s.alertCard}>
                    <div style={s.alertAvatar}>🎓</div>
                    <div style={s.alertInfo}>
                      <div style={s.alertName}>{st.name}</div>
                      <div style={s.alertSub}>Needs immediate attention</div>
                    </div>
                    <button
                      onClick={() => openChat(st._id)}
                      style={s.alertBtn}
                    >
                      Chat now →
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Student table */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={s.sectionDot("#6C63FF")} />
            <h2 style={s.sectionTitle}>All Students</h2>
            <span style={s.badge("#6C63FF")}>{filtered.length}</span>
          </div>

          {filtered.length === 0 ? (
            <div style={s.empty}>No students found</div>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <Th>Student</Th>
                    <Th>Email</Th>
                    <Th>Risk Level</Th>
                    <Th>Session Status</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student, idx) => {
                    const app = appointments[student._id];
                    const sev = student.severity;

                    return (
                      <tr
                        key={student._id}
                        style={{
                          ...s.tr,
                          background: idx % 2 === 0 ? "#fff" : "#FAFBFF",
                        }}
                      >
                        <td style={s.td}>
                          <div style={s.studentCell}>
                            <div style={s.studentAvatar}>
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <span style={s.studentName}>{student.name}</span>
                          </div>
                        </td>
                        <td style={{ ...s.td, color: "#6B7280", fontSize: "13px" }}>
                          {student.email}
                        </td>
                        <td style={s.td}>
                          <span
                            style={{
                              ...s.sevBadge,
                              background: SEVERITY_BG[sev] || "#F9FAFB",
                              color: SEVERITY_COLOR[sev] || "#6B7280",
                              border: `1.5px solid ${SEVERITY_COLOR[sev] || "#E5E7EB"}`,
                            }}
                          >
                            {sev || "N/A"}
                          </span>
                        </td>
                        <td style={s.td}>
                          {app ? (
                            app.status === "DONE" ? (
                              <span style={s.statusDone}>✓ Completed</span>
                            ) : (
                              <span style={s.statusPending}>{app.status}</span>
                            )
                          ) : (
                            <span style={s.statusNone}>No appointment</span>
                          )}
                        </td>
                        <td style={s.td}>
                          <div style={s.actionRow}>
                            <button
                              onClick={() => openChat(student._id)}
                              style={s.chatBtn}
                            >
                              💬 Chat
                            </button>
                            {app && app.status !== "DONE" && (
                              <button
                                onClick={() => handleComplete(app._id)}
                                style={s.doneBtn}
                              >
                                ✓ Complete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, title, value, accent }) {
  return (
    <div className="animate-fadeInUp" style={{ ...s.statCard, borderTop: `4px solid ${accent}` }}>
      <div style={{ ...s.statIcon, background: accent + "18", color: accent }}>{icon}</div>
      <div style={s.statValue}>{value}</div>
      <div style={s.statTitle}>{title}</div>
    </div>
  );
}

function Th({ children }) {
  return <th style={s.th}>{children}</th>;
}

const s = {
  layout: {
    display: "flex",
    height: "100vh",
    fontFamily: "'Lato',sans-serif",
    background: "#F0F2F8",
  },
  sidebar: {
    width: "240px",
    background: "linear-gradient(180deg,#2D3047 0%,#3D4166 100%)",
    display: "flex",
    flexDirection: "column",
    padding: "0",
    flexShrink: 0,
  },
  sideTop: {
    padding: "28px 20px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  brandIcon: { fontSize: "32px", lineHeight: 1 },
  brandName: {
    fontWeight: "700",
    fontSize: "16px",
    color: "white",
    letterSpacing: "-0.3px",
    fontFamily: "'Poppins',sans-serif",
  },
  brandRole: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.55)",
    marginTop: "2px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontFamily: "'Poppins',sans-serif",
  },
  nav: {
    padding: "16px 12px",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "11px 14px",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    fontFamily: "'Poppins',sans-serif",
    transition: "all 0.2s",
    textAlign: "left",
  },
  navIcon: { fontSize: "18px", width: "22px", textAlign: "center" },
  sideBottom: {
    padding: "16px 20px 24px",
    borderTop: "1px solid rgba(255,255,255,0.1)",
  },
  counselorCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  counselorAvatar: {
    width: "36px",
    height: "36px",
    background: "rgba(255,255,255,0.15)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    flexShrink: 0,
  },
  counselorName: { color: "white", fontWeight: "600", fontSize: "14px", fontFamily: "'Poppins',sans-serif" },
  counselorStatus: { color: "#38C9B8", fontSize: "11px", marginTop: "2px" },
  logoutBtn: {
    marginTop: "12px",
    width: "100%",
    padding: "10px 14px",
    background: "rgba(248,113,113,0.12)",
    color: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    textAlign: "left",
    transition: "all 0.2s",
  },

  main: {
    flex: 1,
    overflowY: "auto",
    padding: "32px 36px",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "16px",
  },
  pageTitle: {
    fontSize: "26px",
    fontWeight: "700",
    color: "#2D3047",
    letterSpacing: "-0.5px",
    marginBottom: "4px",
    fontFamily: "'Poppins',sans-serif",
  },
  pageSubtitle: {
    fontSize: "15px",
    color: "#7B7F9E",
  },
  topBarRight: { display: "flex", gap: "12px", alignItems: "center" },
  searchWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchIcon: {
    position: "absolute",
    left: "12px",
    fontSize: "15px",
    zIndex: 1,
    pointerEvents: "none",
  },
  searchInput: {
    padding: "10px 14px 10px 38px",
    borderRadius: "12px",
    border: "2px solid rgba(91,107,216,0.2)",
    fontSize: "15px",
    outline: "none",
    width: "240px",
    fontFamily: "'Lato',sans-serif",
    background: "#fff",
    color: "#2D3047",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "18px",
    marginBottom: "32px",
  },
  statCard: {
    background: "#fff",
    borderRadius: "18px",
    padding: "22px 20px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  statIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    marginBottom: "4px",
  },
  statValue: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#2D3047",
    lineHeight: 1,
    fontFamily: "'Poppins',sans-serif",
  },
  statTitle: {
    fontSize: "13px",
    color: "#7B7F9E",
    fontWeight: "500",
  },

  section: {
    background: "#fff",
    borderRadius: "20px",
    padding: "24px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
    marginBottom: "24px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "18px",
  },
  sectionDot: (c) => ({
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: c,
    flexShrink: 0,
  }),
  sectionTitle: {
    fontSize: "17px",
    fontWeight: "700",
    color: "#2D3047",
    flex: 1,
    fontFamily: "'Poppins',sans-serif",
  },
  badge: (c) => ({
    background: c + "18",
    color: c,
    padding: "3px 10px",
    borderRadius: "99px",
    fontSize: "12px",
    fontWeight: "700",
  }),

  alertGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  alertCard: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "14px 16px",
    background: "#FFF5F5",
    borderRadius: "14px",
    border: "1.5px solid #FFD5D5",
  },
  alertAvatar: {
    width: "38px",
    height: "38px",
    background: "#FFE0E0",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    flexShrink: 0,
  },
  alertInfo: { flex: 1 },
  alertName: { fontWeight: "700", fontSize: "15px", color: "#2D3047", fontFamily: "'Poppins',sans-serif" },
  alertSub: { fontSize: "13px", color: "#F87171", marginTop: "2px" },
  alertBtn: {
    padding: "8px 16px",
    background: "#F87171",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    flexShrink: 0,
    fontFamily: "'Poppins',sans-serif",
  },

  tableWrap: {
    overflowX: "auto",
    borderRadius: "12px",
    border: "1.5px solid #E5E7EB",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  thead: {
    background: "#F9FAFB",
  },
  th: {
    padding: "13px 16px",
    textAlign: "left",
    fontSize: "11px",
    fontWeight: "700",
    color: "#A8AECB",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
    fontFamily: "'Poppins',sans-serif",
  },
  tr: {
    borderTop: "1px solid #F3F4F6",
    transition: "background 0.15s",
  },
  td: {
    padding: "14px 16px",
    verticalAlign: "middle",
    fontSize: "14px",
    color: "#2D3047",
  },
  studentCell: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  studentAvatar: {
    width: "34px",
    height: "34px",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "white",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "14px",
    flexShrink: 0,
    fontFamily: "'Poppins',sans-serif",
  },
  studentName: { fontWeight: "600", fontFamily: "'Poppins',sans-serif" },
  sevBadge: {
    padding: "4px 12px",
    borderRadius: "99px",
    fontSize: "12px",
    fontWeight: "700",
    display: "inline-block",
  },
  statusDone: {
    color: "#34D399",
    fontWeight: "700",
    fontSize: "13px",
  },
  statusPending: {
    color: "#F9A72B",
    fontWeight: "700",
    fontSize: "13px",
  },
  statusNone: {
    color: "#A8AECB",
    fontSize: "13px",
  },
  actionRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  chatBtn: {
    padding: "7px 14px",
    background: "#EEF0FD",
    color: "#5B6BD8",
    border: "1.5px solid rgba(91,107,216,0.3)",
    borderRadius: "10px",
    fontSize: "12.5px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    transition: "all 0.15s",
  },
  doneBtn: {
    padding: "7px 14px",
    background: "#E6FAF7",
    color: "#38C9B8",
    border: "1.5px solid rgba(56,201,184,0.35)",
    borderRadius: "10px",
    fontSize: "12.5px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    transition: "all 0.15s",
  },
  empty: {
    padding: "32px",
    textAlign: "center",
    color: "#A8AECB",
    fontSize: "15px",
  },
};

export default CounselorDashboard;
