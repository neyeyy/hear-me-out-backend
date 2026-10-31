const mongoose = require('mongoose');

const COUNSELOR_NAMES = ["Ryan Mueden", "Rejoice Pante"];

const appointmentSchema = new mongoose.Schema({
  studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  severity:     { type: String, enum: ["LOW", "MEDIUM", "HIGH"] },
  assignedTo:   { type: String, default: "Guidance Counselor" },
  // The actual named counselor assigned to this appointment. Defaults to a
  // random pick between the two counselors when nothing is passed at
  // creation time, so every appointment always has a concrete name.
  counselorName: {
    type: String,
    enum: COUNSELOR_NAMES,
    default: () => COUNSELOR_NAMES[Math.floor(Math.random() * COUNSELOR_NAMES.length)],
  },
  status:       { type: String, enum: ["PENDING", "ONGOING", "DONE", "CANCELLED", "MISSED"], default: "PENDING" },
  scheduleDate: { type: Date },
  durationMinutes: { type: Number, default: 30 }, // HIGH=60, MEDIUM=45, LOW=30
  cancelledAt:  { type: Date, default: null },
  cancelReason: { type: String, default: null },
  missedAt:     { type: Date, default: null },
  vacancyOfferedAt: { type: Date, default: null },
  // Set once the "your appointment is starting now" grace-period alert has
  // been sent, so the sweep never sends it twice for the same appointment.
  startAlertSentAt: { type: Date, default: null },
  source:       { type: String, default: "assessment" },
}, { timestamps: true });

appointmentSchema.index({ studentId: 1, status: 1 });
appointmentSchema.index({ scheduleDate: 1, status: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);
Appointment.COUNSELOR_NAMES = COUNSELOR_NAMES;
// "Any" (student has no preference) resolves to a random real counselor, so
// the appointment always carries a concrete name.
Appointment.resolveCounselorName = (choice) =>
  COUNSELOR_NAMES.includes(choice) ? choice : COUNSELOR_NAMES[Math.floor(Math.random() * COUNSELOR_NAMES.length)];

module.exports = Appointment;
