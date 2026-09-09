const express  = require("express");
const router   = express.Router();

const User        = require("../models/User");
const Mood        = require("../models/Mood");
const Appointment = require("../models/Appointment");
const Assessment  = require("../models/Assessment");

// GET /api/analytics/dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const totalStudents        = await User.countDocuments({ role: "student" });
    const highRisk             = await Assessment.countDocuments({ severity: "HIGH" });
    const pendingAppointments  = await Appointment.countDocuments({ status: "PENDING" });
    const completedAppointments= await Appointment.countDocuments({ status: "COMPLETED" });

    const moods = await Mood.aggregate([
      { $group: { _id: "$mood", count: { $sum: 1 } } }
    ]);

    // Year level breakdown
    const yearLevelRaw = await User.aggregate([
      { $match: { role: "student", yearLevel: { $ne: null } } },
      { $group: { _id: "$yearLevel", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // Severity breakdown per year level
    const severityByYear = await Assessment.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$studentId",
          latestSeverity: { $first: "$severity" },
          latestScore:    { $first: "$score" },
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      { $match: { "student.yearLevel": { $ne: null } } },
      {
        $group: {
          _id: { year: "$student.yearLevel", severity: "$latestSeverity" },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      totalStudents,
      highRisk,
      pendingAppointments,
      completedAppointments,
      moods,
      yearLevelBreakdown: yearLevelRaw,
      severityByYear,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
