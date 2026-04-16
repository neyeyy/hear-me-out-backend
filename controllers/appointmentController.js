const Appointment = require('../models/Appointment');
const Assessment = require('../models/Assessment');

/* ── Scheduling helpers ──────────────────────────────────────
   Office hours: Mon–Fri, 9:00–11:30 and 13:00–15:30 (30-min slots)
   Lunch break:  12:00–12:59 → no appointments
─────────────────────────────────────────────────────────────── */
const TIME_SLOTS = [
  { h: 9,  m: 0  }, { h: 9,  m: 30 },
  { h: 10, m: 0  }, { h: 10, m: 30 },
  { h: 11, m: 0  }, { h: 11, m: 30 },
  // 12:00–12:59 = lunch break (skipped)
  { h: 13, m: 0  }, { h: 13, m: 30 },
  { h: 14, m: 0  }, { h: 14, m: 30 },
  { h: 15, m: 0  }, { h: 15, m: 30 },
];

function skipToWeekday(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun, 6=Sat
  if (dow === 6) d.setDate(d.getDate() + 2); // Sat → Mon
  if (dow === 0) d.setDate(d.getDate() + 1); // Sun → Mon
  return d;
}

async function findNextAvailableSlot(daysFromNow) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let candidate = new Date(today);
  candidate.setDate(today.getDate() + daysFromNow);
  candidate = skipToWeekday(candidate);

  for (let attempt = 0; attempt < 21; attempt++) {
    const dayStart = new Date(candidate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(candidate); dayEnd.setHours(23, 59, 59, 999);

    const existing = await Appointment.find({
      scheduleDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['PENDING', 'ONGOING'] },
    });

    const booked = new Set(existing.map(a => {
      const d = new Date(a.scheduleDate);
      return `${d.getHours()}:${d.getMinutes()}`;
    }));

    for (const slot of TIME_SLOTS) {
      if (!booked.has(`${slot.h}:${slot.m}`)) {
        const result = new Date(candidate);
        result.setHours(slot.h, slot.m, 0, 0);
        return result;
      }
    }

    // All slots taken — try next workday
    candidate.setDate(candidate.getDate() + 1);
    candidate = skipToWeekday(candidate);
  }

  // Fallback: use base date at 9 AM
  const fallback = skipToWeekday(new Date(today));
  fallback.setDate(today.getDate() + daysFromNow);
  fallback.setHours(9, 0, 0, 0);
  return fallback;
}

function isValidScheduleSlot(date) {
  const d = new Date(date);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false; // weekend
  const h = d.getHours(); const m = d.getMinutes();
  if (h < 9 || h >= 16) return false;       // outside hours
  if (h === 12) return false;                // lunch break
  // must be on a 30-min mark
  if (m !== 0 && m !== 30) return false;
  return true;
}


// 🧠 CREATE ASSESSMENT (NOW WITH AUTO APPOINTMENT)
exports.createAssessment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Answers are required"
      });
    }

    // ✅ COMPUTE SCORE
    const score = answers.reduce((sum, val) => sum + Number(val), 0);

    // ✅ DETERMINE SEVERITY
    let severity = "LOW";

    if (score >= 10) {
      severity = "HIGH";
    } else if (score >= 5) {
      severity = "MEDIUM";
    }

    // ✅ SAVE ASSESSMENT
    const assessment = await Assessment.create({
      studentId,
      answers,
      score,
      severity
    });

    // 🔥 AUTO CREATE APPOINTMENT IF HIGH
    if (severity === "HIGH") {

      const existing = await Appointment.findOne({
        studentId,
        status: { $in: ["PENDING", "ONGOING"] }
      });

      if (!existing) {

        const scheduleDate = await findNextAvailableSlot(1);

        const appointment = await Appointment.create({
          studentId,
          severity,
          assignedTo: "Guidance Counselor",
          scheduleDate,
          status: "PENDING"
        });

        console.log("✅ Appointment auto-created from assessment:", appointment);

      } else {
        console.log("ℹ️ Existing appointment found, skipping creation");
      }
    }

    res.json({
      success: true,
      message: "Assessment submitted",
      score,
      severity,
      assessment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 🔍 CHECK IF ASSESSMENT EXISTS
exports.checkAssessment = async (req, res) => {
  try {
    const studentId = req.user.id;

    const existing = await Assessment.findOne({ studentId });

    res.json({
      success: true,
      hasAssessment: !!existing
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 🚀 CREATE APPOINTMENT (USED BY CHAT TRIGGER)
exports.createAppointment = async (req, res) => {
  try {
    const studentId = req.user.id;

    const existing = await Appointment.findOne({
      studentId,
      status: { $in: ["PENDING", "ONGOING"] }
    });

    if (existing) {
      return res.json({
        success: false,
        message: "You already have an active appointment"
      });
    }

    const latestAssessment = await Assessment.findOne({ studentId })
      .sort({ createdAt: -1 });

    if (!latestAssessment) {
      return res.json({
        success: false,
        message: "No assessment found"
      });
    }

    const severity = latestAssessment.severity;

    let assignedTo = "Student Assistant";

    if (severity === "HIGH") {
      assignedTo = "Guidance Counselor";
    } else if (severity === "MEDIUM") {
      assignedTo = "Review Needed";
    }

    const daysOut = severity === "HIGH" ? 1 : severity === "MEDIUM" ? 3 : 5;
    const scheduleDate = await findNextAvailableSlot(daysOut);

    const appointment = await Appointment.create({
      studentId,
      severity,
      assignedTo,
      scheduleDate,
      status: "PENDING"
    });

    res.json({
      success: true,
      message: "Appointment auto-scheduled based on priority",
      appointment
    });

  } catch (error) {
    res.json({
      success: false,
      message: error.message
    });
  }
};


// 📊 GET ALL APPOINTMENTS
exports.getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('studentId', 'name email');

    const priorityOrder = {
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3
    };

    appointments.sort((a, b) => {
      const severityCompare = priorityOrder[a.severity] - priorityOrder[b.severity];

      if (severityCompare === 0) {
        const dateA = a.scheduleDate ? new Date(a.scheduleDate) : new Date(9999, 0);
        const dateB = b.scheduleDate ? new Date(b.scheduleDate) : new Date(9999, 0);

        return dateA - dateB;
      }

      return severityCompare;
    });

    res.json({
      success: true,
      count: appointments.length,
      appointments
    });

  } catch (error) {
    res.json({
      success: false,
      message: error.message
    });
  }
};


// 🔥 GET MY APPOINTMENT (FIXED)
exports.getMyAppointment = async (req, res) => {
  try {
    const studentId = req.user.id;

    // ✅ GET ACTIVE FIRST
    let appointment = await Appointment.findOne({
      studentId,
      status: { $in: ["PENDING", "ONGOING"] }
    }).sort({ createdAt: -1 });

    // 🔁 FALLBACK TO LATEST
    if (!appointment) {
      appointment = await Appointment.findOne({ studentId })
        .sort({ createdAt: -1 });
    }

    res.json(appointment);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};


// 🔄 UPDATE STATUS + OPTIONAL RESCHEDULE
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, scheduleDate } = req.body;

    const update = {};

    if (status !== undefined) {
      const allowedStatus = ["PENDING", "ONGOING", "DONE"];
      if (!allowedStatus.includes(status)) {
        return res.json({ success: false, message: "Invalid status" });
      }
      update.status = status;
    }

    if (scheduleDate !== undefined) {
      const d = new Date(scheduleDate);
      if (isNaN(d.getTime())) {
        return res.json({ success: false, message: "Invalid date" });
      }
      if (!isValidScheduleSlot(d)) {
        return res.json({ success: false, message: "Must be a weekday (Mon–Fri), 9 AM–4 PM, outside the 12–1 PM lunch break, on a 30-minute mark." });
      }
      update.scheduleDate = d;
    }

    if (Object.keys(update).length === 0) {
      return res.json({ success: false, message: "Nothing to update" });
    }

    const appointment = await Appointment.findByIdAndUpdate(id, update, { new: true });
    res.json({ success: true, message: "Appointment updated", appointment });

  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};