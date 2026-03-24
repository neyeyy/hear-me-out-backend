const express = require('express');
const router = express.Router();

const { createMood, getMyMoods } = require('../controllers/moodController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, createMood);
router.get('/', authMiddleware, getMyMoods);

module.exports = router;