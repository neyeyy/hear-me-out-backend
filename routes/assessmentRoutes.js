const express = require('express');
const router = express.Router();

const { createAssessment, checkAssessment } = require('../controllers/assessmentController');
const authMiddleware = require('../middleware/authMiddleware');

// 🧠 CREATE (protected)
router.post('/', authMiddleware, createAssessment);

// 🔍 CHECK (protected)
router.get('/check/:studentId', authMiddleware, checkAssessment);

module.exports = router;