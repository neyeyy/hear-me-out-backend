const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // 🔥 IMPORTANT
  },

  answers: {
    type: [Number],
    required: true // 🔥 ensures assessment is valid
  },

  score: {
    type: Number,
    required: true
  },

  severity: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH"], // 🔥 prevents invalid values
    required: true
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Assessment', assessmentSchema);