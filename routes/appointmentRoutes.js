const express = require('express');
const router = express.Router();

const { 
  createAppointment, 
  getAllAppointments, 
  updateAppointmentStatus 
} = require('../controllers/appointmentController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, createAppointment);
router.get('/', authMiddleware, getAllAppointments);
router.patch('/:id', authMiddleware, updateAppointmentStatus); // ✅ NEW

module.exports = router;