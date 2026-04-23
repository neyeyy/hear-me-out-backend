import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import API from "../services/api";

export default function ResetPassword() {
  const location = useLocation();
  const navigate  = useNavigate();
  const [email,    setEmail]    = useState(location.state?.email || "");
  const [code,     setCode]     = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [conPw,    setConPw]    = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);
  const [focused,  setFocused]  = useState(null);

  const handleReset = async () => {
    if (!email || !code || !newPw || !conPw) { setError("Please fill in all fields."); return; }
    if (newPw !== conPw) { setError("Passwords do not match."); return; }
    if (newPw.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError("");
    try {
      setLoading(true);
      const res = await API.post("/auth/reset-password", { email, code: code.toUpperCase(), newPassword: newPw });
      if (res.data.success) {
        setSuccess(true);
      } else {
        setError(res.data.message || "Reset failed.");
      }
    } catch (e) {
      setError(e.response?.data?.message || "Something went wrong.");
    } finally { setLoading(false); }
  };

  const fields = [
    { key: "email", label: "Email", placeholder: "you@university.edu", value: email, set: setEmail, type: "email" },
    { key: "code",  label: "Recovery Code", placeholder: "e.g. A3F9B2", value: code, set: setCode, type: "text" },
  ];

  return (
    <div style={s.page}>
      <div style={s.shape1} />
      <div style={s.shape2} />

      <div style={s.card}>
        {success ? (
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "56px", display: "block", marginBottom: "16px" }}>✅</span>
            <h1 style={s.title}>Password Reset!</h1>
            <p style={{ fontSize: "14px", color: "#7B7F9E", marginBottom: "24px" }}>
              Your password has been updated. You can now sign in.
            </p>
            <button onClick={() => navigate("/")} style={s.btn}>Back to Sign In →</button>
          </div>
        ) : (
          <>
            <div style={s.header}>
              <span style={s.logo}>🔐</span>
              <h1 style={s.title}>Reset Password</h1>
              <p style={s.subtitle}>Enter your recovery code and new password</p>
            </div>

            {fields.map(f => (
              <div key={f.key} style={s.group}>
                <label style={s.label}>{f.label}</label>
                <div style={{ ...s.inputRow, borderColor: focused === f.key ? "#5B6BD8" : "rgba(91,107,216,0.18)" }}>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={f.value}
                    onChange={e => f.set(f.key === "code" ? e.target.value.toUpperCase() : e.target.value)}
                    onFocus={() => setFocused(f.key)}
                    onBlur={() => setFocused(null)}
                    autoCapitalize="none"
                    style={{ ...s.input, letterSpacing: f.key === "code" ? "4px" : "normal", fontWeight: f.key === "code" ? 700 : 400 }}
                  />
                </div>
              </div>
            ))}

            <div style={s.group}>
              <label style={s.label}>New Password</label>
              <div style={{ ...s.inputRow, borderColor: focused === "pw" ? "#5B6BD8" : "rgba(91,107,216,0.18)" }}>
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="Min. 6 characters"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  onFocus={() => setFocused("pw")}
                  onBlur={() => setFocused(null)}
                  style={{ ...s.input, flex: 1 }}
                />
                <span style={s.eye} onClick={() => setShowPw(!showPw)}>{showPw ? "🙈" : "👁️"}</span>
              </div>
            </div>

            <div style={s.group}>
              <label style={s.label}>Confirm New Password</label>
              <div style={{ ...s.inputRow, borderColor: focused === "cpw" ? "#5B6BD8" : "rgba(91,107,216,0.18)" }}>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={conPw}
                  onChange={e => setConPw(e.target.value)}
                  onFocus={() => setFocused("cpw")}
                  onBlur={() => setFocused(null)}
                  onKeyDown={e => e.key === "Enter" && handleReset()}
                  style={s.input}
                />
              </div>
            </div>

            {error && <div style={s.error}>{error}</div>}

            <button
              onClick={handleReset}
              disabled={loading}
              style={{ ...s.btn, opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Resetting…" : "Reset Password →"}
            </button>

            <p style={s.foot}>
              <span style={s.link} onClick={() => navigate("/forgot-password")}>← Back to recovery code</span>
            </p>
          </>
        )}
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
  header: { textAlign: "center", marginBottom: "28px" },
  logo: { fontSize: "48px", display: "block", marginBottom: "14px", lineHeight: 1 },
  title: { fontFamily: "'Poppins', sans-serif", fontSize: "24px", fontWeight: 700, color: "#2D3047", marginBottom: "6px" },
  subtitle: { fontSize: "14px", color: "#7B7F9E" },
  group: { display: "flex", flexDirection: "column", gap: "7px", marginBottom: "16px" },
  label: { fontFamily: "'Poppins', sans-serif", fontSize: "12px", fontWeight: 600, color: "#2D3047", textTransform: "uppercase", letterSpacing: "0.04em" },
  inputRow: {
    display: "flex", alignItems: "center", background: "#FAFBFF", borderRadius: "12px",
    border: "2px solid", paddingLeft: "14px", paddingRight: "14px", transition: "border-color 0.2s",
  },
  input: { flex: 1, padding: "13px 0", border: "none", background: "transparent", outline: "none", fontSize: "15px", fontFamily: "'Lato', sans-serif", color: "#2D3047" },
  eye: { cursor: "pointer", fontSize: "16px", padding: "4px", userSelect: "none" },
  error: { color: "#F87171", fontSize: "13px", fontWeight: 600, textAlign: "center", marginBottom: "12px" },
  btn: {
    width: "100%", padding: "16px", background: "linear-gradient(135deg,#5B6BD8 0%,#7C6FCD 100%)",
    color: "#fff", border: "none", borderRadius: "12px", fontFamily: "'Poppins', sans-serif",
    fontSize: "15px", fontWeight: 600, boxShadow: "0 8px 22px rgba(91,107,216,0.38)", cursor: "pointer",
  },
  foot: { textAlign: "center", fontSize: "14px", color: "#7B7F9E", marginTop: "16px" },
  link: { color: "#5B6BD8", fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" },
};
