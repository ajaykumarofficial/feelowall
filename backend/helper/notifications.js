const { Notification } = require('../databaseModels');
const { reportError } = require('./logger');

/**
 * Create a notification. Unread notifications sharing a groupKey collapse into
 * one with a count. Failures are logged, never thrown: a notification problem
 * must not fail the like, comment, or upload that triggered it.
 */
const notify = async ({ userId, type, actorId = null, actorName = '', text, link = '', groupKey = null }) => {
  try {
    if (!userId) return;
    if (actorId && String(actorId) === String(userId)) return;

    if (groupKey) {
      const updated = await Notification.findOneAndUpdate(
        { userId, groupKey, read: false },
        { $inc: { count: 1 }, $set: { actorName, text, link, updatedAt: new Date() } },
        { new: true }
      );
      if (updated) return;
    }
    await Notification.create({ userId, type, actorName, text, link, groupKey });
  } catch (err) {
    reportError(err, { source: 'notify' });
  }
};

/** "Ana liked...", "Ana and 1 other liked...", "Ana and 11 others liked..." */
const formatNotification = (doc) => {
  const others = (doc.count || 1) - 1;
  const who = doc.actorName
    ? (others > 0 ? `${doc.actorName} and ${others} ${others === 1 ? 'other' : 'others'} ` : `${doc.actorName} `)
    : '';
  return {
    id: String(doc._id),
    type: doc.type,
    message: `${who}${doc.text}`,
    link: doc.link,
    count: doc.count || 1,
    read: doc.read,
    updatedAt: doc.updatedAt
  };
};

module.exports = { notify, formatNotification };
