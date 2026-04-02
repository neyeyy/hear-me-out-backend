const Assessment = require('../models/Assessment');
const Appointment = require("../models/Appointment");
const User = require("../models/User");


// 🔥 AUTO APPOINTMENT FUNCTION (FIXED)
const createAutoAppointment = async (studentId, severity, source) => {
  try {
    // 🚫 Prevent duplicate active appointments
    const existing = await Appointment.findOne({
      studentId,
      status: { $in: ["PENDING", "ONGOING"] }
    });

    // 🔥 FIX: RETURN existing instead of null
    if (existing) {
      console.log("ℹ️ Active appointment already exists, using existing");
      return existing;
    }

    // 📅 Auto schedule (next day)
    const scheduleDate = new Date();
    scheduleDate.setDate(scheduleDate.getDate() + 1);

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