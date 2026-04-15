const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const { register, login, changePassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.patch('/change-password', authMiddleware, changePassword);

module.exports = router;