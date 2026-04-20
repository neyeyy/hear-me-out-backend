import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../../services/api";
import MoodCalendar from "../../components/MoodCalendar";

const MOODS = [
  {
    key: "HAPPY",
    emoji: "😊",
    label: "Happy",
    gradient: "linear-gradient(135deg,#4ECDC4 0%,#44A08D 100%)",
    glow: "rgba(78,205,196,0.4)",
    quote: "Your joy matters — let it fill every corner of your day. You deserve every bit of this happiness. Keep shining, the world is brighter with you in it! 🌟",
  },
  {
    key: "SAD",
    emoji: "😢",
    label: "Sad",
    gradient: "linear-gradient(135deg,#6C63FF 0%,#9B59B6 100%)",
    glow: "rgba(108,99,255,0.4)",
    quote: "It takes real strength to sit with hard feelings. You are not alone in this — every storm runs out of rain. Reaching out today is already an act of courage. 💙",
  },
  {
    key: "STRESSED",
    emoji: "😫",
    label: "Stressed",
    gradient: "linear-gradient(135deg,#F7971E 0%,#FFD200 100%)",
    glow: "rgba(247,151,30,0.4)",
    quote: "You have survived 100% of your hardest days — that record stays perfect. Take one slow breath. You don't have to solve everything right now. You are enough. 🌿",
  },
  {
    key: "ANXIOUS",
    emoji: "😰",
    label: "Anxious",
    gradient: "linear-gradient(135deg,#FF6B6B 0%,#FF8E53 100%)",
    glow: "rgba(255,107,107,0.4)",
    quote: "Right here, right now — you are safe. Anxiety is your mind trying to protect you, not predict the future. This wave will pass, and you will still be standing. 🌈",
  },
];

const STATUS_MAP = {
  PENDING: { label: "Pending",   color: "#F7971E", bg: "rgba(247,151,30,0.1)",  border: "rgba(247,151,30,0.3)" },
  ONGOING: { label: "Ongoing",   color: "#6C63FF", bg: "rgba(108,99,255,0.1)", border: "rgba(108,99,255,0.3)" },
  DONE:    { label: "Completed", color: "#4ECDC4", bg: "rgba(78,205,196,0.1)",  border: "rgba(78,205,196,0.3)" },
};

// step: "pick" | "note" | "dashboard"
export default function StudentDashboard() {
  const location = useLocation();
  const [step, setStep]           = useState(location.state?.step || "pick");
  const [selected, setSelected]   = useState(null);
  const [note, setNote]           = useState("");
  const [appointment, setAppt]    = useState(null);
  const [hovered, setHovered]     = useState(null);
  const [calKey, setCalKey]       = useState(0);
  // profile change-password fields
  const [curPw, setCurPw]         = useState("");
  const [newPw, setNewPw]         = useState("");
  const [conPw, setConPw]         = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg,    setPwMsg]     = useState({ text:"", ok:false });
  const navigate = useNavigate();

  const userName  = localStorage.getItem("name")  || "Student";
  const userEmail = localStorage.getItem("email") || "";

  useEffect(() => {
    fetchAppointment();
    const iv = setInterval(fetchAppointment, 5000);
    return () => clearInterval(iv);
  }, []);

  const fetchAppointment = async () => {
    try {
      const res = await API.get("/appointments/my");
      const d = res.data;
      setAppt(Array.isArray(d) ? (d[0] || null) : d);
    } catch (e) { console.log(e); }
  };

  const handleSave = async () => {
    try {
      await API.post("/moods", { mood: selected.key, note });
      setTimeout(fetchAppointment, 600);
    } catch (e) { console.log(e); }
    setCalKey(k => k + 1);   // force calendar remount → fresh fetch
    setStep("dashboard");
  };

  const handleReset = () => {
    setStep("pick");
    setSelected(null);
    setNote("");
  };

  const handleLogout = () => {
    ["token","role","userId","name","email"].forEach(k => localStorage.removeItem(k));
    navigate("/");
  };

  const handleChangePassword = async () => {
    if (!curPw || !newPw || !conPw) { setPwMsg({ text:"Please fill in all fields.", ok:false }); return; }
    if (newPw !== conPw)            { setPwMsg({ text:"New passwords do not match.", ok:false }); return; }
    if (newPw.length < 6)           { setPwMsg({ text:"Password must be at least 6 characters.", ok:false }); return; }
    try {
      setPwLoading(true); setPwMsg({ text:"", ok:false });
      const res = await API.patch("/auth/change-password", { currentPassword: curPw, newPassword: newPw });
      if (res.data.success) {
        setPwMsg({ text:"Password changed successfully!", ok:true });
        setCurPw(""); setNewPw(""); setConPw("");
      } else {
        setPwMsg({ text: res.data.message || "Failed to change password.", ok:false });
      }
    } catch (e) {
      setPwMsg({ text: e.response?.data?.message || "Error changing password.", ok:false });
    } finally { setPwLoading(false); }
  };

  const apptSt = appointment?.status ? STATUS_MAP[appointment.status] : null;

  return (
    <div style={p.page}>
      <div style={{ ...p.blob, width:520, height:520, top:-200, right:-160 }} />
      <div style={{ ...p.blob, width:360, height:360, bottom:-130, left:-110, background:"rgba(108,99,255,0.06)" }} />
      <div style={{ ...p.blob, width:220, height:220, top:"40%", left:"6%",  background:"rgba(78,205,196,0.05)" }} />

      {/* ────────────── PICK MOOD ────────────── */}
      {step === "pick" && (
        <div className="animate-fadeInUp" style={p.wrap}>

          {/* Header — date only, no buttons */}
          <div style={p.topBar}>
            <p style={p.topDate}>
              {new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
            </p>
          </div>

          {/* Hero */}
          <div style={p.hero}>
            <div style={p.heroRing}>
              <span style={{fontSize:"36px"}}>💙</span>
            </div>
            <h1 style={p.h1}>How are you feeling today?</h1>
            <p style={p.heroSub}>Check in with yourself. Your wellbeing matters.</p>
          </div>

          {/* Mood grid */}
          <div style={p.grid}>
            {MOODS.map(m => {
              const isHov = hovered === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => { setSelected(m); setStep("note"); }}
                  onMouseEnter={() => setHovered(m.key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...p.card,
                    background: m.gradient,
                    boxShadow: isHov ? `0 22px 52px ${m.glow}` : "0 6px 22px rgba(0,0,0,0.2)",
                    transform:  isHov ? "translateY(-7px) scale(1.03)" : "translateY(0) scale(1)",
                  }}
                >
                  <div style={p.cardShine} />
                  <span style={p.cardEmoji}>{m.emoji}</span>
                  <span style={p.cardLabel}>{m.label}</span>
                  <div style={p.cardArrow}>→</div>
                </button>
              );
            })}
          </div>

          <p style={p.hint}>Tap a mood to continue</p>
        </div>
      )}

      {/* ────────────── NOTE STEP ────────────── */}
      {step === "note" && selected && (
        <div style={{ ...p.notePage, background: selected.gradient }}>
          <div style={p.noteBlob1} />
          <div style={p.noteBlob2} />
          <button onClick={() => setStep("pick")} style={p.backBtn}>← Back</button>

          <div style={p.noteInner}>
            {/* Emoji + mood label */}
            <div style={p.emojiRing}>
              <span style={p.bigEmoji}>{selected.emoji}</span>
            </div>
            <p style={p.noteMoodBadge}>You're feeling</p>
            <h2 style={p.noteMoodTitle}>{selected.label}</h2>

            {/* ── Motivational affirmation card ── */}
            <div style={p.affirmCard}>
              <div style={p.affirmTopRow}>
                <span style={p.affirmIcon}>💬</span>
                <span style={p.affirmTag}>A message for you</span>
              </div>
              <p style={p.affirmQuote}>{selected.quote}</p>
              <div style={p.affirmDivider} />
              <p style={p.affirmSub}>
                Your feelings are valid. You're doing better than you think. 🌱
              </p>
            </div>

            {/* ── Private note input ── */}
            <div style={p.noteGroup}>
              <div style={p.noteGroupHeader}>
                <p style={p.noteGroupTitle}>📝 Add a note</p>
                <span style={p.notePrivacyBadge}>🔒 Private</span>
              </div>
              <p style={p.noteGroupSub}>Share what's on your mind — only you can see this</p>
              <div style={p.textareaWrap}>
                <textarea
                  placeholder="e.g. I had a tough day, but I kept going…"
                  value={note}
                  onChange={e => setNote(e.target.value.slice(0,200))}
                  style={p.textarea}
                />
                <span style={p.charCount}>{note.length} / 200</span>
              </div>
            </div>

            <button onClick={handleSave} style={p.saveBtn}>Save & Continue →</button>
            <button onClick={handleSave} style={p.skipBtn}>Skip for now</button>
          </div>
        </div>
      )}

      {/* ────────────── DASHBOARD ────────────── */}
      {step === "dashboard" && (
        <div className="animate-fadeIn" style={p.dashWrap}>

          {/* Dashboard header */}
          <div style={p.dashHeader}>
            <div>
              <h2 style={p.dashTitle}>Your Dashboard</h2>
              <p style={p.dashSub}>Track your mood and appointments</p>
            </div>
            <div style={{ display:"flex", gap:"8px", flexShrink:0, marginTop:"4px" }}>
              <button onClick={() => navigate("/chat")} style={p.trackBtn}>
                💬 Chat Counselor
              </button>
              <button onClick={() => setStep("profile")} style={p.profileBtn}>
                👤 Profile
              </button>
            </div>
          </div>

          {/* Mood calendar */}
          <section style={p.section}>
            <p style={p.sectionLabel}>MOOD CALENDAR</p>
            <MoodCalendar key={calKey} />
          </section>

          {/* Appointment card */}
          <section style={p.section}>
            <p style={p.sectionLabel}>APPOINTMENT</p>

            {appointment && apptSt ? (
              <div style={{ ...p.apptCard, background: apptSt.bg, borderColor: apptSt.border }}>
                <div style={p.apptRow}>
                  <span style={p.apptKey}>Status</span>
                  <span style={{ ...p.apptVal, color: apptSt.color, fontWeight: 700 }}>
                    {apptSt.label}
                  </span>
                </div>
                <div style={p.apptRow}>
                  <span style={p.apptKey}>Counselor</span>
                  <span style={p.apptVal}>{appointment.assignedTo || "—"}</span>
                </div>
                <div style={p.apptRow}>
                  <span style={p.apptKey}>Severity</span>
                  <span style={p.apptVal}>{appointment.severity}</span>
                </div>
                {appointment.scheduleDate && (
                  <div style={{ ...p.apptRow, borderBottom: "none" }}>
                    <span style={p.apptKey}>Scheduled</span>
                    <span style={p.apptVal}>
                      {new Date(appointment.scheduleDate).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div style={p.noAppt}>
                <span style={{ fontSize: "26px" }}>📋</span>
                <span style={p.noApptText}>No appointment scheduled yet</span>
              </div>
            )}
          </section>

          {/* Action buttons */}
          <div style={p.btnRow}>
            <button onClick={handleReset} style={p.chatBtn}>
              ➕ Track Mood
            </button>
            <button onClick={() => navigate("/chat")} style={p.trackBtnSm}>
              💬 Chat Counselor
            </button>
          </div>

          {/* 🧄 Ad Banner */}
          <div style={p.adCard}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/4/48/Cabanatuan_garlic_longganisa6.jpg"
              alt="Cabanatuan Garlic Longganisa"
              style={p.adImg}
            />
            <div style={p.adContent}>
              <span style={p.adTag}>Featured Local Product 🇵🇭</span>
              <h3 style={p.adTitle}>Cabanatuan Garlic Longganisa</h3>
              <p style={p.adDesc}>
                Nueva Ecija's pride — sweet, garlicky, and bursting with flavor.
                The perfect breakfast treat to brighten your morning! 🧄🌟
              </p>
              <span style={p.adCta}>Order now at your local market →</span>
            </div>
          </div>
        </div>
      )}

      {/* ────────────── PROFILE ────────────── */}
      {step === "profile" && (
        <div className="animate-fadeInUp" style={p.dashWrap}>
          {/* Header */}
          <div style={p.dashHeader}>
            <div>
              <h2 style={p.dashTitle}>My Profile</h2>
              <p style={p.dashSub}>Manage your account details</p>
            </div>
            <button onClick={() => setStep("dashboard")} style={p.backToDashBtn}>
              ← Dashboard
            </button>
          </div>

          {/* Avatar + info card */}
          <section style={p.section}>
            <div style={p.profileCard}>
              <div style={p.profileAvatar}>
                {userName.charAt(0).toUpperCase()}
              </div>
              <div style={p.profileInfo}>
                <p style={p.profileName}>{userName}</p>
                <p style={p.profileEmail}>{userEmail}</p>
                <span style={p.profileRole}>🎓 Student</span>
              </div>
            </div>
          </section>

          {/* Change password */}
          <section style={p.section}>
            <p style={p.sectionLabel}>CHANGE PASSWORD</p>
            <div style={p.pwForm}>
              {[
                { label:"Current Password",  val:curPw, set:setCurPw },
                { label:"New Password",       val:newPw, set:setNewPw },
                { label:"Confirm New Password", val:conPw, set:setConPw },
              ].map(({ label, val, set }) => (
                <div key={label} style={p.pwGroup}>
                  <label style={p.pwLabel}>{label}</label>
                  <input
                    type="password"
                    value={val}
                    onChange={e => set(e.target.value)}
                    placeholder="••••••••"
                    style={p.pwInput}
                  />
                </div>
              ))}
              {pwMsg.text && (
                <div style={{ fontSize:"13px", fontWeight:600, textAlign:"center", color: pwMsg.ok ? "#38C9B8" : "#F87171" }}>
                  {pwMsg.text}
                </div>
              )}
              <button
                onClick={handleChangePassword}
                disabled={pwLoading}
                style={{ ...p.pwSaveBtn, opacity: pwLoading ? 0.7 : 1 }}
              >
                {pwLoading ? "Saving…" : "Save New Password"}
              </button>
            </div>
          </section>

          {/* Logout from profile too */}
          <button onClick={handleLogout} style={p.profileLogoutBtn}>
            🚪 Sign out of account
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────── */
const p = {
  page: {
    minHeight: "100vh",
    width: "100%",
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    background: "linear-gradient(150deg,#1a1a2e 0%,#16213e 55%,#0f3460 100%)",
    fontFamily: "'Lato',sans-serif",
    padding: "32px 20px 60px",
    position: "relative",
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    borderRadius: "50%",
    background: "rgba(108,99,255,0.08)",
    pointerEvents: "none",
  },

  /* ── Pick ── */
  wrap: {
    width: "100%",
    maxWidth: "460px",
    position: "relative",
    zIndex: 1,
    marginTop: "12px",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "40px",
  },
  topDate: {
    fontSize: "12px",
    fontWeight: 500,
    color: "rgba(255,255,255,0.38)",
    margin: 0,
    letterSpacing: "0.02em",
  },
  dashBtn: {
    padding: "8px 18px",
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "99px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.01em",
    transition: "all 0.2s",
  },
  hero: {
    textAlign: "center",
    marginBottom: "44px",
  },
  heroRing: {
    width: "76px",
    height: "76px",
    borderRadius: "50%",
    background: "rgba(108,99,255,0.18)",
    border: "1.5px solid rgba(108,99,255,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 22px",
  },
  h1: {
    fontSize: "28px",
    fontWeight: 800,
    color: "#fff",
    margin: "0 0 10px",
    lineHeight: 1.25,
    letterSpacing: "-0.5px",
    fontFamily: "'Poppins',sans-serif",
  },
  heroSub: {
    fontSize: "15px",
    fontWeight: 400,
    color: "rgba(255,255,255,0.52)",
    margin: 0,
    lineHeight: 1.65,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
    marginBottom: "22px",
  },
  card: {
    position: "relative",
    padding: "22px 18px",
    borderRadius: "22px",
    border: "none",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    overflow: "hidden",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    fontFamily: "inherit",
    minHeight: "148px",
  },
  cardShine: {
    position: "absolute",
    top: "-28px",
    right: "-28px",
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.13)",
    pointerEvents: "none",
  },
  cardEmoji: { fontSize: "40px", lineHeight: 1, zIndex: 1 },
  cardLabel: {
    fontSize: "17px",
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "-0.2px",
    zIndex: 1,
    fontFamily: "'Poppins',sans-serif",
  },
  cardArrow: {
    marginTop: "auto",
    alignSelf: "flex-end",
    width: "26px",
    height: "26px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.22)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 700,
    zIndex: 1,
  },
  hint: {
    textAlign: "center",
    fontSize: "12px",
    fontWeight: 500,
    color: "rgba(255,255,255,0.22)",
    margin: 0,
    letterSpacing: "0.02em",
  },

  /* ── Note ── */
  notePage: {
    position: "relative",
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 28px 52px",
    overflow: "hidden",
  },
  noteBlob1: {
    position: "absolute", width: "380px", height: "380px", borderRadius: "50%",
    background: "rgba(255,255,255,0.1)", top: "-140px", right: "-110px", pointerEvents: "none",
  },
  noteBlob2: {
    position: "absolute", width: "260px", height: "260px", borderRadius: "50%",
    background: "rgba(0,0,0,0.1)", bottom: "-90px", left: "-70px", pointerEvents: "none",
  },
  backBtn: {
    position: "absolute",
    top: "32px",
    left: "28px",
    background: "rgba(0,0,0,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "rgba(255,255,255,0.75)",
    padding: "8px 18px",
    borderRadius: "99px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    zIndex: 2,
    letterSpacing: "0.01em",
  },
  noteInner: {
    width: "100%",
    maxWidth: "420px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    zIndex: 1,
    gap: "0px",
  },
  emojiRing: {
    width: "104px",
    height: "104px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.18)",
    border: "2px solid rgba(255,255,255,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "18px",
    boxShadow: "0 10px 32px rgba(0,0,0,0.14)",
  },
  bigEmoji: { fontSize: "52px" },
  noteMoodBadge: {
    fontSize: "13px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.65)",
    margin: "0 0 4px",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontFamily: "'Poppins',sans-serif",
  },
  noteMoodTitle: {
    fontSize: "32px",
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 22px",
    letterSpacing: "-0.5px",
    fontFamily: "'Poppins',sans-serif",
    textShadow: "0 2px 12px rgba(0,0,0,0.2)",
  },

  /* ── Affirmation card ── */
  affirmCard: {
    width: "100%",
    background: "rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: "20px",
    padding: "22px 22px 18px",
    marginBottom: "24px",
    backdropFilter: "blur(6px)",
  },
  affirmTopRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "14px",
  },
  affirmIcon: {
    fontSize: "20px",
    lineHeight: 1,
  },
  affirmTag: {
    fontSize: "11px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    fontFamily: "'Poppins',sans-serif",
  },
  affirmQuote: {
    fontSize: "16px",
    fontWeight: 400,
    color: "#fff",
    lineHeight: 1.75,
    margin: "0 0 16px",
    fontFamily: "'Lato',sans-serif",
    fontStyle: "italic",
    textShadow: "0 1px 6px rgba(0,0,0,0.14)",
  },
  affirmDivider: {
    height: "1px",
    background: "rgba(255,255,255,0.15)",
    marginBottom: "14px",
  },
  affirmSub: {
    fontSize: "13px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    margin: 0,
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "0.01em",
  },

  noteGroup: {
    width: "100%",
    marginBottom: "22px",
  },
  noteGroupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  noteGroupTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#fff",
    margin: 0,
    fontFamily: "'Poppins',sans-serif",
  },
  notePrivacyBadge: {
    fontSize: "11px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.1)",
    padding: "3px 9px",
    borderRadius: "99px",
    border: "1px solid rgba(255,255,255,0.16)",
    fontFamily: "'Poppins',sans-serif",
  },
  noteGroupSub: {
    fontSize: "13px",
    fontWeight: 400,
    color: "rgba(255,255,255,0.52)",
    margin: "0 0 12px",
    fontFamily: "'Lato',sans-serif",
  },
  textareaWrap: {
    position: "relative",
  },
  textarea: {
    width: "100%",
    minHeight: "100px",
    background: "rgba(0,0,0,0.18)",
    border: "1.5px solid rgba(255,255,255,0.18)",
    borderRadius: "14px",
    padding: "14px 16px",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: 1.65,
    resize: "none",
    outline: "none",
    fontFamily: "'Lato',sans-serif",
    boxSizing: "border-box",
  },
  charCount: {
    position: "absolute",
    bottom: "10px",
    right: "14px",
    fontSize: "11px",
    fontWeight: 500,
    color: "rgba(255,255,255,0.28)",
  },
  saveBtn: {
    width: "100%",
    padding: "18px",
    background: "rgba(255,255,255,0.97)",
    color: "#2D3047",
    border: "none",
    borderRadius: "16px",
    fontSize: "16px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "0.02em",
    boxShadow: "0 10px 32px rgba(0,0,0,0.22)",
    marginBottom: "14px",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  skipBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.5)",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "'Lato',sans-serif",
    padding: "8px",
    letterSpacing: "0.01em",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },

  /* ── Dashboard ── */
  dashWrap: {
    width: "100%",
    maxWidth: "520px",
    position: "relative",
    zIndex: 1,
    marginTop: "8px",
  },
  dashHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "32px",
  },
  dashTitle: {
    fontSize: "26px",
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 4px",
    letterSpacing: "-0.4px",
    fontFamily: "'Poppins',sans-serif",
  },
  dashSub: {
    fontSize: "14px",
    fontWeight: 400,
    color: "rgba(255,255,255,0.48)",
    margin: 0,
  },
  trackBtn: {
    padding: "10px 20px",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff",
    border: "none",
    borderRadius: "99px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    boxShadow: "0 6px 18px rgba(91,107,216,0.38)",
    letterSpacing: "0.01em",
    flexShrink: 0,
  },
  logoutBtn: {
    padding: "10px 16px",
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "99px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "0.01em",
    flexShrink: 0,
    transition: "all 0.2s",
  },
  section: {
    marginBottom: "24px",
  },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.1em",
    margin: "0 0 10px",
  },
  apptCard: {
    borderRadius: "16px",
    padding: "4px 18px",
    border: "1.5px solid",
  },
  apptRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  apptKey: {
    fontSize: "11px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.42)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontFamily: "'Poppins',sans-serif",
  },
  apptVal: {
    fontSize: "14px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.85)",
  },
  noAppt: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "18px 20px",
    background: "rgba(255,255,255,0.03)",
    border: "1.5px dashed rgba(255,255,255,0.1)",
    borderRadius: "14px",
  },
  noApptText: {
    fontSize: "15px",
    fontWeight: 400,
    color: "rgba(255,255,255,0.38)",
  },
  btnRow: {
    display: "flex",
    gap: "12px",
    marginTop: "8px",
  },
  chatBtn: {
    flex: 1,
    padding: "15px",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    boxShadow: "0 8px 20px rgba(91,107,216,0.32)",
    letterSpacing: "0.01em",
  },
  trackBtnSm: {
    flex: 1,
    padding: "15px",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.72)",
    border: "1.5px solid rgba(255,255,255,0.16)",
    borderRadius: "14px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "0.01em",
  },

  /* ── Profile button (dashboard header) ── */
  profileBtn: {
    padding: "10px 16px",
    background: "rgba(255,255,255,0.09)",
    color: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: "99px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    flexShrink: 0,
  },
  backToDashBtn: {
    padding: "10px 18px",
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "99px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    flexShrink: 0,
  },

  /* ── Profile card ── */
  profileCard: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    padding: "20px",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  profileAvatar: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: 700,
    fontFamily: "'Poppins',sans-serif",
    flexShrink: 0,
    boxShadow: "0 6px 18px rgba(91,107,216,0.35)",
  },
  profileInfo: { display: "flex", flexDirection: "column", gap: "4px" },
  profileName: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#fff",
    margin: 0,
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "-0.2px",
  },
  profileEmail: {
    fontSize: "14px",
    color: "rgba(255,255,255,0.48)",
    margin: 0,
    fontFamily: "'Lato',sans-serif",
  },
  profileRole: {
    display: "inline-block",
    marginTop: "4px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#b4bcf5",
    background: "rgba(91,107,216,0.25)",
    padding: "3px 10px",
    borderRadius: "99px",
    border: "1px solid rgba(91,107,216,0.4)",
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "0.04em",
  },

  /* ── Change password form ── */
  pwForm: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  pwGroup: { display: "flex", flexDirection: "column", gap: "6px" },
  pwLabel: {
    fontSize: "11px",
    fontWeight: 700,
    color: "rgba(255,255,255,0.42)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontFamily: "'Poppins',sans-serif",
  },
  pwInput: {
    padding: "13px 16px",
    background: "rgba(255,255,255,0.06)",
    border: "1.5px solid rgba(255,255,255,0.14)",
    borderRadius: "12px",
    color: "#fff",
    fontSize: "15px",
    fontFamily: "'Lato',sans-serif",
    outline: "none",
  },
  pwSaveBtn: {
    padding: "16px",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    boxShadow: "0 8px 22px rgba(91,107,216,0.35)",
    letterSpacing: "0.02em",
    marginTop: "4px",
  },
  profileLogoutBtn: {
    width: "100%",
    padding: "14px",
    background: "rgba(248,113,113,0.1)",
    color: "rgba(248,113,113,0.85)",
    border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    marginTop: "8px",
    textAlign: "center",
  },

  /* ── Ad banner ── */
  adCard: {
    marginTop: "24px",
    borderRadius: "18px",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    display: "flex",
    flexDirection: "column",
  },
  adImg: {
    width: "100%",
    height: "160px",
    objectFit: "cover",
    display: "block",
  },
  adContent: {
    padding: "16px 18px 18px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  adTag: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#F9A72B",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontFamily: "'Poppins',sans-serif",
  },
  adTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#fff",
    margin: 0,
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "-0.2px",
  },
  adDesc: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.55)",
    margin: 0,
    lineHeight: 1.6,
    fontFamily: "'Lato',sans-serif",
  },
  adCta: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#38C9B8",
    fontFamily: "'Poppins',sans-serif",
    marginTop: "4px",
    letterSpacing: "0.01em",
  },
};
