import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

export default function Register() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState(null);
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!name || !email || !password) { alert("Please fill in all fields."); return; }
    try {
      setLoading(true);
      const res = await API.post("/auth/register", { name, email, password });
      if (res.data.success) {
        alert("Account created! Please sign in.");
        navigate("/");
      } else {
        alert(res.data.message || "Registration failed.");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Registration failed.");
    } finally { setLoading(false); }
  };

  const fields = [
    { id:"name",  label:"Full name",      icon:"👤", type:"text",     ph:"Your full name",       val:name,     set:setName },
    { id:"email", label:"Email address",  icon:"✉️", type:"email",    ph:"you@university.edu",   val:email,    set:setEmail },
    { id:"pw",    label:"Password",       icon:"🔒", type:"password", ph:"Create a password",    val:password, set:setPassword },
  ];

  return (
    <div style={s.page}>
      <div style={s.shape1} />
      <div style={s.shape2} />

      <div className="animate-fadeInUp" style={s.card}>
        <div style={s.header}>
          <span style={s.logo}>🌱</span>
          <h1 style={s.title}>Create your account</h1>
          <p style={s.subtitle}>Join a safe space built just for you</p>
        </div>

        <div style={s.form}>
          {fields.map(f => (
            <div key={f.id} style={s.group}>
              <label style={s.label}>{f.label}</label>
              <div style={{ ...s.inputRow, borderColor: focused === f.id ? "#38C9B8" : "rgba(56,201,184,0.2)" }}>
                <span style={s.icon}>{f.icon}</span>
                <input
                  type={f.id === "pw" ? (showPass ? "text" : "password") : f.type}
                  placeholder={f.ph}
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  onFocus={() => setFocused(f.id)}
                  onBlur={() => setFocused(null)}
                  autoCapitalize={f.id === "name" ? "words" : "none"}
                  style={{ ...s.input, flex: 1 }}
                />
                {f.id === "pw" && (
                  <span style={s.eye} onClick={() => setShowPass(!showPass)}>
                    {showPass ? "🙈" : "👁️"}
                  </span>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={handleRegister}
            disabled={loading}
            style={{ ...s.btn, opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading
              ? <span style={s.loadRow}><span className="animate-spin" style={s.spinner} /> Creating account…</span>
              : "Create Account →"
            }
          </button>
        </div>

        <p style={s.foot}>
          Already have an account?{" "}
          <span style={s.link} onClick={() => navigate("/")}>Sign in</span>
        </p>

        <div style={s.trustRow}>
          <span style={s.trustItem}>🔐 Private</span>
          <span style={s.trustDot} />
          <span style={s.trustItem}>💙 Supportive</span>
          <span style={s.trustDot} />
          <span style={s.trustItem}>🌿 Judgment-free</span>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    width: "100%",
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(145deg,#38C9B8 0%,#5B6BD8 50%,#7C6FCD 100%)",
    padding: "24px 20px",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Lato', sans-serif",
  },
  shape1: {
    position:"absolute", width:400, height:400, borderRadius:"50%",
    background:"rgba(255,255,255,0.08)", top:-140, right:-120, pointerEvents:"none",
  },
  shape2: {
    position:"absolute", width:280, height:280, borderRadius:"50%",
    background:"rgba(255,255,255,0.06)", bottom:-90, left:-70, pointerEvents:"none",
  },
  card: {
    background: "#fff",
    borderRadius: "24px",
    padding: "46px 40px 34px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 24px 64px rgba(45,48,71,0.22)",
    position: "relative",
    zIndex: 1,
  },
  header: { textAlign:"center", marginBottom:"32px" },
  logo: { fontSize:"46px", display:"block", marginBottom:"14px", lineHeight:1 },
  title: {
    fontFamily:"'Poppins',sans-serif", fontSize:"24px", fontWeight:700,
    color:"#2D3047", letterSpacing:"-0.3px", marginBottom:"6px",
  },
  subtitle: { fontSize:"14px", fontWeight:400, color:"#7B7F9E", lineHeight:1.55 },
  form: { display:"flex", flexDirection:"column", gap:"18px", marginBottom:"22px" },
  group: { display:"flex", flexDirection:"column", gap:"7px" },
  label: {
    fontFamily:"'Poppins',sans-serif", fontSize:"12px", fontWeight:600,
    color:"#2D3047", letterSpacing:"0.04em", textTransform:"uppercase",
  },
  inputRow: {
    display:"flex", alignItems:"center",
    background:"#FAFBFF", borderRadius:"12px",
    border:"2px solid", paddingLeft:"14px", paddingRight:"14px",
    transition:"border-color 0.2s",
  },
  icon: { fontSize:"16px", marginRight:"10px", flexShrink:0 },
  input: {
    flex:1, padding:"13px 0", border:"none", background:"transparent", outline:"none",
    fontSize:"15px", fontFamily:"'Lato',sans-serif", color:"#2D3047", lineHeight:1.5,
  },
  eye: { cursor:"pointer", fontSize:"16px", userSelect:"none", padding:"4px" },
  btn: {
    padding:"16px",
    background:"linear-gradient(135deg,#38C9B8 0%,#5B6BD8 100%)",
    color:"#fff", border:"none", borderRadius:"12px",
    fontFamily:"'Poppins',sans-serif", fontSize:"15px", fontWeight:600,
    letterSpacing:"0.02em", boxShadow:"0 8px 22px rgba(56,201,184,0.35)",
  },
  loadRow: { display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" },
  spinner: {
    display:"inline-block", width:"16px", height:"16px",
    border:"2.5px solid rgba(255,255,255,0.35)", borderTopColor:"#fff", borderRadius:"50%",
  },
  foot: { textAlign:"center", fontSize:"14px", color:"#7B7F9E", marginBottom:"18px" },
  link: { color:"#38C9B8", fontWeight:700, cursor:"pointer", textDecoration:"underline", textUnderlineOffset:"3px" },
  trustRow: { display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", flexWrap:"wrap" },
  trustItem: { fontSize:"12px", color:"#A8AECB", fontWeight:500 },
  trustDot: { width:"3px", height:"3px", borderRadius:"50%", background:"#D1D5F0" },
};
