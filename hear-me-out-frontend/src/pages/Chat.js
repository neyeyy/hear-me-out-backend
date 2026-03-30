import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

function Chat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const userId = localStorage.getItem("userId");
  const role = localStorage.getItem("role");
  const selectedStudent = localStorage.getItem("chatStudentId");

  const isStudent = role === "student";
  const roomId = role === "student" ? userId : selectedStudent;

  useEffect(() => {
    if (!roomId) return;

    socket.emit("joinRoom", roomId);

    // ✅ LOAD MESSAGES
    socket.on("loadMessages", (data) => {
      setMessages(data);

      const hasUnseen = data.some(
        (msg) =>
          !msg.seen && String(msg.senderId) !== String(userId)
      );

      if (hasUnseen) {
        socket.emit("markSeen", {
          roomId: String(roomId),
          userId: String(userId)
        });
      }
    });

    // ✅ RECEIVE MESSAGE
    socket.on("receiveMessage", (data) => {
      setMessages((prev) => [...prev, data]);

      // 🔥 mark seen if message is from OTHER user
      if (String(data.senderId) !== String(userId)) {
        socket.emit("markSeen", {
          roomId: String(roomId),
          userId: String(userId)
        });
      }
    });

    // ✅ REAL-TIME SEEN UPDATE (FROM DB)
    socket.on("messagesSeen", (updatedMessages) => {
      setMessages(updatedMessages);
    });

    // 🔥 TYPING EVENTS
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
    if (!message || !roomId) return;

    socket.emit("sendMessage", {
      roomId: String(roomId),
      senderId: String(userId),
      message
    });

    socket.emit("stopTyping", { roomId });

    setMessage("");
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      background: "#ddd",
      fontFamily: "Arial"
    }}>
      <div style={{
        width: isStudent ? "375px" : "100%",
        height: isStudent ? "700px" : "100%",
        display: "flex",
        flexDirection: "column",
        background: "white",
        borderRadius: isStudent ? "20px" : "0",
        overflow: "hidden",
        boxShadow: isStudent ? "0 0 20px rgba(0,0,0,0.2)" : "none"
      }}>

        {isStudent && <div style={{ height: "20px", background: "#000" }} />}

        <div style={{
          padding: "15px",
          background: "#2196F3",
          color: "white",
          textAlign: "center"
        }}>
          <h3>Chat 💬</h3>
        </div>

        <div style={{
          flex: 1,
          padding: "15px",
          overflowY: "auto",
          background: "#f5f5f5"
        }}>
          {messages.map((msg, i) => {
            const isMe = String(msg.senderId) === String(userId);
            const isLast = i === messages.length - 1;

            return (
              <div key={i} style={{
                display: "flex",
                justifyContent: isMe ? "flex-end" : "flex-start",
                marginBottom: "10px"
              }}>
                <div style={{
                  maxWidth: "60%",
                  padding: "10px",
                  borderRadius: "15px",
                  background: isMe ? "#4CAF50" : "#fff",
                  color: isMe ? "white" : "black",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                }}>
                  {msg.message}

                  <div style={{
                    fontSize: "10px",
                    opacity: 0.6,
                    marginTop: "5px",
                    textAlign: "right"
                  }}>
                    {msg.createdAt &&
                      new Date(msg.createdAt).toLocaleTimeString()}
                  </div>

                  {isMe && isLast && (
                    <div style={{
                      fontSize: "10px",
                      opacity: 0.7,
                      marginTop: "3px",
                      textAlign: "right"
                    }}>
                      {msg.seen ? "Seen ✓✓" : "Sent ✓"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 🔥 TYPING */}
          {isTyping && (
            <div style={{
              fontSize: "12px",
              color: "#555",
              marginBottom: "10px"
            }}>
              Typing...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div style={{
          display: "flex",
          padding: "10px",
          borderTop: "1px solid #ddd"
        }}>
          <input
            value={message}
            onChange={handleTyping}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "20px",
              border: "1px solid #ccc",
              outline: "none"
            }}
          />

          <button
            onClick={sendMessage}
            style={{
              marginLeft: "10px",
              padding: "10px 15px",
              borderRadius: "20px",
              border: "none",
              background: "#2196F3",
              color: "white",
              cursor: "pointer"
            }}
          >
            Send
          </button>
        </div>

      </div>
    </div>
  );
}

export default Chat;