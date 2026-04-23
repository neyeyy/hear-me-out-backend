import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

export default function ForgotPassword() {
  const [email,   setEmail]   = useState("");
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [focused, setFocused] = useState(null);
  const navigate = useNavigate();

  const handleRequest = async () => {
    if (!email) { setError("Please enter your email."); return; }
    setError("");
    try {
      setLoading(true);
      const res = await API.post("/auth/forgot-password", { email });
      if (res.data.success) {
        setCode(res.data.code);
      } else {
        setError(res.data.message || "Request failed.");
      }
    } catch (e) {
      setError(e.response?.data?.message || "Something went wrong.");
    } finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.shape1} />
      <div style={s.shape2} />

      <div style={s.card}>
        <div style={s.header}>
          <span style={s.logo}>🔑</span>
          <h1 style={s.title}>Forgot Password</h1>
          <p style={s.subtitle}>Enter your email to get a recovery code</p>
        </div>

        {!code ? (
          <>
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
                  onKeyDown={e => e.key === "Enter" && handleRequest()}
                  autoCapitalize="none"
                  style={s.input}
                />
              </div>
            </div>

            {error && <div style={s.error}>{error}</div>}

            <button
              onClick={handleRequest}
              disabled={loading}
              style={{ ...s.btn, opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Sending…" : "Get Recovery Code →"}
            </button>
          </>
        ) : (
          <div style={s.codeBox}>
            <p style={s.codeLabel}>Your recovery code</p>
            <div style={s.codePill}>{code}</div>
            <p style={s.codeNote}>⏰ This code expires in <strong>15 minutes</strong>. Copy it now then use it on the next page.</p>
            <button onClick={() => navigate("/reset-password", { state: { email } })} style={s.btn}>
              Use This Code →
            </button>
          </div>
        )}

        <p style={s.foot}>
          Remember your password?{" "}
          <span style={s.link} onClick={() => navigate("/")}>Sign in</span>
        </p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh", width: "100%", display: "flex", justifyContent: "center", alignItems: "center",
    background: "linear-gradient(145deg,#5B6BD8 0%,#7C6FCD 40%,#9B87E8 70%,#B8ACFF 100%)",
    padding: "24px 20px", position: "relative", overflow: "hidden",
    fontFamily: "'Lato', sans-serif",
  },
  shape1: { position:"absolute", width:480, height:480, borderRadius:"50%", background:"rgba(255,255,255,0.08)", top:-180, right:-140, pointerEvents:"none" },
  shape2: { position:"absolute", width:320, height:320, borderRadius:"50%", background:"rgba(255,255,255,0.06)", bottom:-100, left:-80, pointerEvents:"none" },
  card: {
    background: "#fff", borderRadius: "24px", padding: "48px 40px 36px",
    width: "100%", maxWidth: "420px", boxShadow: "0 24px 64px rgba(45,48,71,0.22)",
    position: "relative", zIndex: 1,
  },
  header: { textAlign: "center", marginBottom: "32px" },
  logo: { fontSize: "48px", display: "block", marginBottom: "14px", lineHeight: 1 },
  title: { fontFamily: "'Poppins', sans-serif", fontSize: "24px", fontWeight: 700, color: "#2D3047", marginBottom: "6px" },
  subtitle: { fontSize: "14px", color: "#7B7F9E" },
  group: { display: "flex", flexDirection: "column", gap: "7px", marginBottom: "20px" },
  label: { fontFamily: "'Poppins', sans-serif", fontSize: "12px", fontWeight: 600, color: "#2D3047", textTransform: "uppercase", letterSpacing: "0.04em" },
  inputRow: {
    display: "flex", alignItems: "center", background: "#FAFBFF", borderRadius: "12px",
    border: "2px solid", paddingLeft: "14px", paddingRight: "14px", transition: "border-color 0.2s",
  },
  icon: { fontSize: "16px", marginRight: "10px", flexShrink: 0 },
  input: { flex: 1, padding: "13px 0", border: "none", background: "transparent", outline: "none", fontSize: "15px", fontFamily: "'Lato', sans-serif", color: "#2D3047" },
  error: { color: "#F87171", fontSize: "13px", fontWeight: 600, textAlign: "center", marginBottom: "12px" },
  btn: {
    width: "100%", padding: "16px", background: "linear-gradient(135deg,#5B6BD8 0%,#7C6FCD 100%)",
    color: "#fff", border: "none", borderRadius: "12px", fontFamily: "'Poppins', sans-serif",
    fontSize: "15px", fontWeight: 600, boxShadow: "0 8px 22px rgba(91,107,216,0.38)", cursor: "pointer",
  },
  codeBox: { textAlign: "center", marginBottom: "8px" },
  codeLabel: { fontSize: "13px", color: "#7B7F9E", marginBottom: "12px" },
  codePill: {
    display: "inline-block", fontSize: "32px", fontWeight: 800, letterSpacing: "8px",
    color: "#5B6BD8", background: "#EEF0FD", borderRadius: "16px", padding: "16px 32px",
    marginBottom: "16px", fontFamily: "'Poppins', sans-serif",
  },
  codeNote: { fontSize: "13px", color: "#7B7F9E", marginBottom: "20px", lineHeight: 1.6 },
  foot: { textAlign: "center", fontSize: "14px", color: "#7B7F9E", marginTop: "20px" },
  link: { color: "#5B6BD8", fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" },
};
