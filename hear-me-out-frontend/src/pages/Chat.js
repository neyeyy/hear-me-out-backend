import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

function Chat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const roomId = "room1";
  const senderId = Math.random().toString(36).substring(7);

  useEffect(() => {
    socket.emit("joinRoom", roomId);

    socket.on("loadMessages", (data) => {
      setMessages(data);
    });

    socket.on("receiveMessage", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off("receiveMessage");
      socket.off("loadMessages");
    };
  }, []);

  const sendMessage = () => {
    if (!message) return;

    socket.emit("sendMessage", {
      roomId,
      senderId,
      message
    });

    setMessage("");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Chat 💬</h2>

      <div style={{
        height: "300px",
        overflowY: "scroll",
        border: "1px solid #ddd",
        padding: "10px",
        marginBottom: "10px"
      }}>
        {messages.map((msg, i) => (
          <p key={i}>
            <strong>{msg.senderId}:</strong> {msg.message}
          </p>
        ))}
      </div>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type message..."
        style={{ width: "70%", padding: "10px" }}
      />

      <button onClick={sendMessage} style={{ padding: "10px" }}>
        Send
      </button>
    </div>
  );
}

export default Chat;