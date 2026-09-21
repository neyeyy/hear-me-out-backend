import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

// Official PHQ-9 (depression) and GAD-7 (anxiety) screening instruments —
// wording and scale match the standard clinical form.
const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things.",
  "Feeling down, depressed, or hopeless.",
  "Trouble falling or staying asleep, or sleeping too much.",
  "Feeling tired or having little energy.",
  "Poor appetite or overeating.",
  "Feeling bad about yourself – or that you are a failure or have let yourself or your family down.",
  "Trouble concentrating on things, such as reading the newspaper or watching television.",
  "Moving or speaking so slowly that other people could have noticed. Or the opposite – being so fidgety or restless that you have been moving around a lot more than usual.",
  "Thoughts that you would be better off dead, or of hurting yourself in some way.",
];

const GAD7_QUESTIONS = [
  "Feeling nervous, anxious, or on edge.",
  "Not being able to stop or control worrying.",
  "Worrying too much about different things.",
  "Trouble relaxing.",
  "Being so restless that it's hard to sit still.",
  "Becoming easily annoyed or irritable.",
  "Feeling afraid as if something awful might happen.",
];

const questions = [
  ...PHQ9_QUESTIONS.map((text) => ({ text, section: "PHQ9" })),
  ...GAD7_QUESTIONS.map((text) => ({ text, section: "GAD7" })),
];

const OPTIONS_BY_SECTION = {
  PHQ9: [
    { value: 0, label: "Not at all", color: "#4ECDC4" },
    { value: 1, label: "Several days", color: "#6C63FF" },
    { value: 2, label: "More than half the days", color: "#FFB347" },
    { value: 3, label: "Nearly every day", color: "#FF6B6B" }
  ],
  GAD7: [
    { value: 0, label: "Not at all sure", color: "#4ECDC4" },
    { value: 1, label: "Several days", color: "#6C63FF" },
    { value: 2, label: "Over half the days", color: "#FFB347" },
    { value: 3, label: "Nearly every day", color: "#FF6B6B" }
  ],
};

function formatBand(band) {
  if (!band) return "";
  return band.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

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
    simulateTyping(() => {
      addBotMessage("Over the last 2 weeks, how often have you been bothered by the following problems? (PHQ-9)");
      simulateTyping(() => addBotMessage(questions[0].text));
    });
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
      if (next === PHQ9_QUESTIONS.length) {
        // Entering the GAD-7 section
        simulateTyping(() => {
          addBotMessage("Now, over the last 2 weeks, how often have you been bothered by the following problems? (GAD-7)");
          simulateTyping(() => addBotMessage(questions[next].text));
        });
      } else {
        simulateTyping(() => addBotMessage(questions[next].text));
      }
    } else {
      submitAssessment(updated);
    }
  };

  const submitAssessment = async (finalAnswers) => {
    try {
      const phq9Answers = finalAnswers.slice(0, PHQ9_QUESTIONS.length);
      const gad7Answers = finalAnswers.slice(PHQ9_QUESTIONS.length);
      const res = await API.post("/assessment", { phq9Answers, gad7Answers });
      setResult(res.data);

      simulateTyping(() => {
        addBotMessage(`PHQ-9 (depression) score: ${res.data.phq9Score}/27 — ${formatBand(res.data.phq9Severity)}`);
        addBotMessage(`GAD-7 (anxiety) score: ${res.data.gad7Score}/21 — ${formatBand(res.data.gad7Severity)}`);

        if (res.data.severity === "HIGH") {
          addBotMessage("⚠️ We recommend immediate counseling.");
        }
        if (res.data.appointment) {
          const dateStr = res.data.appointment.scheduleDate
            ? new Date(res.data.appointment.scheduleDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
            : null;
          addBotMessage(
            dateStr
              ? `📅 An appointment has been scheduled for you on ${dateStr}.`
              : "📅 An appointment has been scheduled for you."
          );
        }
        if (res.data.severity === "MEDIUM" && !res.data.appointment) {
          addBotMessage("💬 You may consider talking to a counselor.");
        }
      });
    } catch (err) {
      console.log(err);
      addBotMessage("⚠️ Error submitting assessment. Please try again.");
    }
  };

  const goToDashboard = () => navigate("/student");

  const severityColor = result
    ? result.severity === "HIGH" ? "#FF6B6B"
    : result.severity === "MEDIUM" ? "#FFB347"
    : "#4ECDC4"
    : "#6C63FF";

  return (
    <div style={s.page}>
      <div style={s.blob1} />
      <div style={s.blob2} />

      <div className="animate-fadeInUp" style={s.phone}>
        {/* Status bar */}
        <div style={s.statusBar} />

        {/* Header */}
        <div style={s.header}>
          <div style={s.botAvatar}>🤖</div>
          <div>
            <div style={s.botName}>Assessment Bot</div>
            <div style={s.botStatus}>
              {isTyping ? (
                <span style={s.typingRow}>
                  <span style={{ ...s.dot, animationDelay: "0ms" }} />
                  <span style={{ ...s.dot, animationDelay: "180ms" }} />
                  <span style={{ ...s.dot, animationDelay: "360ms" }} />
                  typing…
                </span>
              ) : "Online ●"}
            </div>
          </div>
        </div>

        {/* Welcome / Chat */}
        {!started ? (
          <div style={s.welcome}>
            <div style={s.welcomeIcon}>🧠</div>
            <h2 style={s.welcomeTitle}>Mental Health Check‑in</h2>
            <p style={s.welcomeText}>
              A PHQ-9 and GAD-7 assessment to understand how you're feeling.
              Your answers are private and help us support you better.
            </p>
            <div style={s.pillRow}>
              <span style={s.pill}>🕐 ~5 min</span>
              <span style={s.pill}>🔒 Private</span>
              <span style={s.pill}>💙 16 Questions</span>
            </div>
            <button onClick={handleStart} style={s.startBtn}>
              Begin Assessment →
            </button>
          </div>
        ) : (
          <>
            <div style={s.chat}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className="animate-fadeIn"
                  style={{
                    display: "flex",
                    justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
                    marginBottom: "10px",
                  }}
                >
                  {msg.sender === "bot" && (
                    <div style={s.miniAvatar}>🤖</div>
                  )}
                  <div style={msg.sender === "user" ? s.userBubble : s.botBubble}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={s.miniAvatar}>🤖</div>
                  <div style={s.typingBubble}>
                    <span style={{ ...s.dot, animationDelay: "0ms" }} />
                    <span style={{ ...s.dot, animationDelay: "180ms" }} />
                    <span style={{ ...s.dot, animationDelay: "360ms" }} />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Options or Result button */}
            {!result ? (
              <div style={s.options}>
                <p style={s.optHint}>Choose your answer:</p>
                <div style={s.optGrid}>
                  {OPTIONS_BY_SECTION[questions[current].section].map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleAnswer(opt.value, opt.label)}
                      style={{ ...s.optBtn, borderColor: opt.color, color: opt.color }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = opt.color;
                        e.currentTarget.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#fff";
                        e.currentTarget.style.color = opt.color;
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={s.resultPanel}>
                <div style={{ ...s.severityBadge, background: severityColor }}>
                  {result.severity} RISK
                </div>
                <button onClick={goToDashboard} style={s.continueBtn}>
                  Go to Dashboard →
                </button>
              </div>
            )}
          </>
        )}
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
    background: "linear-gradient(145deg,#5B6BD8 0%,#7C6FCD 50%,#9B87E8 100%)",
    padding: "20px",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Lato',sans-serif",
  },
  blob1: {
    position: "absolute", width: "400px", height: "400px",
    background: "rgba(255,255,255,0.06)", borderRadius: "50%",
    top: "-140px", right: "-120px", pointerEvents: "none",
  },
  blob2: {
    position: "absolute", width: "280px", height: "280px",
    background: "rgba(255,101,132,0.1)", borderRadius: "50%",
    bottom: "-80px", left: "-60px", pointerEvents: "none",
  },
  phone: {
    width: "100%",
    maxWidth: "420px",
    height: "88vh",
    minHeight: "600px",
    background: "#fff",
    borderRadius: "32px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 30px 80px rgba(0,0,0,0.28)",
    position: "relative",
    zIndex: 1,
  },
  statusBar: {
    height: "12px",
    background: "linear-gradient(90deg,#5B6BD8,#7C6FCD)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "16px 20px",
    background: "linear-gradient(135deg,#5B6BD8 0%,#7C6FCD 100%)",
    color: "white",
  },
  botAvatar: {
    width: "44px",
    height: "44px",
    background: "rgba(255,255,255,0.2)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
  },
  botName: { fontWeight: "700", fontSize: "16px", lineHeight: 1.2, fontFamily: "'Poppins',sans-serif" },
  botStatus: { fontSize: "13px", opacity: 0.85, marginTop: "2px" },
  typingRow: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  dot: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    background: "currentColor",
    borderRadius: "50%",
    animation: "typingBounce 0.9s ease infinite",
  },
  welcome: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "32px 28px",
    textAlign: "center",
    background: "#FAFBFF",
  },
  welcomeIcon: {
    fontSize: "64px",
    marginBottom: "20px",
    lineHeight: 1,
  },
  welcomeTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#2D3047",
    marginBottom: "14px",
    fontFamily: "'Poppins',sans-serif",
  },
  welcomeText: {
    fontSize: "15px",
    color: "#7B7F9E",
    lineHeight: 1.65,
    marginBottom: "24px",
  },
  pillRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: "32px",
  },
  pill: {
    padding: "6px 14px",
    background: "#EEF0FD",
    color: "#5B6BD8",
    borderRadius: "99px",
    fontSize: "12px",
    fontWeight: "600",
    fontFamily: "'Poppins',sans-serif",
  },
  startBtn: {
    padding: "16px 40px",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "white",
    border: "none",
    borderRadius: "14px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(91,107,216,0.38)",
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "0.02em",
  },
  chat: {
    flex: 1,
    padding: "16px",
    overflowY: "auto",
    background: "#F3F4F8",
  },
  miniAvatar: {
    width: "30px",
    height: "30px",
    background: "#EEF2FF",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    marginRight: "8px",
    flexShrink: 0,
    alignSelf: "flex-end",
  },
  botBubble: {
    background: "white",
    color: "#2D3047",
    padding: "12px 16px",
    borderRadius: "18px 18px 18px 4px",
    maxWidth: "72%",
    fontSize: "15px",
    lineHeight: 1.6,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    fontFamily: "'Lato',sans-serif",
  },
  userBubble: {
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "white",
    padding: "12px 16px",
    borderRadius: "18px 18px 4px 18px",
    maxWidth: "72%",
    fontSize: "15px",
    lineHeight: 1.6,
    boxShadow: "0 2px 8px rgba(91,107,216,0.3)",
    fontFamily: "'Lato',sans-serif",
  },
  typingBubble: {
    background: "white",
    padding: "12px 16px",
    borderRadius: "18px 18px 18px 4px",
    display: "flex",
    gap: "5px",
    alignItems: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  options: {
    padding: "14px 16px 16px",
    background: "white",
    borderTop: "1px solid #E5E7EB",
  },
  optHint: {
    fontSize: "11px",
    color: "#A8AECB",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "10px",
    fontFamily: "'Poppins',sans-serif",
  },
  optGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  optBtn: {
    padding: "11px 8px",
    borderRadius: "12px",
    border: "2px solid",
    background: "#fff",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.18s ease",
    fontFamily: "'Poppins',sans-serif",
  },
  resultPanel: {
    padding: "16px",
    background: "white",
    borderTop: "1px solid #E5E7EB",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },
  severityBadge: {
    padding: "8px 24px",
    borderRadius: "99px",
    color: "white",
    fontWeight: "800",
    fontSize: "14px",
    letterSpacing: "0.05em",
  },
  continueBtn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(91,107,216,0.35)",
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "0.02em",
  },
};

export default Assessment;
