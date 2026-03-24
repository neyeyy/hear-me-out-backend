const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

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

const PORT = process.env.PORT || 5000;

// MongoDB connection + start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.log("MongoDB error:", err));