const Assessment = require('../models/Assessment');
const mongoose = require("mongoose");


// 🧠 CREATE ASSESSMENT
exports.createAssessment = async (req, res) => {
  try {
    const studentId = new mongoose.Types.ObjectId(req.user.id);
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

    if (score <= 5) severity = "LOW";
    else if (score <= 10) severity = "MEDIUM";
    else severity = "HIGH";

    // ✅ SAVE
    const newAssessment = await Assessment.create({
      studentId,
      answers,
      score,
      severity
    });

    res.json({
      success: true,
      message: "Assessment submitted",
      score,
      severity,
      assessment: newAssessment
    });

  } catch (error) {
    res.json({
      success: false,
      message: error.message
    });
  }
};


// 🔍 CHECK IF ASSESSMENT EXISTS (USED IN LOGIN)
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