const express = require('express');
const router = express.Router();

const { 
  createAppointment, 
  getAllAppointments, 
  updateAppointmentStatus,
  getMyAppointment // ✅ ADD
} = require('../controllers/appointmentController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, createAppointment);
router.get('/', authMiddleware, getAllAppointments);

// ✅ NEW ROUTE FOR STUDENT
router.get('/my', authMiddleware, getMyAppointment);

router.patch('/:id', authMiddleware, updateAppointmentStatus);

module.exports = router;