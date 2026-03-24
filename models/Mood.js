const mongoose = require('mongoose');

const moodSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  mood: {
    type: String,
    enum: ["HAPPY", "SAD", "STRESSED", "ANXIOUS"],
    required: true
  },
  note: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Mood', moodSchema);