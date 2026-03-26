import { useState, useEffect } from "react";
import API from "../../services/api";
import MoodCalendar from "../../components/MoodCalendar";

const quotes = {
  HAPPY: "Keep shining, you're doing great! 😊",
  SAD: "It's okay to feel sad. Better days are coming 💙",
  STRESSED: "Take a deep breath. One step at a time 🌿",
  ANXIOUS: "You are safe. This feeling will pass 🌈"
};

function StudentDashboard() {
  const [selectedMood, setSelectedMood] = useState("");
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [appointment, setAppointment] = useState(null);

  useEffect(() => {
    fetchAppointment();
  }, []);

  const fetchAppointment = async () => {
    try {
      const res = await API.get("/appointments/my");
      setAppointment(res.data);
    } catch (err) {
      console.log(err);
    }
  };

  // 🔥 POPUP ON CLICK
  const handleMoodSelect = (mood) => {
    setSelectedMood(mood);
    setQuote(quotes[mood]);
    setShowPopup(true); // 👈 SHOW POPUP HERE
  };

  // 🔥 SAVE + CONTINUE
  const handleContinue = async () => {
    try {
      await API.post("/moods", {
        mood: selectedMood,
        note: note
      });

      fetchAppointment();

    } catch (err) {
      console.log(err);
    }

    setShowPopup(false);
    setShowCalendar(true);
  };

  return (
    <div style={{
      padding: "20px",
      maxWidth: "400px",
      margin: "auto",
      fontFamily: "Arial"
    }}>

      <h2 style={{ textAlign: "center" }}>Hear Me Out 💙</h2>

      {/* STEP 1: Mood Input */}
      {!showCalendar && !showPopup && (
        <>
          <h3>How are you feeling today?</h3>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "10px"
          }}>
            <button onClick={() => handleMoodSelect("HAPPY")}>😊</button>
            <button onClick={() => handleMoodSelect("SAD")}>😢</button>
            <button onClick={() => handleMoodSelect("STRESSED")}>😫</button>
            <button onClick={() => handleMoodSelect("ANXIOUS")}>😰</button>
          </div>

          <textarea
            placeholder="Add a note (optional)"
            value={note}
            style={{
              width: "100%",
              marginTop: "15px",
              padding: "10px",
              borderRadius: "8px"
            }}
            onChange={(e) => setNote(e.target.value)}
          />
        </>
      )}

      {/* 🔥 POPUP */}
      {showPopup && (
        <div style={{
          marginTop: "20px",
          padding: "20px",
          background: "#f0f4ff",
          borderRadius: "12px",
          textAlign: "center"
        }}>
          <h3>Your Mood 💙</h3>
          <p><strong>{selectedMood}</strong></p>

          <p style={{ fontStyle: "italic", marginTop: "10px" }}>
            {quote}
          </p>

          <button
            onClick={handleContinue}
            style={{
              marginTop: "15px",
              padding: "10px 20px",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "8px"
            }}
          >
            OK
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {showCalendar && (
        <div style={{ marginTop: "20px" }}>
          
          <MoodCalendar />

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
  );
}

export default StudentDashboard;