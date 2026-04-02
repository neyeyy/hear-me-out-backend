const Assessment = require('../models/Assessment');
const Appointment = require("../models/Appointment");
const User = require("../models/User");


// 🧠 CREATE ASSESSMENT + AUTO APPOINTMENT (FINAL)
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

    // ✅ SAVE ASSESSMENT
    const newAssessment = await Assessment.create({
      studentId,
      answers,
      score,
      severity
    });

    // 🔥 AUTO CREATE APPOINTMENT IF HIGH
    if (severity === "HIGH") {
      console.log("🔥 HIGH severity detected from assessment");

      // ❗ ONLY BLOCK ACTIVE APPOINTMENTS
      const existing = await Appointment.findOne({
        studentId,
        status: { $in: ["PENDING", "ONGOING"] }
      });

      if (!existing) {
        const counselor = await User.findOne({ role: "Guidance Counselor" });

        if (!counselor) {
          console.log("❌ No counselor found");
        } else {
          // 📅 schedule = next day
          const scheduleDate = new Date();
          scheduleDate.setDate(scheduleDate.getDate() + 1);

          const newAppointment = await Appointment.create({
            studentId,
            severity,
            assignedTo: "Guidance Counselor",
            scheduleDate,
            status: "PENDING",
            source: "assessment" // optional but useful
          });

          console.log("✅ Appointment created from assessment:", newAppointment);
        }

      } else {
        console.log("ℹ️ Active appointment already exists, skipping");
      }
    }

    res.json({
      success: true,
      message: "Assessment submitted",
      score,
      severity,
      assessment: newAssessment
    });

  } catch (error) {
    console.error("❌ ERROR:", error);
    res.json({
      success: false,
      message: error.message
    });
  }
};


// 🔍 CHECK IF ASSESSMENT EXISTS
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