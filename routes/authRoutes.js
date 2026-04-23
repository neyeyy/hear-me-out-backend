const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const { register, login, changePassword, forgotPassword, resetPassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.patch('/change-password', authMiddleware, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;