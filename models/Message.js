const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId:   { type: String, required: true },
  senderId: { type: String, required: true },
  message:  { type: String, required: true },
  seen:     { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.index({ roomId: 1, createdAt: 1 });
messageSchema.index({ roomId: 1, senderId: 1, seen: 1 });

module.exports = mongoose.model('Message', messageSchema);
