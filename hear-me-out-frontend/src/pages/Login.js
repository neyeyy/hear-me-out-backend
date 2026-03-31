import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post("/auth/login", { email, password });

      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
      } else {
        alert("Login failed: no token received");
        return;
      }

      const user = res.data.user;

      if (!user || !user.role || !user.id) {
        alert("Login error: user data missing");
        return;
      }

      localStorage.setItem("role", user.role);
      localStorage.setItem("userId", user.id);

      // 🔥 FIXED REDIRECT LOGIC
      if (user.role === "student") {
        try {
          const checkRes = await API.get(`/assessment/check/${user.id}`);
          const result = checkRes.data;

          if (result.hasAssessment) {
            navigate("/student"); // ✅ FIXED
          } else {
            navigate("/assessment");
          }

        } catch (error) {
          console.error("Assessment check error:", error);
          navigate("/assessment");
        }

      } else {
        navigate("/admin");
      }

    } catch (err) {
      console.log("ERROR:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
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
        value={email}
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
        value={password}
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
        disabled={loading}
        style={{
          width: "100%",
          padding: "10px",
          background: loading ? "#999" : "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer"
        }}
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      <p style={{ marginTop: "15px", textAlign: "center" }}>
        Don’t have an account?{" "}
        <span
          style={{ color: "blue", cursor: "pointer" }}
          onClick={() => navigate("/register")}
        >
          Sign Up
        </span>
      </p>
    </div>
  );
}

export default Login;