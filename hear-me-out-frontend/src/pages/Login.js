import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused]   = useState(null);
  const navigate = useNavigate();

  // Auto-redirect if already logged in
  useEffect(() => {
    const token  = localStorage.getItem("token");
    const role   = localStorage.getItem("role");
    const userId = localStorage.getItem("userId");
    if (!token || !role) return;
    if (role === "student") {
      API.get(`/assessment/check/${userId}`)
        .then(res => navigate(res.data.hasAssessment ? "/student" : "/assessment"))
        .catch(() => navigate("/assessment"));
    } else {
      navigate("/admin");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async () => {
    if (!email || !password) { alert("Please enter your email and password."); return; }
    try {
      setLoading(true);
      const res = await API.post("/auth/login", { email, password });
      if (!res.data.token) { alert("Login failed: no token received."); return; }
      const user = res.data.user;
      if (!user?.role || !user?.id) { alert("Login error: user data missing."); return; }
      localStorage.setItem("token",  res.data.token);
      localStorage.setItem("role",   user.role);
      localStorage.setItem("userId", user.id);
      if (user.role === "student") {
        try {
          const check = await API.get(`/assessment/check/${user.id}`);
          navigate(check.data.hasAssessment ? "/student" : "/assessment");
        } catch { navigate("/assessment"); }
      } else {
        navigate("/admin");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Login failed.");
    } finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      {/* Soft background shapes */}
      <div style={s.shape1} />
      <div style={s.shape2} />
      <div style={s.shape3} />

      <div className="animate-fadeInUp" style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <span className="animate-pulse" style={s.logo}>💙</span>
          <h1 style={s.title}>Welcome back</h1>
          <p style={s.subtitle}>Sign in to continue your wellness journey</p>
        </div>

        {/* Form */}
        <div style={s.form}>
          {/* Email */}
          <div style={s.group}>
            <label style={s.label}>Email address</label>
            <div style={{ ...s.inputRow, borderColor: focused === "email" ? "#5B6BD8" : "rgba(91,107,216,0.18)" }}>
              <span style={s.icon}>✉️</span>
              <input
                placeholder="you@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                autoCapitalize="none"
                style={s.input}
              />
            </div>
          </div>

          {/* Password */}
          <div style={s.group}>
            <label style={s.label}>Password</label>
            <div style={{ ...s.inputRow, borderColor: focused === "pw" ? "#5B6BD8" : "rgba(91,107,216,0.18)" }}>
              <span style={s.icon}>🔒</span>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused("pw")}
                onBlur={() => setFocused(null)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                style={{ ...s.input, flex: 1 }}
              />
              <span style={s.eye} onClick={() => setShowPass(!showPass)}>
                {showPass ? "🙈" : "👁️"}
              </span>
            </div>
          </div>

          {/* Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ ...s.btn, opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading
              ? <span style={s.loadRow}><span className="animate-spin" style={s.spinner} /> Signing in…</span>
              : "Sign In →"
            }
          </button>
        </div>

        <p style={s.foot}>
          Don't have an account?{" "}
          <span style={s.link} onClick={() => navigate("/register")}>Create one</span>
        </p>

        {/* Trust badge */}
        <div style={s.trustRow}>
          <span style={s.trustItem}>🔐 Secure</span>
          <span style={s.trustDot} />
          <span style={s.trustItem}>💙 Confidential</span>
          <span style={s.trustDot} />
          <span style={s.trustItem}>🌿 Safe space</span>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(145deg,#5B6BD8 0%,#7C6FCD 40%,#9B87E8 70%,#B8ACFF 100%)",
    padding: "24px 20px",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Lato', sans-serif",
  },
  shape1: {
    position:"absolute", width:480, height:480, borderRadius:"50%",
    background:"rgba(255,255,255,0.08)", top:-180, right:-140, pointerEvents:"none",
  },
  shape2: {
    position:"absolute", width:320, height:320, borderRadius:"50%",
    background:"rgba(255,255,255,0.06)", bottom:-100, left:-80, pointerEvents:"none",
  },
  shape3: {
    position:"absolute", width:200, height:200, borderRadius:"50%",
    background:"rgba(249,123,107,0.1)", top:"40%", left:"6%", pointerEvents:"none",
  },
  card: {
    background: "#fff",
    borderRadius: "24px",
    padding: "48px 40px 36px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 24px 64px rgba(45,48,71,0.22)",
    position: "relative",
    zIndex: 1,
  },
  header: {
    textAlign: "center",
    marginBottom: "36px",
  },
  logo: {
    fontSize: "48px",
    display: "block",
    marginBottom: "14px",
    lineHeight: 1,
  },
  title: {
    fontFamily: "'Poppins', sans-serif",
    fontSize: "26px",
    fontWeight: 700,
    color: "#2D3047",
    letterSpacing: "-0.3px",
    marginBottom: "6px",
  },
  subtitle: {
    fontSize: "14px",
    fontWeight: 400,
    color: "#7B7F9E",
    lineHeight: 1.55,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    marginBottom: "24px",
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },
  label: {
    fontFamily: "'Poppins', sans-serif",
    fontSize: "12px",
    fontWeight: 600,
    color: "#2D3047",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    background: "#FAFBFF",
    borderRadius: "12px",
    border: "2px solid",
    paddingLeft: "14px",
    paddingRight: "14px",
    transition: "border-color 0.2s",
  },
  icon: { fontSize: "16px", marginRight: "10px", flexShrink: 0 },
  input: {
    flex: 1,
    padding: "13px 0",
    border: "none",
    background: "transparent",
    outline: "none",
    fontSize: "15px",
    fontFamily: "'Lato', sans-serif",
    color: "#2D3047",
    lineHeight: 1.5,
  },
  eye: { cursor: "pointer", fontSize: "16px", userSelect: "none", padding: "4px" },
  btn: {
    padding: "16px",
    background: "linear-gradient(135deg,#5B6BD8 0%,#7C6FCD 100%)",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontFamily: "'Poppins', sans-serif",
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "0.02em",
    boxShadow: "0 8px 22px rgba(91,107,216,0.38)",
    transition: "transform 0.15s, box-shadow 0.15s",
  },
  loadRow: { display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" },
  spinner: {
    display:"inline-block", width:"16px", height:"16px",
    border:"2.5px solid rgba(255,255,255,0.35)", borderTopColor:"#fff", borderRadius:"50%",
  },
  foot: { textAlign:"center", fontSize:"14px", color:"#7B7F9E", marginBottom:"20px" },
  link: { color:"#5B6BD8", fontWeight:700, cursor:"pointer", textDecoration:"underline", textUnderlineOffset:"3px" },
  trustRow: {
    display:"flex", alignItems:"center", justifyContent:"center",
    gap:"8px", flexWrap:"wrap",
  },
  trustItem: { fontSize:"12px", color:"#A8AECB", fontWeight:500 },
  trustDot: { width:"3px", height:"3px", borderRadius:"50%", background:"#D1D5F0" },
};
