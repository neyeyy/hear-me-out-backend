const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  severity: String,
  assignedTo: String, // assistant or counselor
  status: {
    type: String,
    default: "PENDING"
  },
  scheduleDate: Date
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);