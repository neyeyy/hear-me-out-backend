const Mood = require('../models/Mood');
const Appointment = require('../models/Appointment');
const Assessment = require('../models/Assessment');

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

      if (severity === "HIGH") {
        assignedTo = "Guidance Counselor";
      } else if (severity === "MEDIUM") {
        assignedTo = "Review Needed";
      }

      // 📅 Schedule date
      const today = new Date();
      let scheduleDate = new Date(today);

      if (severity === "HIGH") {
        scheduleDate.setDate(today.getDate() + 1);
      } else if (severity === "MEDIUM") {
        scheduleDate.setDate(today.getDate() + 3);
      } else {
        scheduleDate.setDate(today.getDate() + 5);
      }

      // 🗓️ Create appointment
      await Appointment.create({
        studentId,
        severity,
        assignedTo,
        scheduleDate,
        status: "PENDING" // 🔥 IMPORTANT
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