const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  actorName: { type: String, default: '' },
  text: { type: String, required: true },
  link: { type: String, default: '' },
  // Unread notifications with the same key collapse into one ("Ana and 11 others liked...")
  groupKey: { type: String, default: null },
  count: { type: Number, default: 1 },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

NotificationSchema.index({ userId: 1, read: 1, updatedAt: -1 });
NotificationSchema.index({ userId: 1, groupKey: 1, read: 1 });

module.exports = NotificationSchema;
