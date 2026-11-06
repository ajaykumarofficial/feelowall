const mongoose = require('mongoose');

const DailyAnalyticsSchema = new mongoose.Schema({
  wallpaperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallpaper',
    required: true
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  downloads: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  }
});

// Compound index to ensure uniqueness per wallpaper per day for upserts
DailyAnalyticsSchema.index({ wallpaperId: 1, date: 1 }, { unique: true });

// Single index to support fast queries by creator
DailyAnalyticsSchema.index({ creatorId: 1, date: 1 });

module.exports = DailyAnalyticsSchema;
