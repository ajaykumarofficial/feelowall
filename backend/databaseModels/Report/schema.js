const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  targetType: { type: String, enum: ['wallpaper', 'user', 'comment'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  // null for automated reports (duplicate detection, AI pre-check)
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, enum: ['copyright', 'nsfw', 'spam', 'other', 'duplicate', 'ai-flag'], required: true },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
  resolution: { type: String, default: '' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

ReportSchema.index({ status: 1, createdAt: -1 });
// One open report per person per target; automated reports have a null reporter.
ReportSchema.index(
  { targetType: 1, targetId: 1, reporterId: 1 },
  { unique: true, partialFilterExpression: { reporterId: { $type: 'objectId' }, status: 'open' } }
);

module.exports = ReportSchema;
