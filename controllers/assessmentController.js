const Assessment = require('../models/Assessment');

exports.createAssessment = async (req, res) => {
  try {
    // GET USER FROM TOKEN
    const studentId = req.user.id;

    const { answers } = req.body;

    if (!answers) {
      return res.json({
        success: false,
        message: "Answers are required"
      });
    }

    const score = answers.reduce((sum, val) => sum + val, 0);

    let severity = "LOW";

    if (score <= 5) severity = "LOW";
    else if (score <= 10) severity = "MEDIUM";
    else severity = "HIGH";

    const newAssessment = new Assessment({
      studentId,
      answers,
      score,
      severity
    });

    await newAssessment.save();

    res.json({
      success: true,
      score,
      severity
    });

  } catch (error) {
    res.json({
      success: false,
      message: error.message
    });
  }
};