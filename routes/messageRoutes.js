const express  = require('express');
const router   = express.Router();
const Message  = require('../models/Message');
const User     = require('../models/User');
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

// GET /api/messages/conversations
// For counselor: list all rooms with last message, unread count, and student info
router.get('/conversations', auth, async (req, res) => {
  try {
    const counselorId = String(req.user.id);

    // Get last message per room, sorted by most recent
    const rooms = await Message.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$roomId',
          lastMessage:  { $first: '$message' },
          lastAt:       { $first: '$createdAt' },
          lastSenderId: { $first: '$senderId' },
        },
      },
      { $sort: { lastAt: -1 } },
    ]);

    // Enrich each room with unread count + student info
    const result = await Promise.all(rooms.map(async (room) => {
      const unread = await Message.countDocuments({
        roomId:   room._id,
        senderId: { $ne: counselorId },
        seen:     false,
      });

      const student = await User.findById(room._id, 'name email').lean();

      return {
        roomId:       room._id,
        lastMessage:  room.lastMessage,
        lastAt:       room.lastAt,
        lastSenderId: room.lastSenderId,
        unread,
        studentName:  student?.name  || 'Unknown Student',
        studentEmail: student?.email || '',
      };
    }));

    res.json(result);
  } catch (e) {
    console.error('Conversations error:', e);
    res.json([]);
  }
});

module.exports = router;
