process.env.TZ = 'Asia/Manila'; // Ensure all Date operations use Philippine Standard Time (UTC+8)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const http = require('http');
const { Server } = require('socket.io');

const Message = require('./models/Message');
const { checkMissedAppointments, checkVacancyOffers } = require('./controllers/appointmentController');

const app = express();
const server = http.createServer(app);

// Simple in-memory rate limiter
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
app.set('io', io); // lets route handlers push live updates (req.app.get('io'))

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// ROUTES
const authRoutes        = require('./routes/authRoutes');
const assessmentRoutes  = require('./routes/assessmentRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const moodRoutes        = require('./routes/moodRoutes');
const userRoutes        = require('./routes/userRoutes');
const analyticsRoutes   = require('./routes/analyticsRoutes');
const messageRoutes     = require('./routes/messageRoutes');

// Rate limits
app.use('/api/auth/login',           rateLimit(60 * 1000, 20));
app.use('/api/auth/register',        rateLimit(60 * 1000, 10));
app.use('/api/auth/forgot-password', rateLimit(60 * 1000, 5));

app.use('/api/auth',         authRoutes);
app.use('/api/assessment',   assessmentRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/moods',        moodRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/analytics',    analyticsRoutes);
app.use('/api/messages',     messageRoutes);

// TEST ROUTE
app.get('/', (req, res) => {
  res.json({ message: "API is running" });
});

// SOCKET.IO

// In-memory presence tracking — who's currently connected, and as what role.
// A user can have multiple sockets open (e.g. two tabs/devices), so they only
// go "offline" once their LAST socket disconnects.
const onlineUsers = new Map(); // userId -> { role, sockets: Set<socketId> }
const socketUserMap = new Map(); // socketId -> userId

function broadcastOnlineList() {
  const list = Array.from(onlineUsers.entries()).map(([userId, info]) => ({ userId, role: info.role }));
  io.emit("onlineUsersList", list);
}

// Shared by both an explicit logout and a real disconnect — removes just
// this one socket from presence tracking (a user can have several sockets
// open, so this only clears their entry entirely once the last one is gone).
function removeSocketPresence(socket) {
  const userId = socketUserMap.get(socket.id);
  if (!userId) return;
  socketUserMap.delete(socket.id);
  const info = onlineUsers.get(userId);
  if (info) {
    info.sockets.delete(socket.id);
    if (info.sockets.size === 0) onlineUsers.delete(userId);
  }
  broadcastOnlineList();
}

io.on('connection', (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on('identify', ({ userId, role }) => {
    if (!userId) return;
    socketUserMap.set(socket.id, String(userId));
    const existing = onlineUsers.get(String(userId));
    if (existing) {
      existing.sockets.add(socket.id);
      if (role) existing.role = role;
    } else {
      onlineUsers.set(String(userId), { role, sockets: new Set([socket.id]) });
    }
    broadcastOnlineList();
  });

  // Sent on explicit logout — marks this socket offline right away instead
  // of leaving it (and a stale "online" status) until the socket eventually
  // disconnects, which matters if another account logs in on the same device.
  socket.on('unidentify', () => removeSocketPresence(socket));

  // A screen that just mounted needs the CURRENT list, not just future
  // changes — the broadcast on identify/disconnect only reaches sockets
  // that were already listening at that moment.
  socket.on('getOnlineUsers', () => {
    const list = Array.from(onlineUsers.entries()).map(([userId, info]) => ({ userId, role: info.role }));
    socket.emit('onlineUsersList', list);
  });

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

  socket.on('sendMessage', async (data) => {
    try {
      if (!data.roomId || !data.message || !data.senderId) return;
      const newMessage = await Message.create({
        roomId:   String(data.roomId),
        senderId: String(data.senderId),
        message:  data.message,
        seen:     false
      });
      io.to(String(data.roomId)).emit('receiveMessage', newMessage);
      // Room-scoped emit above only reaches sockets that already joined that
      // room (i.e. someone with that chat open) — this global ping lets any
      // connected dashboard refresh its conversation list immediately too.
      io.emit('newMessageAlert', { roomId: String(data.roomId), senderId: String(data.senderId) });
    } catch (error) {
      console.log("❌ Chat error:", error.message);
    }
  });

  socket.on('markSeen', async ({ roomId, userId }) => {
    try {
      await Message.updateMany(
        {
          roomId:   String(roomId),
          senderId: { $ne: String(userId) },
          seen:     false
        },
        { seen: true }
      );
      const updatedMessages = await Message.find({ roomId: String(roomId) })
        .sort({ createdAt: 1 });
      io.to(String(roomId)).emit('messagesSeen', updatedMessages);
    } catch (error) {
      console.log("❌ Seen error:", error.message);
    }
  });

  socket.on("typing", ({ roomId }) => {
    socket.to(String(roomId)).emit("typing");
  });

  socket.on("stopTyping", ({ roomId }) => {
    socket.to(String(roomId)).emit("stopTyping");
  });

  socket.on('disconnect', () => {
    console.log("🔴 User disconnected:", socket.id);
    removeSocketPresence(socket);
  });
});

// Expire missed appointments + notify students on a recurring sweep
setInterval(() => checkMissedAppointments(io), 5 * 60 * 1000);
checkMissedAppointments(io);

// Offer today's open slots to tomorrow's students once the PM session starts
setInterval(() => checkVacancyOffers(io), 30 * 60 * 1000);
checkVacancyOffers(io);

// START SERVER
const PORT      = process.env.PORT      || 5000;
const MONGO_URI = process.env.MONGO_URI;

console.log("🔍 MONGO_URI:", MONGO_URI ? "Found ✅" : "NOT FOUND ❌");
console.log("🔍 PORT:", PORT);

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => console.log("❌ MongoDB error:", err.message));