import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

function Chat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role");
  const selectedStudent = localStorage.getItem("chatStudentId");

  const isStudent = role === "student";
  const roomId = role === "student" ? userId : selectedStudent;

  useEffect(() => {
    if (!roomId) return;

    socket.emit("joinRoom", roomId);

    socket.on("loadMessages", (data) => {
      setMessages(data);
      const hasUnseen = data.some(
        (msg) => !msg.seen && String(msg.senderId) !== String(userId)
      );
      if (hasUnseen) {
        socket.emit("markSeen", { roomId: String(roomId), userId: String(userId) });
      }
    });

    socket.on("receiveMessage", (data) => {
      setMessages((prev) => [...prev, data]);
      if (String(data.senderId) !== String(userId)) {
        socket.emit("markSeen", { roomId: String(roomId), userId: String(userId) });
      }
    });

    socket.on("messagesSeen", (updatedMessages) => {
      setMessages(updatedMessages);
    });

    socket.on("typing", () => setIsTyping(true));
    socket.on("stopTyping", () => setIsTyping(false));

    return () => {
      socket.off("receiveMessage");
      socket.off("loadMessages");
      socket.off("messagesSeen");
      socket.off("typing");
      socket.off("stopTyping");
    };
  }, [roomId, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTyping = (e) => {
    setMessage(e.target.value);
    socket.emit("typing", { roomId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", { roomId });
    }, 1000);
  };

  const sendMessage = () => {
    if (!message.trim() || !roomId) return;
    socket.emit("sendMessage", {
      roomId: String(roomId),
      senderId: String(userId),
      message,
    });
    socket.emit("stopTyping", { roomId });
    setMessage("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={s.page}>
      {/* Outer wrapper (full screen for counselor, phone-frame for student) */}
      <div style={isStudent ? s.phoneFrame : s.fullFrame}>

        {isStudent && <div style={s.statusBar} />}

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            {isStudent ? (
              <button onClick={() => navigate("/student", { state: { step: "dashboard" } })} style={s.backBtn}>←</button>
            ) : (
              <button onClick={() => navigate("/admin")} style={s.backBtn}>←</button>
            )}
            <div style={s.avatar}>
              {isStudent ? "👨‍⚕️" : "🎓"}
            </div>
            <div>
              <div style={s.headerName}>
                {isStudent ? "Your Counselor" : "Student Chat"}
              </div>
              <div style={s.headerSub}>
                {isTyping ? (
                  <span style={s.typingText}>
                    <span style={{ ...s.dot, animationDelay: "0ms" }} />
                    <span style={{ ...s.dot, animationDelay: "160ms" }} />
                    <span style={{ ...s.dot, animationDelay: "320ms" }} />
                    typing…
                  </span>
                ) : "Online ●"}
              </div>
            </div>
          </div>
          <div style={s.headerIcons}>💙</div>
        </div>

        {/* Messages */}
        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={s.emptyState}>
              <div style={s.emptyIcon}>💬</div>
              <p style={s.emptyText}>No messages yet.<br />Start the conversation!</p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isMe = String(msg.senderId) === String(userId);
            const isLast = i === messages.length - 1;

            return (
              <div
                key={i}
                className="animate-fadeIn"
                style={{
                  display: "flex",
                  justifyContent: isMe ? "flex-end" : "flex-start",
                  marginBottom: "6px",
                  alignItems: "flex-end",
                  gap: "8px",
                }}
              >
                {!isMe && <div style={s.msgAvatar}>{isStudent ? "👨‍⚕️" : "🎓"}</div>}

                <div style={isMe ? s.myBubble : s.theirBubble}>
                  <span style={s.msgText}>{msg.message}</span>
                  <div style={s.msgMeta}>
                    <span>{formatTime(msg.createdAt)}</span>
                    {isMe && isLast && (
                      <span style={{ marginLeft: "4px" }}>
                        {msg.seen ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "6px" }}>
              <div style={s.msgAvatar}>{isStudent ? "👨‍⚕️" : "🎓"}</div>
              <div style={s.typingBubble}>
                <span style={{ ...s.typingDot, animationDelay: "0ms" }} />
                <span style={{ ...s.typingDot, animationDelay: "180ms" }} />
                <span style={{ ...s.typingDot, animationDelay: "360ms" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div style={s.inputBar}>
          <input
            value={message}
            onChange={handleTyping}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            style={s.input}
          />
          <button
            onClick={sendMessage}
            style={{ ...s.sendBtn, opacity: message.trim() ? 1 : 0.5 }}
          >
            ➤
          </button>
        </div>

      </div>
    </div>
  );
}

const s = {
  page: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "linear-gradient(145deg,#5B6BD8 0%,#7C6FCD 50%,#9B87E8 100%)",
    fontFamily: "'Lato',sans-serif",
  },
  phoneFrame: {
    width: "390px",
    height: "780px",
    display: "flex",
    flexDirection: "column",
    background: "#F3F4F8",
    borderRadius: "36px",
    overflow: "hidden",
    boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
  },
  fullFrame: {
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#F3F4F8",
    borderRadius: 0,
    overflow: "hidden",
    boxShadow: "none",
  },
  statusBar: {
    height: "14px",
    background: "linear-gradient(90deg,#5B6BD8,#7C6FCD)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    background: "linear-gradient(135deg,#5B6BD8 0%,#7C6FCD 100%)",
    color: "white",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  backBtn: {
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.25)",
    color: "#fff",
    borderRadius: "50%",
    width: "34px",
    height: "34px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 700,
    flexShrink: 0,
    fontFamily: "'Lato',sans-serif",
  },
  avatar: {
    width: "42px",
    height: "42px",
    background: "rgba(255,255,255,0.2)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "22px",
  },
  headerName: {
    fontWeight: "700",
    fontSize: "16px",
    fontFamily: "'Poppins',sans-serif",
  },
  headerSub: {
    fontSize: "13px",
    opacity: 0.85,
    marginTop: "2px",
  },
  headerIcons: {
    fontSize: "20px",
  },
  typingText: {
    display: "flex",
    alignItems: "center",
    gap: "3px",
  },
  dot: {
    display: "inline-block",
    width: "5px",
    height: "5px",
    background: "rgba(255,255,255,0.8)",
    borderRadius: "50%",
    animation: "typingBounce 0.9s ease infinite",
  },
  messages: {
    flex: 1,
    padding: "16px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    opacity: 0.5,
    marginTop: "80px",
  },
  emptyIcon: { fontSize: "48px" },
  emptyText: { textAlign: "center", color: "#7B7F9E", lineHeight: 1.65, fontSize: "15px" },
  msgAvatar: {
    width: "28px",
    height: "28px",
    background: "#EEF2FF",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    flexShrink: 0,
  },
  myBubble: {
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "white",
    padding: "10px 14px",
    borderRadius: "18px 18px 4px 18px",
    maxWidth: "72%",
    boxShadow: "0 2px 10px rgba(91,107,216,0.3)",
  },
  theirBubble: {
    background: "white",
    color: "#2D3047",
    padding: "10px 14px",
    borderRadius: "18px 18px 18px 4px",
    maxWidth: "72%",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  msgText: {
    display: "block",
    fontSize: "15px",
    lineHeight: 1.6,
    fontFamily: "'Lato',sans-serif",
  },
  msgMeta: {
    display: "flex",
    justifyContent: "flex-end",
    fontSize: "10px",
    opacity: 0.7,
    marginTop: "4px",
    gap: "2px",
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
  typingDot: {
    display: "inline-block",
    width: "7px",
    height: "7px",
    background: "#9CA3AF",
    borderRadius: "50%",
    animation: "typingBounce 0.9s ease infinite",
  },
  inputBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    background: "white",
    borderTop: "1px solid #E5E7EB",
  },
  input: {
    flex: 1,
    padding: "12px 18px",
    borderRadius: "24px",
    border: "2px solid rgba(91,107,216,0.2)",
    outline: "none",
    fontSize: "15px",
    fontFamily: "'Lato',sans-serif",
    background: "#FAFBFF",
    transition: "border-color 0.2s",
    color: "#2D3047",
  },
  sendBtn: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "linear-gradient(135deg,#5B6BD8,#7C6FCD)",
    color: "white",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(91,107,216,0.38)",
    transition: "opacity 0.2s",
    flexShrink: 0,
  },
};

export default Chat;
