const express  = require('express');
const router   = express.Router();
const Message  = require('../models/Message');
const auth     = require('../middleware/authMiddleware');

// GET /api/messages/unread/:roomId
// For student: count unseen messages in their room not sent by them (= messages from counselor)
router.get('/unread/:roomId', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      roomId:   String(req.params.roomId),
      senderId: { $ne: String(req.user.id) },
      seen:     false,
    });
    res.json({ count });
  } catch (e) {
    res.json({ count: 0 });
  }
});

// GET /api/messages/unread-rooms
// For counselor: list of rooms (studentIds) that have unseen messages from students
router.get('/unread-rooms', auth, async (req, res) => {
  try {
    const rooms = await Message.aggregate([
      { $match: { senderId: { $ne: String(req.user.id) }, seen: false } },
      { $group: { _id: '$roomId', count: { $sum: 1 } } },
    ]);
    res.json(rooms.map(r => ({ roomId: r._id, count: r.count })));
  } catch (e) {
    res.json([]);
  }
});

module.exports = router;
