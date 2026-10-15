const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Assessment = require("../models/Assessment");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/requireRole");

router.get("/students", authMiddleware, requireRole("counselor"), async (req, res) => {
  try {
    // 1. GET ALL STUDENTS
    const students = await User.find({ role: "student" }, "name email yearLevel createdAt").lean();

    // 2. ATTACH LATEST ASSESSMENT SEVERITY — one aggregation instead of one
    // query per student, so this doesn't get slower as the roster grows.
    const latestAssessments = await Assessment.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$studentId", severity: { $first: "$severity" }, score: { $first: "$score" } } },
    ]);
    const latestBySid = new Map(latestAssessments.map(a => [String(a._id), a]));

    const studentsWithSeverity = students.map(student => {
      const latest = latestBySid.get(String(student._id));
      return {
        _id:       student._id,
        name:      student.name,
        email:     student.email,
        yearLevel: student.yearLevel || null,
        createdAt: student.createdAt,
        severity:  latest ? latest.severity : "LOW",
        score:     latest ? latest.score    : 0,
      };
    });

    // 3. SEND RESPONSE
    res.json({ students: studentsWithSeverity });

  } catch (error) {
    console.log("❌ Fetch students error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;