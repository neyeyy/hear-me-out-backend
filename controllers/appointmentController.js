const Appointment = require('../models/Appointment');
const Assessment = require('../models/Assessment');


// 🧠 CREATE ASSESSMENT (NOW WITH AUTO APPOINTMENT)
exports.createAssessment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: "Answers are required"
      });
    }

    // ✅ COMPUTE SCORE
    const score = answers.reduce((sum, val) => sum + Number(val), 0);

    // ✅ DETERMINE SEVERITY
    let severity = "LOW";

    if (score >= 10) {
      severity = "HIGH";
    } else if (score >= 5) {
      severity = "MEDIUM";
    }

    // ✅ SAVE ASSESSMENT
    const assessment = await Assessment.create({
      studentId,
      answers,
      score,
      severity
    });

    // 🔥 AUTO CREATE APPOINTMENT IF HIGH
    if (severity === "HIGH") {

      const existing = await Appointment.findOne({
        studentId,
        status: { $in: ["PENDING", "ONGOING"] }
      });

      if (!existing) {

        const scheduleDate = new Date();
        scheduleDate.setDate(scheduleDate.getDate() + 1);

        const appointment = await Appointment.create({
          studentId,
          severity,
          assignedTo: "Guidance Counselor",
          scheduleDate,
          status: "PENDING"
        });

        console.log("✅ Appointment auto-created from assessment:", appointment);

      } else {
        console.log("ℹ️ Existing appointment found, skipping creation");
      }
    }

    res.json({
      success: true,
      message: "Assessment submitted",
      score,
      severity,
      assessment
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 🔍 CHECK IF ASSESSMENT EXISTS
exports.checkAssessment = async (req, res) => {
  try {
    const studentId = req.user.id;

    const existing = await Assessment.findOne({ studentId });

    res.json({
      success: true,
      hasAssessment: !!existing
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 🚀 CREATE APPOINTMENT (USED BY CHAT TRIGGER)
exports.createAppointment = async (req, res) => {
  try {
    const studentId = req.user.id;

    const existing = await Appointment.findOne({
      studentId,
      status: { $in: ["PENDING", "ONGOING"] }
    });

    if (existing) {
      return res.json({
        success: false,
        message: "You already have an active appointment"
      });
    }

    const latestAssessment = await Assessment.findOne({ studentId })
      .sort({ createdAt: -1 });

    if (!latestAssessment) {
      return res.json({
        success: false,
        message: "No assessment found"
      });
    }

    const severity = latestAssessment.severity;

    let assignedTo = "Student Assistant";

    if (severity === "HIGH") {
      assignedTo = "Guidance Counselor";
    } else if (severity === "MEDIUM") {
      assignedTo = "Review Needed";
    }

    const today = new Date();
    let scheduleDate = new Date(today);

    if (severity === "HIGH") {
      scheduleDate.setDate(today.getDate() + 1);
    } else if (severity === "MEDIUM") {
      scheduleDate.setDate(today.getDate() + 3);
    } else {
      scheduleDate.setDate(today.getDate() + 5);
    }

    const appointment = await Appointment.create({
      studentId,
      severity,
      assignedTo,
      scheduleDate,
      status: "PENDING"
    });

    res.json({
      success: true,
      message: "Appointment auto-scheduled based on priority",
      appointment
    });

  } catch (error) {
    res.json({
      success: false,
      message: error.message
    });
  }
};


// 📊 GET ALL APPOINTMENTS
exports.getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('studentId', 'name email');

    const priorityOrder = {
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3
    };

    appointments.sort((a, b) => {
      const severityCompare = priorityOrder[a.severity] - priorityOrder[b.severity];

      if (severityCompare === 0) {
        const dateA = a.scheduleDate ? new Date(a.scheduleDate) : new Date(9999, 0);
        const dateB = b.scheduleDate ? new Date(b.scheduleDate) : new Date(9999, 0);

        return dateA - dateB;
      }

      return severityCompare;
    });

    res.json({
      success: true,
      count: appointments.length,
      appointments
    });

  } catch (error) {
    res.json({
      success: false,
      message: error.message
    });
  }
};


// 🔥 GET MY APPOINTMENT (FIXED)
exports.getMyAppointment = async (req, res) => {
  try {
    const studentId = req.user.id;

    // ✅ GET ACTIVE FIRST
    let appointment = await Appointment.findOne({
      studentId,
      status: { $in: ["PENDING", "ONGOING"] }
    }).sort({ createdAt: -1 });

    // 🔁 FALLBACK TO LATEST
    if (!appointment) {
      appointment = await Appointment.findOne({ studentId })
        .sort({ createdAt: -1 });
    }

    res.json(appointment);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};


// 🔄 UPDATE STATUS (FIXED ENUM)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatus = ["PENDING", "ONGOING", "DONE"];

    if (!allowedStatus.includes(status)) {
      return res.json({
        success: false,
        message: "Invalid status"
      });
    }

    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    res.json({
      success: true,
      message: "Appointment status updated",
      appointment
    });

  } catch (error) {
    res.json({
      success: false,
      message: error.message
    });
  }
};