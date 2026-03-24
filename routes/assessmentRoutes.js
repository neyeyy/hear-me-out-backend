const express = require('express');
const router = express.Router();

const { createAssessment } = require('../controllers/assessmentController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, createAssessment);

module.exports = router;