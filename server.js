const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);

// Simple in-memory rate limiter (no extra package needed)
const rateLimitMap = new Map();
function rateLimit(windowMs, max) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) { entry.count = 0; entry.start = now; }
    entry.count++;
    rateLimitMap.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({ success: false, message: "Too many requests. Please wait a moment." });
    }
    next();
  };
}

// SOCKET.IO SETUP
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// 🔥 ROUTES
const authRoutes = require('./routes/authRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const moodRoutes = require('./routes/moodRoutes');
const userRoutes = require('./routes/userRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const messageRoutes = require('./routes/messageRoutes');

// Rate limit: 20 requests per minute on auth endpoints
app.use('/api/auth/login',          rateLimit(60 * 1000, 20));
app.use('/api/auth/register',       rateLimit(60 * 1000, 10));
app.use('/api/auth/forgot-password', rateLimit(60 * 1000, 5));

app.use('/api/auth', authRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/moods', moodRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/messages', messageRoutes);

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
      if (!roomId) return;

      socket.join(String(roomId));

      const messages = await Message.find({ roomId: String(roomId) })
        .sort({ createdAt: 1 });

      socket.emit('loadMessages', messages);

    } catch (error) {
      console.log("❌ Load messages error:", error.message);
    }
  });

  // 🔥 SEND MESSAGE
  socket.on('sendMessage', async (data) => {
    try {
      if (!data.roomId || !data.message || !data.senderId) return;

      const newMessage = await Message.create({
        roomId: String(data.roomId),
        senderId: String(data.senderId),
        message: data.message,
        seen: false
      });

      io.to(String(data.roomId)).emit('receiveMessage', newMessage);

    } catch (error) {
      console.log("❌ Chat error:", error.message);
    }
  });

  // 🔥 MARK AS SEEN (REAL FIX)
  socket.on('markSeen', async ({ roomId, userId }) => {
    try {
      await Message.updateMany(
        {
          roomId: String(roomId),
          senderId: { $ne: String(userId) },
          seen: false
        },
        { seen: true }
      );

      // ✅ SEND UPDATED DATA FROM DB
      const updatedMessages = await Message.find({ roomId: String(roomId) })
        .sort({ createdAt: 1 });

      io.to(String(roomId)).emit('messagesSeen', updatedMessages);

    } catch (error) {
      console.log("❌ Seen error:", error.message);
    }
  });

  // 🔥 TYPING EVENTS
  socket.on("typing", ({ roomId }) => {
    socket.to(String(roomId)).emit("typing");
  });

  socket.on("stopTyping", ({ roomId }) => {
    socket.to(String(roomId)).emit("stopTyping");
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