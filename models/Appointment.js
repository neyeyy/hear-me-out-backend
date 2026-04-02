const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  severity: {
    type: String,
    enum: ["LOW", "MEDIUM", "HIGH"]
  },

  // ✅ FIXED: use STRING (matches your working chat system)
  assignedTo: {
    type: String,
    default: "Guidance Counselor"
  },

  status: {
    type: String,
    enum: ["PENDING", "ONGOING", "DONE"],
    default: "PENDING"
  },

  scheduleDate: {
    type: Date
  }

}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);