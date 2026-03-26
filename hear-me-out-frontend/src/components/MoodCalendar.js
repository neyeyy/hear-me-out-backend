import { useEffect, useState } from "react";
import API from "../services/api";

const moods = {
  HAPPY: { color: "#4CAF50", emoji: "😊" },
  SAD: { color: "#2196F3", emoji: "😢" },
  STRESSED: { color: "#FF9800", emoji: "😫" },
  ANXIOUS: { color: "#F44336", emoji: "😰" }
};

function MoodCalendar() {
  const [days, setDays] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMoods();
  }, []);

  const fetchMoods = async () => {
    try {
      const res = await API.get("/moods");

      const moodData = {};

      res.data.forEach((item) => {
        const date = new Date(item.createdAt);
        const day = date.getDate();

        // 🔥 If multiple entries in same day → keep latest
        moodData[day] = item.mood;
      });

      setDays(moodData);
    } catch (err) {
      console.log("FETCH ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p>Loading mood history...</p>;
  }

  return (
    <div>
      <h3 style={{ textAlign: "center" }}>Your Mood History</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "8px",
          marginTop: "10px"
        }}
      >
        {[...Array(30)].map((_, i) => {
          const day = i + 1;
          const mood = days[day];

          return (
            <div
              key={day}
              style={{
                height: "45px",
                background: mood ? moods[mood].color : "#eee",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
                fontSize: "18px",
                color: mood ? "white" : "#333",
                fontWeight: "bold"
              }}
            >
              {mood ? moods[mood].emoji : day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MoodCalendar;