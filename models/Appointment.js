const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  severity:   { type: String, enum: ["LOW", "MEDIUM", "HIGH"] },
  assignedTo: { type: String, default: "Guidance Counselor" },
  status:     { type: String, enum: ["PENDING", "ONGOING", "DONE", "CANCELLED"], default: "PENDING" },
  scheduleDate: { type: Date },
  cancelledAt:  { type: Date, default: null },
}, { timestamps: true });

appointmentSchema.index({ studentId: 1, status: 1 });
appointmentSchema.index({ scheduleDate: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
