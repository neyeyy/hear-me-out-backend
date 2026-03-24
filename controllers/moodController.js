const Mood = require('../models/Mood');
const Appointment = require('../models/Appointment');
const Assessment = require('../models/Assessment');

// CREATE MOOD ENTRY + ALERT SYSTEM
exports.createMood = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { mood, note } = req.body;

    if (!mood) {
      return res.json({
        success: false,
        message: "Mood is required"
      });
    }

    // ✅ SAVE MOOD
    const newMood = new Mood({
      studentId,
      mood,
      note
    });

    await newMood.save();

    // 🔥 GET LAST 3 MOODS
    const recentMoods = await Mood.find({ studentId })
      .sort({ createdAt: -1 })
      .limit(3);

    const negativeMoods = ["SAD", "STRESSED", "ANXIOUS"];

    const allNegative =
      recentMoods.length === 3 &&
      recentMoods.every(m => negativeMoods.includes(m.mood));

    let alertTriggered = false;

    // 🚨 TRIGGER ALERT
    if (allNegative) {

      // get latest assessment (optional but better)
      const latestAssessment = await Assessment.findOne({ studentId })
        .sort({ createdAt: -1 });

      let severity = "MEDIUM";

      if (latestAssessment) {
        severity = latestAssessment.severity;
      }

      // assignment logic
      let assignedTo = "Student Assistant";

      if (severity === "HIGH") {
        assignedTo = "Guidance Counselor";
      } else if (severity === "MEDIUM") {
        assignedTo = "Review Needed";
      }

      // scheduling logic
      const today = new Date();
      let scheduleDate = new Date(today);

      if (severity === "HIGH") {
        scheduleDate.setDate(today.getDate() + 1);
      } else if (severity === "MEDIUM") {
        scheduleDate.setDate(today.getDate() + 3);
      } else {
        scheduleDate.setDate(today.getDate() + 5);
      }

      await Appointment.create({
        studentId,
        severity,
        assignedTo,
        scheduleDate
      });

      alertTriggered = true;
    }

    res.json({
      success: true,
      message: alertTriggered
        ? "Mood recorded ⚠️ Alert triggered (appointment created)"
        : "Mood recorded",
      alertTriggered,
      mood: newMood
    });

  } catch (error) {
    res.json({
      success: false,
      message: error.message
    });
  }
};


// GET ALL MOODS (FOR DASHBOARD)
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
    res.json({
      success: false,
      message: error.message
    });
  }
};