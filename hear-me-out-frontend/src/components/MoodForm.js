import { useState } from "react";
import API from "../services/api";

function MoodForm() {
  const [mood, setMood] = useState("");
  const [msg,  setMsg]  = useState({ text: "", ok: false });

  const submitMood = async () => {
    try {
      const res = await API.post("/moods", { mood });
      setMsg({ text: res.data.message || "Mood submitted!", ok: true });
    } catch (err) {
      console.log(err);
      setMsg({ text: "Failed to submit mood.", ok: false });
    }
  };

  return (
    <div style={{
      border: "1px solid #ddd",
      padding: "15px",
      borderRadius: "12px",
      background: "#fff"
    }}>
      <h3>How are you feeling today?</h3>

      <select
        style={{ width: "100%", padding: "10px", marginTop: "10px" }}
        onChange={(e) => setMood(e.target.value)}
      >
        <option value="">Select Mood</option>
        <option value="HAPPY">😊 Happy</option>
        <option value="SAD">😢 Sad</option>
        <option value="STRESSED">😫 Stressed</option>
        <option value="ANXIOUS">😰 Anxious</option>
      </select>

      {msg.text && (
        <div style={{ marginTop:"8px", fontSize:"13px", fontWeight:600, textAlign:"center", color: msg.ok ? "#4CAF50" : "#F87171" }}>
          {msg.text}
        </div>
      )}

      <button
        style={{
          marginTop: "10px",
          width: "100%",
          padding: "10px",
          background: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "8px"
        }}
        onClick={submitMood}
      >
        Submit Mood
      </button>
    </div>
  );
}

export default MoodForm;