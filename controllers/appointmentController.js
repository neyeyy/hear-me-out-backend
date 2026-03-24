const Appointment = require('../models/Appointment');
const Assessment = require('../models/Assessment');

// CREATE APPOINTMENT (AUTO + PRIORITY)
exports.createAppointment = async (req, res) => {
  try {
    const studentId = req.user.id;

    // get latest assessment
    const latestAssessment = await Assessment.findOne({ studentId })
      .sort({ createdAt: -1 });

    if (!latestAssessment) {
      return res.json({
        success: false,
        message: "No assessment found"
      });
    }

    const severity = latestAssessment.severity;

    // AUTO ASSIGNMENT LOGIC
    let assignedTo = "Student Assistant";

    if (severity === "HIGH") {
      assignedTo = "Guidance Counselor";
    } else if (severity === "MEDIUM") {
      assignedTo = "Review Needed";
    }

    // PRIORITY SCHEDULING LOGIC
    const today = new Date();
    let scheduleDate = new Date(today);

    if (severity === "HIGH") {
      scheduleDate.setDate(today.getDate() + 1);
    } else if (severity === "MEDIUM") {
      scheduleDate.setDate(today.getDate() + 3);
    } else {
      scheduleDate.setDate(today.getDate() + 5);
    }

    const appointment = new Appointment({
      studentId,
      severity,
      assignedTo,
      scheduleDate
    });

    await appointment.save();

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


// DASHBOARD (GET ALL APPOINTMENTS WITH PRIORITY SORT)
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


// ✅ UPDATE STATUS (NEW FEATURE)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // validation
    if (!status) {
      return res.json({
        success: false,
        message: "Status is required"
      });
    }

    const allowedStatus = ["PENDING", "COMPLETED"];
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

    if (!appointment) {
      return res.json({
        success: false,
        message: "Appointment not found"
      });
    }

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