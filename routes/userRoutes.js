const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Assessment = require("../models/Assessment");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/students", authMiddleware, async (req, res) => {
  try {
    // 1. GET ALL STUDENTS
    const students = await User.find({ role: "student" });

    // 2. ATTACH LATEST ASSESSMENT SEVERITY
    const studentsWithSeverity = await Promise.all(
      students.map(async (student) => {
        const latestAssessment = await Assessment.findOne({
          studentId: student._id
        }).sort({ createdAt: -1 });

        return {
          _id: student._id,
          name: student.name,
          email: student.email,

          // 🔥 IMPORTANT PART
          severity: latestAssessment
            ? latestAssessment.severity
            : "LOW" // default if no assessment yet
        };
      })
    );

    // 3. SEND RESPONSE
    res.json({ students: studentsWithSeverity });

  } catch (error) {
    console.log("❌ Fetch students error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;