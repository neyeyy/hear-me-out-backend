const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Mood = require("../models/Mood");
const Appointment = require("../models/Appointment");
const Assessment = require("../models/Assessment");

// 🔥 GET DASHBOARD DATA
router.get("/dashboard", async (req, res) => {
  try {
    // TOTAL STUDENTS
    const totalStudents = await User.countDocuments({ role: "student" });

    // HIGH RISK (from assessment)
    const highRisk = await Assessment.countDocuments({ severity: "HIGH" });

    // APPOINTMENTS
    const pendingAppointments = await Appointment.countDocuments({ status: "PENDING" });
    const completedAppointments = await Appointment.countDocuments({ status: "COMPLETED" });

    // MOOD COUNTS
    const moods = await Mood.aggregate([
      {
        $group: {
          _id: "$mood",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalStudents,
      highRisk,
      pendingAppointments,
      completedAppointments,
      moods
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;