const Appointment = require('../models/Appointment');
const Assessment = require('../models/Assessment');
const Message = require('../models/Message');

// How long past the scheduled time a PENDING appointment is given before
// it's considered missed (matches the 30-min slot length).
const MISSED_GRACE_MINUTES = 30;

// "Second half of the day" = the PM session start (office hours are
// 9:00–11:30 AM / 1:00–3:30 PM, split by the 12–1 PM lunch break).
const VACANCY_CHECK_HOUR = 13;

/* ── Scheduling helpers ──────────────────────────────────────
   Office hours: Mon–Fri, 9:00–11:30 and 13:00–15:30 (30-min slots)
   Lunch break:  12:00–12:59 → no appointments
─────────────────────────────────────────────────────────────── */
/* Valid 30-min slots: Mon–Fri, 9:00–11:30, then 13:00–15:30 (12:00–12:59 = lunch) */
const TIME_SLOTS = [
  { h: 9,  m: 0  }, { h: 9,  m: 30 },
  { h: 10, m: 0  }, { h: 10, m: 30 },
  { h: 11, m: 0  }, { h: 11, m: 30 },
  // 12:00–12:59 → lunch break, no appointments
  { h: 13, m: 0  }, { h: 13, m: 30 },
  { h: 14, m: 0  }, { h: 14, m: 30 },
  { h: 15, m: 0  }, { h: 15, m: 30 },
];

// Session length by severity — a more severe case gets a longer session.
const DURATION_BY_SEVERITY = { HIGH: 60, MEDIUM: 60, LOW: 30 };
function durationFor(severity) { return DURATION_BY_SEVERITY[severity] || 30; }

// Older appointments (created before session lengths existed) have no
// durationMinutes stored — derive it from their severity instead of
// silently treating them as a 30-min LOW session.
function effectiveDuration(appt) { return appt.durationMinutes || durationFor(appt.severity); }

// Advance Saturday → Monday, Sunday → Monday
function skipToWeekday(date) {
  const d = new Date(date);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() + 2);
  if (dow === 0) d.setDate(d.getDate() + 1);
  return d;
}

// A slot must not run into the 12–1 PM lunch break or past the 4 PM close.
function slotFitsOfficeHours(slot, durationMinutes) {
  const startMin = slot.h * 60 + slot.m;
  const endMin   = startMin + durationMinutes;
  const LUNCH_START = 12 * 60, CLOSE = 16 * 60;
  return startMin < LUNCH_START ? endMin <= LUNCH_START : endMin <= CLOSE;
}

// Does [candidateStart, candidateStart+durationMinutes) overlap any existing
// active appointment that day? Each existing appointment uses its OWN stored
// duration (older records default to 30 min).
async function hasOverlap(candidateStart, durationMinutes, excludeApptId) {
  const dayStart = new Date(candidateStart); dayStart.setHours(0, 0, 0, 0);
  const dayEnd   = new Date(candidateStart); dayEnd.setHours(23, 59, 59, 999);

  const query = {
    scheduleDate: { $gte: dayStart, $lte: dayEnd },
    status: { $in: ['PENDING', 'ONGOING'] },
  };
  if (excludeApptId) query._id = { $ne: excludeApptId };

  const existing = await Appointment.find(query);
  const candidateEnd = new Date(candidateStart.getTime() + durationMinutes * 60000);

  return existing.some(a => {
    const aStart = new Date(a.scheduleDate);
    const aEnd   = new Date(aStart.getTime() + effectiveDuration(a) * 60000);
    return candidateStart < aEnd && aStart < candidateEnd;
  });
}

// Find the first open slot — long enough for durationMinutes, without
// crossing lunch/close — starting daysFromNow weekdays out.
async function findNextAvailableSlot(daysFromNow, durationMinutes = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start candidate on the target day, skipping any weekend
  let candidate = skipToWeekday(new Date(today.getTime()));
  candidate.setDate(today.getDate() + daysFromNow);
  candidate = skipToWeekday(candidate); // re-check after adding days

  for (let attempt = 0; attempt < 30; attempt++) {
    for (const slot of TIME_SLOTS) {
      if (!slotFitsOfficeHours(slot, durationMinutes)) continue;
      const result = new Date(candidate);
      result.setHours(slot.h, slot.m, 0, 0);
      if (!(await hasOverlap(result, durationMinutes))) return result;
    }

    // All slots taken (or too short) on this day — advance to next workday
    candidate.setDate(candidate.getDate() + 1);
    candidate = skipToWeekday(candidate);
  }

  // Fallback: first slot on the target weekday (should almost never reach here)
  const fallback = new Date(today);
  fallback.setDate(today.getDate() + daysFromNow);
  const fallbackDay = skipToWeekday(fallback);
  fallbackDay.setHours(9, 0, 0, 0);
  return fallbackDay;
}

// Find the next open slot LATER TODAY only (no rollover to another day).
// Returns null if today is a weekend, already past office hours, or fully booked.
async function findNextAvailableSlotToday(durationMinutes = 30) {
  const now = new Date();
  if (now.getDay() === 0 || now.getDay() === 6) return null; // weekend

  for (const slot of TIME_SLOTS) {
    if (!slotFitsOfficeHours(slot, durationMinutes)) continue;
    const slotDate = new Date(now);
    slotDate.setHours(slot.h, slot.m, 0, 0);
    if (slotDate <= now) continue; // slot already passed
    if (!(await hasOverlap(slotDate, durationMinutes))) return slotDate;
  }
  return null;
}

// Validate a manually-set schedule date
// Rules: Mon–Fri only, 9:00 AM – 3:59 PM, no 12:xx (lunch), must be :00 or :30,
// and the session (durationMinutes long) must not cross lunch or run past close.
function isValidScheduleSlot(date, durationMinutes = 30) {
  const d   = new Date(date);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;   // weekend

  const h = d.getHours();
  const m = d.getMinutes();

  if (h < 9 || h >= 16)  return false;        // outside 9 AM – 4 PM
  if (h === 12)          return false;         // 12:00–12:59 lunch break
  if (m !== 0 && m !== 30) return false;       // must be on :00 or :30

  return slotFitsOfficeHours({ h, m }, durationMinutes);
}

function formatSlotLabel(h, m) {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// 📅 GET AVAILABLE SLOTS for a given date — powers the student's booking calendar.
// Never reveals who a slot is booked by, only whether it's open.
exports.getAvailableSlots = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.json({ success: false, message: "Date is required" });

    const day = new Date(`${date}T00:00:00`);
    if (isNaN(day.getTime())) return res.json({ success: false, message: "Invalid date" });

    // Session length depends on the student's own latest severity
    const latestAssessment = await Assessment.findOne({ studentId: req.user.id }).sort({ createdAt: -1 });
    const durationMinutes = durationFor(latestAssessment?.severity);

    if (day.getDay() === 0 || day.getDay() === 6) {
      return res.json({
        success: true,
        date,
        durationMinutes,
        slots: TIME_SLOTS.map(sl => ({
          value: `${String(sl.h).padStart(2, "0")}:${String(sl.m).padStart(2, "0")}`,
          label: formatSlotLabel(sl.h, sl.m),
          available: false,
        })),
      });
    }

    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
    const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999);

    const existing = await Appointment.find({
      scheduleDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ["PENDING", "ONGOING"] },
    });

    const now = new Date();
    const slots = TIME_SLOTS.map(sl => {
      const slotDate = new Date(day);
      slotDate.setHours(sl.h, sl.m, 0, 0);
      const slotEnd = new Date(slotDate.getTime() + durationMinutes * 60000);
      const fits = slotFitsOfficeHours(sl, durationMinutes);
      const overlaps = existing.some(a => {
        const aStart = new Date(a.scheduleDate);
        const aEnd   = new Date(aStart.getTime() + effectiveDuration(a) * 60000);
        return slotDate < aEnd && aStart < slotEnd;
      });
      return {
        value: `${String(sl.h).padStart(2, "0")}:${String(sl.m).padStart(2, "0")}`,
        label: formatSlotLabel(sl.h, sl.m),
        available: fits && slotDate > now && !overlaps,
      };
    });

    res.json({ success: true, date, durationMinutes, slots });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};


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

        const scheduleDate = await findNextAvailableSlot(1);

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


// 🚀 CREATE APPOINTMENT — student-picked slot, or auto-scheduled (chat trigger / no date given)
exports.createAppointment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { scheduleDate: requestedDate } = req.body || {};

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

    const durationMinutes = durationFor(severity);
    let scheduleDate;

    if (requestedDate) {
      // Student picked a specific slot from the calendar — validate it's real and still open
      const d = new Date(requestedDate);
      if (isNaN(d.getTime()) || !isValidScheduleSlot(d, durationMinutes)) {
        return res.json({ success: false, message: "That's not a valid appointment slot." });
      }
      if (d <= new Date()) {
        return res.json({ success: false, message: "Please pick a future date and time." });
      }
      if (await hasOverlap(d, durationMinutes)) {
        return res.json({ success: false, message: "Sorry, that slot was just taken. Please pick another." });
      }
      scheduleDate = d;
    } else {
      const daysOut = severity === "HIGH" ? 1 : severity === "MEDIUM" ? 3 : 5;
      scheduleDate = await findNextAvailableSlot(daysOut, durationMinutes);
    }

    const appointment = await Appointment.create({
      studentId,
      severity,
      assignedTo,
      scheduleDate,
      durationMinutes,
      status: "PENDING"
    });

    req.app.get('io')?.emit('appointmentsChanged');

    res.json({
      success: true,
      message: requestedDate ? "Appointment scheduled" : "Appointment auto-scheduled based on priority",
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


// ❌ CANCEL APPOINTMENT (student only, PENDING only)
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;
    const { cancelReason } = req.body || {};

    const appointment = await Appointment.findById(id);
    if (!appointment)
      return res.json({ success: false, message: "Appointment not found" });

    if (String(appointment.studentId) !== String(studentId))
      return res.status(403).json({ success: false, message: "Not authorized" });

    if (appointment.status !== "PENDING")
      return res.json({ success: false, message: "Only pending appointments can be cancelled" });

    appointment.status = "CANCELLED";
    appointment.cancelledAt = new Date();
    appointment.cancelReason = cancelReason || null;
    await appointment.save();

    req.app.get('io')?.emit('appointmentsChanged');

    res.json({ success: true, message: "Appointment cancelled", appointment });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};


// 📜 GET APPOINTMENT HISTORY (all appointments for this student)
exports.getAppointmentHistory = async (req, res) => {
  try {
    const studentId = req.user.id;
    const appointments = await Appointment.find({ studentId }).sort({ createdAt: -1 });
    res.json({ success: true, appointments });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};


// 🔄 UPDATE STATUS + OPTIONAL RESCHEDULE
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, scheduleDate, isUrgent } = req.body || {};

    const existingAppt = await Appointment.findById(id);
    if (!existingAppt) {
      return res.json({ success: false, message: "Appointment not found" });
    }
    const durationMinutes = existingAppt.durationMinutes || durationFor(existingAppt.severity);

    const update = {};

    if (status !== undefined) {
      const allowedStatus = ["PENDING", "ONGOING", "DONE"];
      if (!allowedStatus.includes(status)) {
        return res.json({ success: false, message: "Invalid status" });
      }
      update.status = status;
    }

    if (scheduleDate !== undefined) {
      const d = new Date(scheduleDate);
      if (isNaN(d.getTime())) {
        return res.json({ success: false, message: "Invalid date" });
      }
      if (!isValidScheduleSlot(d, durationMinutes)) {
        return res.json({ success: false, message: `Must be a weekday (Mon–Fri), 9 AM–4 PM, outside the 12–1 PM lunch break, on a 30-minute mark, and fit the student's ${durationMinutes}-minute session without crossing lunch or closing time.` });
      }
      if (await hasOverlap(d, durationMinutes, id)) {
        return res.json({ success: false, message: "That slot overlaps another appointment. Please pick another." });
      }
      update.scheduleDate = d;
    }

    // Urgent flag: bump to earliest available slot (next business day)
    if (isUrgent === true) {
      update.isUrgent = true;
      const urgentSlot = await findNextAvailableSlot(1, durationMinutes);
      update.scheduleDate = urgentSlot;
      update.status = "PENDING";
    } else if (isUrgent === false) {
      update.isUrgent = false;
    }

    if (Object.keys(update).length === 0) {
      return res.json({ success: false, message: "Nothing to update" });
    }

    const appointment = await Appointment.findByIdAndUpdate(id, update, { new: true });
    req.app.get('io')?.emit('appointmentsChanged');
    res.json({ success: true, message: "Appointment updated", appointment });

  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};


// ⏰ SWEEP: expire PENDING appointments whose slot has passed, notify the student
// Runs on an interval from server.js (needs `io` to push the chat message live).
exports.checkMissedAppointments = async (io) => {
  try {
    const cutoff = new Date(Date.now() - MISSED_GRACE_MINUTES * 60 * 1000);

    const overdue = await Appointment.find({
      status: "PENDING",
      scheduleDate: { $lt: cutoff },
    });

    for (const appt of overdue) {
      appt.status = "MISSED";
      appt.missedAt = new Date();
      await appt.save();

      const roomId = String(appt.studentId);
      const notice = await Message.create({
        roomId,
        senderId: "system",
        message: "You missed your schedule, unfortunately. Would you like to reschedule?",
        seen: false,
      });

      if (io) io.to(roomId).emit("receiveMessage", notice);
      console.log(`⏰ Appointment ${appt._id} expired (missed) — notice sent to room ${roomId}`);
    }
    if (overdue.length > 0) io?.emit('appointmentsChanged');
  } catch (error) {
    console.error("❌ checkMissedAppointments error:", error.message);
  }
};


// 📆 SWEEP: if today still has open slots after the PM session starts,
// offer students scheduled for TOMORROW the chance to move to today instead.
// Runs on an interval from server.js (needs `io` to push the chat message live).
exports.checkVacancyOffers = async (io) => {
  try {
    const now = new Date();
    if (now.getDay() === 0 || now.getDay() === 6) return; // weekend, no office hours
    if (now.getHours() < VACANCY_CHECK_HOUR) return;       // wait until the second half of the day

    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow); tomorrowEnd.setHours(23, 59, 59, 999);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

    // Only offer once per appointment per day (skip ones already asked today)
    const candidates = await Appointment.find({
      status: "PENDING",
      scheduleDate: { $gte: tomorrow, $lte: tomorrowEnd },
      $or: [{ vacancyOfferedAt: null }, { vacancyOfferedAt: { $lt: todayStart } }],
    });

    for (const appt of candidates) {
      const duration = appt.durationMinutes || durationFor(appt.severity);
      const vacantSlot = await findNextAvailableSlotToday(duration);
      if (!vacantSlot) continue; // no slot today long enough for this student's session

      appt.vacancyOfferedAt = now;
      await appt.save();

      const roomId = String(appt.studentId);
      const notice = await Message.create({
        roomId,
        senderId: "system",
        message: "Hello, we have a vacant schedule today. Are you willing to move your appointment from tomorrow to today?",
        seen: false,
      });

      if (io) io.to(roomId).emit("receiveMessage", notice);
      console.log(`📆 Vacancy offer sent to room ${roomId} for appointment ${appt._id}`);
    }
  } catch (error) {
    console.error("❌ checkVacancyOffers error:", error.message);
  }
};


// ✅ ACCEPT VACANCY OFFER — student agrees to move their appointment to today
exports.acceptVacancyOffer = async (req, res) => {
  try {
    const studentId = req.user.id;

    const appt = await Appointment.findOne({
      studentId,
      status: { $in: ["PENDING", "ONGOING"] },
    });
    if (!appt) {
      return res.json({ success: false, message: "No active appointment found." });
    }

    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const apptDay = new Date(appt.scheduleDate); apptDay.setHours(0, 0, 0, 0);
    if (apptDay <= today) {
      return res.json({ success: false, message: "Your appointment is already scheduled for today or earlier." });
    }

    const duration = appt.durationMinutes || durationFor(appt.severity);
    const slot = await findNextAvailableSlotToday(duration);
    if (!slot) {
      return res.json({ success: false, message: "Sorry, there are no more open slots today." });
    }

    appt.scheduleDate = slot;
    await appt.save();

    req.app.get('io')?.emit('appointmentsChanged');

    res.json({ success: true, message: "Appointment moved to today.", appointment: appt });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};