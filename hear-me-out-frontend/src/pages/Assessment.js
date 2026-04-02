import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

const questions = [
  "I feel nervous or anxious",
  "I have trouble sleeping",
  "I feel overwhelmed",
  "I feel sad or hopeless",
  "I have difficulty concentrating"
];

function Assessment() {
  const [messages, setMessages] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [started, setStarted] = useState(false);

  const navigate = useNavigate();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const addBotMessage = useCallback((text) => {
    setMessages((prev) => [...prev, { sender: "bot", text }]);
  }, []);

  const addUserMessage = useCallback((text) => {
    setMessages((prev) => [...prev, { sender: "user", text }]);
  }, []);

  const simulateTyping = useCallback((callback) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      callback();
    }, 800);
  }, []);

  const startChat = useCallback(() => {
    addBotMessage("Hello 👋 I'm your Assessment Bot.");
    simulateTyping(() => addBotMessage(questions[0]));
  }, [addBotMessage, simulateTyping]);

  const handleStart = () => {
    setStarted(true);
    startChat();
  };

  const handleAnswer = (value, label) => {
    addUserMessage(label);

    const updated = [...answers, value];
    setAnswers(updated);

    if (current < questions.length - 1) {
      const next = current + 1;
      setCurrent(next);
      simulateTyping(() => addBotMessage(questions[next]));
    } else {
      submitAssessment(updated);
    }
  };

  // ✅ FIXED LOGIC (KEEP THIS)
  const submitAssessment = async (finalAnswers) => {
    try {
      const res = await API.post("/assessment", { answers: finalAnswers });

      setResult(res.data);

      simulateTyping(() => {
        addBotMessage(`Your score is ${res.data.score}`);
        addBotMessage(`Severity: ${res.data.severity}`);

        // ✅ FIX: correct severity
        if (res.data.severity === "HIGH") {
          addBotMessage("⚠️ We recommend immediate counseling.");
        }

        // ✅ SHOW APPOINTMENT
        if (res.data.appointment) {
          addBotMessage("📅 An appointment has been scheduled for you.");
        }

        if (res.data.severity === "MEDIUM" && !res.data.appointment) {
          addBotMessage("💬 You may consider talking to a counselor.");
        }
      });

    } catch (err) {
      console.log(err);
      alert("Error submitting assessment");
    }
  };

  const goToDashboard = () => {
    navigate("/student");
  };

  return (
    <div style={{
      maxWidth: "420px",
      margin: "auto",
      height: "95vh",
      display: "flex",
      flexDirection: "column",
      borderRadius: "15px",
      overflow: "hidden",
      boxShadow: "0 5px 20px rgba(0,0,0,0.2)",
      fontFamily: "Arial"
    }}>

      {/* HEADER */}
      <div style={{
        padding: "15px",
        background: "#0084ff",
        color: "white",
        display: "flex",
        alignItems: "center",
        gap: "10px"
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "bold",
          color: "#0084ff"
        }}>
          🤖
        </div>

        <div>
          <div style={{ fontWeight: "bold" }}>Assessment Bot</div>
          <div style={{ fontSize: "12px", opacity: 0.8 }}>
            {isTyping ? "Typing..." : "Online"}
          </div>
        </div>
      </div>

      {!started ? (
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px",
          textAlign: "center"
        }}>
          <h2>Welcome 👋</h2>

          <p style={{ marginBottom: "20px" }}>
            You are about to take a short mental health assessment.
          </p>

          <p style={{ marginBottom: "30px", fontSize: "14px", color: "#555" }}>
            Please answer honestly. This will only take a few minutes.
          </p>

          <button
            onClick={handleStart}
            style={{
              padding: "12px 25px",
              background: "#0084ff",
              color: "white",
              border: "none",
              borderRadius: "25px",
              fontSize: "16px",
              cursor: "pointer"
            }}
          >
            Start Assessment
          </button>
        </div>
      ) : (
        <>
          {/* CHAT */}
          <div style={{
            flex: 1,
            padding: "15px",
            background: "#e5ddd5",
            overflowY: "auto"
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
                marginBottom: "10px"
              }}>
                <div style={{
                  padding: "10px 14px",
                  borderRadius: "18px",
                  maxWidth: "70%",
                  background: msg.sender === "user" ? "#0084ff" : "#fff",
                  color: msg.sender === "user" ? "white" : "black"
                }}>
                  {msg.text}
                </div>
              </div>
            ))}

            {isTyping && <div>Typing...</div>}
            <div ref={bottomRef} />
          </div>

          {/* ✅ POLISHED BUTTONS (RESTORED DESIGN) */}
          {!result && (
            <div style={{
              padding: "10px",
              background: "#fff",
              borderTop: "1px solid #ddd",
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              justifyContent: "center"
            }}>
              {[
                { value: 0, label: "Not at all" },
                { value: 1, label: "Several days" },
                { value: 2, label: "More than half" },
                { value: 3, label: "Nearly every day" }
              ].map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt.value, opt.label)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "25px",
                    border: "1px solid #0084ff",
                    background: "#fff",
                    color: "#0084ff",
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#0084ff";
                    e.target.style.color = "#fff";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "#fff";
                    e.target.style.color = "#0084ff";
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* RESULT */}
          {result && (
            <div style={{ padding: "10px", textAlign: "center" }}>
              <button
                onClick={goToDashboard}
                style={{
                  padding: "10px 20px",
                  background: "#0084ff",
                  color: "white",
                  border: "none",
                  borderRadius: "20px"
                }}
              >
                Continue
              </button>
            </div>
          )}
        </>
      )}

    </div>
  );
}

export default Assessment;