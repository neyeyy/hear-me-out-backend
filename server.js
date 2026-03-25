const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// 🔥 NEW (for socket.io)
const http = require('http');
const { Server } = require('socket.io');

// 🔥 NEW (Message Model)
const Message = require('./models/Message');

const app = express();

// 🔥 CREATE HTTP SERVER
const server = http.createServer(app);

// 🔥 SOCKET.IO SETUP
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const moodRoutes = require('./routes/moodRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/appointment', appointmentRoutes);
app.use('/api/mood', moodRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: "API is running" });
});

// 🔥 SOCKET LOGIC
io.on('connection', (socket) => {
  console.log("User connected:", socket.id);

  // Join room
  socket.on('joinRoom', async (roomId) => {
  socket.join(roomId);
  console.log("Joined room:", roomId);

  try {
    // 🔥 GET OLD MESSAGES
    const messages = await Message.find({ roomId })
      .sort({ createdAt: 1 }); // oldest first

    // 🔥 SEND TO USER ONLY
    socket.emit('loadMessages', messages);

  } catch (error) {
    console.log("Load messages error:", error.message);
  }
});

  // 🔥 UPDATED: Send + Save message
  socket.on('sendMessage', async (data) => {
    try {
      console.log("Message received:", data);

      // ✅ SAVE TO DATABASE
      const newMessage = new Message({
        roomId: data.roomId,
        senderId: data.senderId || "anonymous",
        message: data.message
      });

      await newMessage.save();

      // ✅ SEND TO ROOM
      io.to(data.roomId).emit('receiveMessage', newMessage);

    } catch (error) {
      console.log("Chat error:", error.message);
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

// MongoDB connection + start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.log("MongoDB error:", err));