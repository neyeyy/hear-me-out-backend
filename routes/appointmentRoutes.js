const express = require('express');
const router = express.Router();

const {
  createAppointment,
  getAllAppointments,
  updateAppointmentStatus,
  getMyAppointment,
  cancelAppointment,
  getAppointmentHistory,
} = require('../controllers/appointmentController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/',               authMiddleware, createAppointment);
router.get('/',                authMiddleware, getAllAppointments);
router.get('/my',              authMiddleware, getMyAppointment);
router.get('/history',         authMiddleware, getAppointmentHistory);
router.patch('/:id',           authMiddleware, updateAppointmentStatus);
router.patch('/:id/cancel',    authMiddleware, cancelAppointment);

module.exports = router;