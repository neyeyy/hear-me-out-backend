const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: String,
  senderId: String,
  message: String,
  seen: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);