const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'counselor'], default: 'student' },
  resetToken:       { type: String, default: null },
  resetTokenExpiry: { type: Date,   default: null },
}, { timestamps: true });

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
