import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

export default function Login() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused]   = useState(null);
  const [error,   setError]     = useState("");
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
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setError("");
    try {
      setLoading(true);
      const res = await API.post("/auth/login", { email, password });
      if (!res.data.token) { setError("Login failed. Please try again."); return; }
      const user = res.data.user;
      if (!user?.role || !user?.id) { setError("Login error. Please try again."); return; }
      localStorage.setItem("token",  res.data.token);
      localStorage.setItem("role",   user.role);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("name",   user.name  || "");
      localStorage.setItem("email",  user.email || "");
      if (user.role === "student") {
        try {
          const check = await API.get(`/assessment/check/${user.id}`);
          navigate(check.data.hasAssessment ? "/student" : "/assessment");
        } catch { navigate("/assessment"); }
      } else {
        navigate("/admin");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password.");
    } finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
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

          {error && (
            <div style={{ color:"#F87171", fontSize:"13px", fontWeight:600, textAlign:"center" }}>
              {error}
            </div>
          )}

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

        <p style={{ ...s.foot, marginTop: "16px" }}>
          <span style={s.link} onClick={() => navigate("/forgot-password")}>Forgot password?</span>
        </p>

        {/* Trust badge */}
        <div style={s.trustRow}>
          <span style={s.trustItem}>🔒 Private</span>
          <span style={s.trustItem}>💙 Supportive</span>
          <span style={s.trustItem}>🌱 Judgment-free</span>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(145deg,#5B6BD8 0%,#7C6FCD 50%,#9B87E8 100%)",
    fontFamily: "'Lato',sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  shape1: {
    position: "absolute",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.07)",
    top: "-100px",
    right: "-100px",
  },
  shape2: {
    position: "absolute",
    width: "300px",
    height: "300px",
    borderRadius: "50%",
    background: "rgba(255,101,132,0.1)",
    bottom: "-80px",
    left: "-60px",
  },
  shape3: {
    position: "absolute",
    width: "200px",
    height: "200px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.05)",
    top: "50%",
    left: "-50px",
  },
  card: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: "28px",
    padding: "40px 36px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
    position: "relative",
    zIndex: 1,
  },
  header: {
    textAlign: "center",
    marginBottom: "32px",
  },
  logo: {
    fontSize: "52px",
    display: "block",
    marginBottom: "12px",
  },
  title: {
    fontSize: "26px",
    fontWeight: "800",
    color: "#1A1A2E",
    margin: "0 0 6px",
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#6B7280",
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  group: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#374151",
    letterSpacing: "0.06em",
    fontFamily: "'Poppins',sans-serif",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    background: "#F9FAFB",
    borderRadius: "14px",
    border: "2px solid rgba(91,107,216,0.18)",
    padding: "12px 16px",
    gap: "10px",
    transition: "border-color 0.2s",
  },
  icon: {
    fontSize: "17px",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    border: "none",
    background: "transparent",
    outline: "none",
    fontSize: "15px",
    color: "#1A1A2E",
    fontFamily: "'Lato',sans-serif",
  },
  eye: {
    cursor: "pointer",
    fontSize: "17px",
    flexShrink: 0,
    userSelect: "none",
  },
  btn: {
    width: "100%",
    padding: "15px",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "#fff",
    border: "none",
    borderRadius: "14px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    fontFamily: "'Poppins',sans-serif",
    boxShadow: "0 8px 20px rgba(91,107,216,0.35)",
    transition: "opacity 0.2s",
    marginTop: "6px",
  },
  loadRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  spinner: {
    width: "16px",
    height: "16px",
    border: "2px solid rgba(255,255,255,0.4)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    display: "inline-block",
  },
  foot: {
    textAlign: "center",
    fontSize: "14px",
    color: "#6B7280",
    margin: "8px 0 0",
  },
  link: {
    color: "#5B6BD8",
    fontWeight: "700",
    cursor: "pointer",
    textDecoration: "underline",
  },
  trustRow: {
    display: "flex",
    justifyContent: "center",
    gap: "16px",
    marginTop: "24px",
    flexWrap: "wrap",
  },
  trustItem: {
    fontSize: "12px",
    color: "#9CA3AF",
  },
};