import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await API.post("/auth/login", { email, password });

      // ✅ Save token
      localStorage.setItem("token", res.data.token);

      // ✅ Safe check for user
      const user = res.data.user;

      if (!user || !user.role) {
        alert("Login error: user data missing");
        return;
      }

      localStorage.setItem("role", user.role);

      // 🔥 ROLE-BASED + FLOW-BASED REDIRECT
      if (user.role === "student") {
        // 👉 ALWAYS go to assessment first
        navigate("/assessment");
      } else {
        navigate("/admin");
      }

    } catch (err) {
      console.log("ERROR:", err.response?.data || err.message);
      alert("Login failed");
    }
  };

  return (
    <div style={{
      maxWidth: "400px",
      margin: "auto",
      padding: "20px",
      fontFamily: "Arial"
    }}>
      <h2 style={{ textAlign: "center" }}>Login</h2>

      <input
        placeholder="Email"
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "10px",
          borderRadius: "6px"
        }}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "10px",
          borderRadius: "6px"
        }}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleLogin}
        style={{
          width: "100%",
          padding: "10px",
          background: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "8px"
        }}
      >
        Login
      </button>
    </div>
  );
}

export default Login;