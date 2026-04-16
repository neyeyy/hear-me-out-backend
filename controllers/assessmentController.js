const Assessment = require('../models/Assessment');
const Appointment = require("../models/Appointment");
const User = require("../models/User");

/* ── Scheduling helpers ──────────────────────────────────────
   Office hours: Mon–Fri, 9:00–11:30 and 13:00–15:30 (30-min slots)
   Lunch break:  12:00–12:59 → no appointments
─────────────────────────────────────────────────────────────── */
const TIME_SLOTS = [
  { h: 9,  m: 0  }, { h: 9,  m: 30 },
  { h: 10, m: 0  }, { h: 10, m: 30 },
  { h: 11, m: 0  }, { h: 11, m: 30 },
  { h: 13, m: 0  }, { h: 13, m: 30 },
  { h: 14, m: 0  }, { h: 14, m: 30 },
  { h: 15, m: 0  }, { h: 15, m: 30 },
];

function skipToWeekday(date) {
  const d = new Date(date);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() + 2);
  if (dow === 0) d.setDate(d.getDate() + 1);
  return d;
}

async function findNextAvailableSlot(daysFromNow) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let candidate = new Date(today.getTime());
  candidate.setDate(today.getDate() + daysFromNow);
  candidate = skipToWeekday(candidate);

  for (let attempt = 0; attempt < 30; attempt++) {
    const dayStart = new Date(candidate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(candidate); dayEnd.setHours(23, 59, 59, 999);

    const existing = await Appointment.find({
      scheduleDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['PENDING', 'ONGOING'] },
    });

    const booked = new Set(
      existing.map(a => {
        const d = new Date(a.scheduleDate);
        return `${d.getHours()}:${d.getMinutes()}`;
      })
    );

    for (const slot of TIME_SLOTS) {
      if (!booked.has(`${slot.h}:${slot.m}`)) {
        const result = new Date(candidate);
        result.setHours(slot.h, slot.m, 0, 0);
        return result;
      }
    }

    candidate.setDate(candidate.getDate() + 1);
    candidate = skipToWeekday(candidate);
  }

  // Fallback
  const fallback = new Date(today);
  fallback.setDate(today.getDate() + daysFromNow);
  const fallbackDay = skipToWeekday(fallback);
  fallbackDay.setHours(9, 0, 0, 0);
  return fallbackDay;
}

// 🔥 AUTO APPOINTMENT FUNCTION
const createAutoAppointment = async (studentId, severity, source) => {
  try {
    // 🚫 Prevent duplicate active appointments
    const existing = await Appointment.findOne({
      studentId,
      status: { $in: ["PENDING", "ONGOING"] }
    });

    if (existing) {
      console.log("ℹ️ Active appointment already exists, using existing");
      return existing;
    }

    // Days out by severity: HIGH=1, MEDIUM=3
    const daysOut = severity === "HIGH" ? 1 : 3;
    const scheduleDate = await findNextAvailableSlot(daysOut);

    const appointment = await Appointment.create({
      studentId,
      severity,
      assignedTo: "Guidance Counselor",
      scheduleDate,
      status: "PENDING",
      source
    });

    console.log("✅ Appointment created:", appointment);

    return appointment;

  } catch (err) {
    console.error("❌ Auto Appointment Error:", err);
    return null;
  }
};


// 🧠 CREATE ASSESSMENT + AUTO APPOINTMENT (FULL FIX)
exports.createAssessment = async (req, res) => {
  try {
    console.log("🔥 createAssessment HIT");

    const studentId = req.user.id;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.json({
        success: false,
        message: "Answers are required"
      });
    }

    // ✅ CALCULATE SCORE
    const score = answers.reduce((sum, val) => sum + Number(val), 0);

    // ✅ DETERMINE SEVERITY
    let severity = "LOW";
    if (score >= 10) severity = "HIGH";
    else if (score >= 5) severity = "MEDIUM";

    // 🔥 CREATE APPOINTMENT FIRST (IMPORTANT FIX)
    let appointment = null;

    if (severity === "HIGH" || severity === "MEDIUM") {
      console.log(`🔥 ${severity} severity detected`);

      appointment = await createAutoAppointment(
        studentId,
        severity,
        "assessment"
      );
    }

    // 🔥 CREATE ASSESSMENT WITH APPOINTMENT LINK
    const newAssessment = await Assessment.create({
      studentId,
      answers,
      score,
      severity,
      appointmentId: appointment ? appointment._id : null
    });

    res.json({
      success: true,
      message: "Assessment submitted",
      score,
      severity,
      assessment: newAssessment,
      appointment // 🔥 ALWAYS returned now (even if existing)
    });

  } catch (error) {
    console.error("❌ ERROR:", error);
    res.json({
      success: false,
      message: error.message
    });
  }
};


// 🔍 CHECK IF ASSESSMENT EXISTS (UNCHANGED)
exports.checkAssessment = async (req, res) => {
  try {
    const { studentId } = req.params;

    const existing = await Assessment.findOne({ studentId });

    res.json({
      success: true,
      hasAssessment: !!existing
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};