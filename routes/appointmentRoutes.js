const express = require('express');
const router = express.Router();

const {
  createAppointment,
  getAllAppointments,
  updateAppointmentStatus,
  getMyAppointment,
  cancelAppointment,
  getAppointmentHistory,
  acceptVacancyOffer,
  getAvailableSlots,
} = require('../controllers/appointmentController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/',               authMiddleware, createAppointment);
router.post('/accept-vacancy', authMiddleware, acceptVacancyOffer);
router.get('/',                authMiddleware, getAllAppointments);
router.get('/my',              authMiddleware, getMyAppointment);
router.get('/history',         authMiddleware, getAppointmentHistory);
router.get('/available-slots', authMiddleware, getAvailableSlots);
router.patch('/:id',           authMiddleware, updateAppointmentStatus);
router.patch('/:id/cancel',    authMiddleware, cancelAppointment);

module.exports = router;