const mongoose = require('mongoose');

const moodSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mood: { type: String, enum: ["HAPPY", "SAD", "STRESSED", "ANXIOUS"], required: true },
  note: { type: String, default: "" },
}, { timestamps: true });

moodSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('Mood', moodSchema);
