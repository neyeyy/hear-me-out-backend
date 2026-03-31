const express = require('express');
const router = express.Router();

const { createAssessment, checkAssessment } = require('../controllers/assessmentController');
const authMiddleware = require('../middleware/authMiddleware');

// 🧠 CREATE (protected)
router.post('/', authMiddleware, createAssessment);

// 🔍 CHECK (no auth needed for now)
router.get('/check/:studentId', checkAssessment);

module.exports = router;