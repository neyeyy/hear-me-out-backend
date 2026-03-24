const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  answers: [Number],
  score: Number,
  severity: String
}, { timestamps: true });

module.exports = mongoose.model('Assessment', assessmentSchema);