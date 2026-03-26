import { useState } from "react";
import API from "../services/api";

function MoodForm() {
  const [mood, setMood] = useState("");

  const submitMood = async () => {
    try {
      const res = await API.post("/moods", { mood });
      alert(res.data.message);
    } catch (err) {
      console.log(err);
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