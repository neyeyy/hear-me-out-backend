const express  = require('express');
const router   = express.Router();
const Message  = require('../models/Message');
const User     = require('../models/User');
const auth     = require('../middleware/authMiddleware');
const requireRole = require('../middleware/requireRole');

// GET /api/messages/unread/:roomId
// For student: count unseen messages in their room not sent by them (= messages from counselor)
router.get('/unread/:roomId', auth, async (req, res) => {
  try {
    // A student may only check their own room (= their own user id); a
    // counselor can check any room.
    if (req.user.role !== 'counselor' && String(req.params.roomId) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
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
router.get('/unread-rooms', auth, requireRole('counselor'), async (req, res) => {
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
router.get('/conversations', auth, requireRole('counselor'), async (req, res) => {
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

    // Enrich with unread count + student info in bulk — a per-room query
    // loop here would be 2N+1 queries as conversations grow.
    const unreadByRoom = await Message.aggregate([
      { $match: { senderId: { $ne: counselorId }, seen: false } },
      { $group: { _id: '$roomId', count: { $sum: 1 } } },
    ]);
    const unreadMap = new Map(unreadByRoom.map(r => [String(r._id), r.count]));

    const students = await User.find({ _id: { $in: rooms.map(r => r._id) } }, 'name email').lean();
    const studentMap = new Map(students.map(s => [String(s._id), s]));

    const result = rooms.map(room => {
      const student = studentMap.get(String(room._id));
      return {
        roomId:       room._id,
        lastMessage:  room.lastMessage,
        lastAt:       room.lastAt,
        lastSenderId: room.lastSenderId,
        unread:       unreadMap.get(String(room._id)) || 0,
        studentName:  student?.name  || 'Unknown Student',
        studentEmail: student?.email || '',
      };
    });

    res.json(result);
  } catch (e) {
    console.error('Conversations error:', e);
    res.json([]);
  }
});

module.exports = router;
