const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers:   { type: [Number], required: true },
  score:     { type: Number, required: true },
  severity:  { type: String, enum: ["LOW", "MEDIUM", "HIGH"], required: true },
}, { timestamps: true });

assessmentSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('Assessment', assessmentSchema);
