import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";
import MoodCalendar from "../../components/MoodCalendar";

const quotes = {
  HAPPY: "Keep shining, you're doing great! 😊",
  SAD: "It's okay to feel sad. Better days are coming 💙",
  STRESSED: "Take a deep breath. One step at a time 🌿",
  ANXIOUS: "You are safe. This feeling will pass 🌈"
};

const moodStyles = {
  HAPPY: { bg: "#fff9c4", border: "#fdd835" },
  SAD: { bg: "#e3f2fd", border: "#42a5f5" },
  STRESSED: { bg: "#ffe0b2", border: "#fb8c00" },
  ANXIOUS: { bg: "#ede7f6", border: "#7e57c2" }
};

function StudentDashboard() {
  const [selectedMood, setSelectedMood] = useState("");
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [appointment, setAppointment] = useState(null);

  const navigate = useNavigate();

  // 🔥 FIX: AUTO REFRESH APPOINTMENT
  useEffect(() => {
    fetchAppointment();

    const interval = setInterval(() => {
      fetchAppointment();
    }, 3000); // every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchAppointment = async () => {
    try {
      const res = await API.get("/appointments/my");

      // 🔥 FIX: handle array or object response
      const data = res.data;

      if (Array.isArray(data)) {
        setAppointment(data.length > 0 ? data[0] : null);
      } else {
        setAppointment(data);
      }

    } catch (err) {
      console.log(err);
    }
  };

  const handleMoodSelect = (mood) => {
    setSelectedMood(mood);
    setQuote(quotes[mood]);
    setShowPopup(true);
  };

  const handleContinue = async () => {
    try {
      await API.post("/moods", {
        mood: selectedMood,
        note: note
      });

      // 🔥 FORCE REFRESH AFTER ACTION
      setTimeout(() => {
        fetchAppointment();
      }, 500);

    } catch (err) {
      console.log(err);
    }

    setShowPopup(false);
    setShowCalendar(true);
  };

  const handleTrackAgain = () => {
    setShowCalendar(false);
    setSelectedMood("");
    setNote("");
    setQuote("");
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #dfe9f3, #ffffff)",
      fontFamily: "Arial"
    }}>
      <div style={{
        width: "380px",
        background: "white",
        borderRadius: "25px",
        padding: "20px",
        boxShadow: "0 15px 40px rgba(0,0,0,0.15)"
      }}>

        <h2 style={{ textAlign: "center", marginBottom: "10px" }}>
          Hear Me Out 💙
        </h2>

        {!showCalendar && !showPopup && (
          <>
            <h3 style={{
              textAlign: "center",
              marginBottom: "15px",
              color: "#555"
            }}>
              How are you feeling today?
            </h3>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "20px"
            }}>
              {[
                { mood: "HAPPY", emoji: "😊" },
                { mood: "SAD", emoji: "😢" },
                { mood: "STRESSED", emoji: "😫" },
                { mood: "ANXIOUS", emoji: "😰" }
              ].map((item, i) => {
                const active = selectedMood === item.mood;

                return (
                  <button
                    key={i}
                    onClick={() => handleMoodSelect(item.mood)}
                    style={{
                      width: "70px",
                      height: "70px",
                      fontSize: "30px",
                      borderRadius: "20px",
                      border: active
                        ? `2px solid ${moodStyles[item.mood].border}`
                        : "1px solid #eee",
                      background: active
                        ? moodStyles[item.mood].bg
                        : "#fff",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      boxShadow: active
                        ? `0 0 15px ${moodStyles[item.mood].border}`
                        : "0 4px 10px rgba(0,0,0,0.1)",
                      transform: active ? "scale(1.1)" : "scale(1)"
                    }}
                  >
                    {item.emoji}
                  </button>
                );
              })}
            </div>

            <textarea
              placeholder="Add a note (optional)..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: "100%",
                height: "80px",
                padding: "12px",
                borderRadius: "15px",
                border: "1px solid #ddd",
                outline: "none",
                fontSize: "14px",
                resize: "none",
                boxShadow: "inset 0 2px 5px rgba(0,0,0,0.05)"
              }}
            />
          </>
        )}

        {showPopup && (
          <div style={{
            marginTop: "20px",
            padding: "20px",
            borderRadius: "15px",
            textAlign: "center",
            background: selectedMood
              ? moodStyles[selectedMood].bg
              : "#f0f4ff"
          }}>
            <h3>Your Mood 💙</h3>
            <p><strong>{selectedMood}</strong></p>

            <p style={{
              fontStyle: "italic",
              marginTop: "10px"
            }}>
              {quote}
            </p>

            <button
              onClick={handleContinue}
              style={{
                marginTop: "15px",
                padding: "10px 20px",
                background: "#0084ff",
                color: "white",
                border: "none",
                borderRadius: "20px",
                cursor: "pointer",
                boxShadow: "0 5px 15px rgba(0,132,255,0.3)"
              }}
            >
              Continue
            </button>
          </div>
        )}

        {showCalendar && (
          <div style={{ marginTop: "20px" }}>
            <MoodCalendar />

            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <button
                onClick={() => navigate("/chat")}
                style={{
                  padding: "10px 20px",
                  marginRight: "10px",
                  background: "#0084ff",
                  color: "white",
                  border: "none",
                  borderRadius: "20px"
                }}
              >
                Go to Chat 💬
              </button>

              <button
                onClick={handleTrackAgain}
                style={{
                  padding: "10px 20px",
                  background: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "20px"
                }}
              >
                Track Again 🔁
              </button>
            </div>

            <div style={{
              marginTop: "20px",
              padding: "15px",
              borderRadius: "12px",
              background: "#fff",
              border: "1px solid #ddd"
            }}>
              <h3>Your Appointment</h3>

              {appointment ? (
                <>
                  <p><strong>Severity:</strong> {appointment.severity}</p>
                  <p><strong>Assigned To:</strong> {appointment.assignedTo}</p>
                  <p><strong>Status:</strong> {appointment.status}</p>
                  <p>
                    <strong>Date:</strong>{" "}
                    {new Date(appointment.scheduleDate).toLocaleString()}
                  </p>
                </>
              ) : (
                <p>No appointment yet</p>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default StudentDashboard;