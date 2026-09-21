const mongoose = require('mongoose');

// Clinical severity bands used by the PHQ-9 and GAD-7 instruments themselves
// (distinct from the app's own LOW/MEDIUM/HIGH scheduling risk tier below).
const CLINICAL_SEVERITY_LEVELS = ["minimal", "mild", "moderate", "moderately_severe", "severe"];

const assessmentSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Combined/overall fields — what scheduling, analytics, and the counselor
  // dashboard already read. answers = phq9Answers + gad7Answers; score = phq9Score + gad7Score.
  answers:   { type: [Number], required: true },
  score:     { type: Number, required: true },
  severity:  { type: String, enum: ["LOW", "MEDIUM", "HIGH"], required: true },

  // PHQ-9 (depression) — 9 items, each 0-3, total range 0-27.
  phq9Answers:  { type: [Number], required: true },
  phq9Score:    { type: Number, required: true },
  phq9Severity: { type: String, enum: CLINICAL_SEVERITY_LEVELS, required: true },

  // GAD-7 (anxiety) — 7 items, each 0-3, total range 0-21.
  gad7Answers:  { type: [Number], required: true },
  gad7Score:    { type: Number, required: true },
  gad7Severity: { type: String, enum: CLINICAL_SEVERITY_LEVELS, required: true },
}, { timestamps: true });

assessmentSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('Assessment', assessmentSchema);
