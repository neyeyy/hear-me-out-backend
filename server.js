const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

// 🔥 SOCKET.IO SETUP
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 🔥 MIDDLEWARE
app.use(cors());
app.use(express.json());

// 🔥 ROUTES
const authRoutes = require('./routes/authRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const moodRoutes = require('./routes/moodRoutes');

// ✅ FIXED ROUTE NAMING (IMPORTANT)
app.use('/api/auth', authRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/appointments', appointmentRoutes); // ✅ plural
app.use('/api/moods', moodRoutes); // ✅ plural

// 🔥 TEST ROUTE
app.get('/', (req, res) => {
  res.json({ message: "API is running" });
});


// ================= SOCKET.IO =================
io.on('connection', (socket) => {
  console.log("🟢 User connected:", socket.id);

  // 🔥 JOIN ROOM
  socket.on('joinRoom', async (roomId) => {
    try {
      socket.join(roomId);
      console.log("📌 Joined room:", roomId);

      // ✅ LOAD OLD MESSAGES
      const messages = await Message.find({ roomId })
        .sort({ createdAt: 1 });

      socket.emit('loadMessages', messages);

    } catch (error) {
      console.log("❌ Load messages error:", error.message);
    }
  });

  // 🔥 SEND MESSAGE
  socket.on('sendMessage', async (data) => {
    try {
      if (!data.roomId || !data.message) {
        return;
      }

      console.log("💬 Message received:", data);

      // ✅ SAVE MESSAGE
      const newMessage = await Message.create({
        roomId: data.roomId,
        senderId: data.senderId || "anonymous",
        message: data.message
      });

      // ✅ EMIT TO ROOM
      io.to(data.roomId).emit('receiveMessage', newMessage);

    } catch (error) {
      console.log("❌ Chat error:", error.message);
    }
  });

  // 🔴 DISCONNECT
  socket.on('disconnect', () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});
// =================================================


// 🔥 START SERVER
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => console.log("❌ MongoDB error:", err.message));