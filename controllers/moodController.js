const Mood = require('../models/Mood');
const Appointment = require('../models/Appointment');
const Assessment = require('../models/Assessment');

/* ── Scheduling helpers (Mon–Fri, 9–11:30 and 13–15:30, no lunch) ── */
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

  const fallback = new Date(today);
  fallback.setDate(today.getDate() + daysFromNow);
  const fallbackDay = skipToWeekday(fallback);
  fallbackDay.setHours(9, 0, 0, 0);
  return fallbackDay;
}

// 🔥 MOTIVATION FUNCTION
const getMotivation = (mood) => {
  const quotes = {
    STRESSED: "Take a deep breath. You're doing your best.",
    SAD: "This feeling is temporary. You are stronger than you think.",
    HAPPY: "Keep shining! You're doing great.",
    ANXIOUS: "One step at a time. You’ve got this.",
    ANGRY: "Pause. Breathe. Respond calmly."
  };

  return quotes[mood] || "Stay positive and take care of yourself.";
};

// 🚀 CREATE MOOD + SMART ALERT SYSTEM
exports.createMood = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { mood, note } = req.body;

    // ❗ Validation
    if (!mood) {
      return res.status(400).json({
        success: false,
        message: "Mood is required"
      });
    }

    // ✅ 1. SAVE MOOD
    const newMood = new Mood({
      studentId,
      mood,
      note
    });

    await newMood.save();

    // 🔥 2. GET LAST 3 MOODS
    const recentMoods = await Mood.find({ studentId })
      .sort({ createdAt: -1 })
      .limit(3);

    const negativeMoods = ["SAD", "STRESSED", "ANXIOUS"];

    const allNegative =
      recentMoods.length === 3 &&
      recentMoods.every(m => negativeMoods.includes(m.mood));

    let alertTriggered = false;

    // 🚨 3. CHECK EXISTING ACTIVE APPOINTMENT
    const existingAppointment = await Appointment.findOne({
      studentId,
      status: { $in: ["PENDING", "ONGOING"] }
    });

    // 🚨 4. TRIGGER ALERT (ONLY IF NO ACTIVE APPOINTMENT)
    if (allNegative && !existingAppointment) {

      // 🔍 Get latest assessment
      const latestAssessment = await Assessment.findOne({ studentId })
        .sort({ createdAt: -1 });

      let severity = "MEDIUM";

      if (latestAssessment) {
        severity = latestAssessment.severity;
      }

      // 👤 Assign role
      let assignedTo = "Student Assistant";
      if (severity === "HIGH") assignedTo = "Guidance Counselor";
      else if (severity === "MEDIUM") assignedTo = "Review Needed";

      // 📅 Schedule date — proper Mon–Fri slot
      const daysOut = severity === "HIGH" ? 1 : severity === "MEDIUM" ? 3 : 5;
      const scheduleDate = await findNextAvailableSlot(daysOut);

      // 🗓️ Create appointment
      await Appointment.create({
        studentId,
        severity,
        assignedTo,
        scheduleDate,
        status: "PENDING"
      });

      alertTriggered = true;
    }

    // ✅ 5. FINAL RESPONSE
    res.json({
      success: true,
      message: alertTriggered
        ? "Mood recorded ⚠️ Alert triggered (appointment created)"
        : "Mood recorded",
      alertTriggered,
      mood: newMood,
      motivation: getMotivation(mood)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// 📊 GET ALL MOODS (FOR CALENDAR)
exports.getMyMoods = async (req, res) => {
  try {
    const studentId = req.user.id;

    const moods = await Mood.find({ studentId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: moods.length,
      moods
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};