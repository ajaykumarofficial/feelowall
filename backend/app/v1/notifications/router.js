const express = require('express');
const router = express.Router();
const { Notification } = require('../../../databaseModels');
const { formatNotification } = require('../../../helper/notifications');
const { asyncHandler } = require('../../../helper/asyncHandler');
const { authenticateToken } = require('../../../middleware/auth');

router.use(authenticateToken);

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const [rows, unreadCount] = await Promise.all([
    Notification.find({ userId: req.user.id }).sort({ updatedAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ userId: req.user.id, read: false })
  ]);
  res.status(200).json({ notifications: rows.map(formatNotification), unreadCount });
}));

// Small on purpose: the navbar polls this.
router.get('/unread-count', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const unreadCount = await Notification.countDocuments({ userId: req.user.id, read: false });
  res.status(200).json({ unreadCount });
}));

router.post('/read', asyncHandler(async (req, res) => {
  const filter = { userId: req.user.id, read: false };
  if (Array.isArray(req.body.ids)) filter._id = { $in: req.body.ids.filter((id) => typeof id === 'string') };
  await Notification.updateMany(filter, { $set: { read: true } });
  res.status(200).json({ message: 'Marked as read.' });
}));

module.exports = router;
