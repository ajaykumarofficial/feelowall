const mongoose = require('mongoose');

const SavedSearchSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  search: { type: String, trim: true, default: '' },
  category: { type: String, trim: true, default: '' },
  tag: { type: String, trim: true, default: '' },
  alertsEnabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

SavedSearchSchema.index({ userId: 1, createdAt: -1 });
SavedSearchSchema.index({ alertsEnabled: 1 });

module.exports = SavedSearchSchema;
