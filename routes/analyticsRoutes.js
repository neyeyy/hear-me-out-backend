const express  = require("express");
const router   = express.Router();
const Anthropic = require("@anthropic-ai/sdk");

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
      yearLevelBreakdown:  yearLevelRaw,
      severityByYear,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/analytics/ai-recommendation
// Body: { analytics: { ... } }  — pass the dashboard data from the client
router.post("/ai-recommendation", async (req, res) => {
  try {
    const data = req.body.analytics || {};

    const prompt = `You are a school guidance counselor assistant. Analyze the following mental health analytics data from a university student wellness system and provide 3–5 clear, actionable recommendations for the counseling team. Be concise and specific. Use bullet points.

Analytics data:
- Total students: ${data.totalStudents ?? "N/A"}
- High-risk students (latest assessment): ${data.highRisk ?? "N/A"}
- Pending appointments: ${data.pendingAppointments ?? "N/A"}
- Completed appointments: ${data.completedAppointments ?? "N/A"}
- Mood distribution: ${JSON.stringify(data.moods ?? [])}
- Year level breakdown: ${JSON.stringify(data.yearLevelBreakdown ?? [])}
- Severity by year level: ${JSON.stringify(data.severityByYear ?? [])}

Provide recommendations:`;

    const client = new Anthropic();
    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages:   [{ role: "user", content: prompt }],
    });

    const recommendation = message.content[0]?.text || "No recommendation available.";
    res.json({ success: true, recommendation });

  } catch (err) {
    console.error("AI recommendation error:", err.message);
    res.status(500).json({ success: false, message: "AI recommendation failed." });
  }
});

module.exports = router;
