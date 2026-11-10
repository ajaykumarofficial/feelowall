const mongoose = require('mongoose');

const DownloadHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  wallpaperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper', required: true },
  downloadedAt: { type: Date, default: Date.now }
});

// One row per wallpaper per user; re-downloading moves it to the top of the list.
DownloadHistorySchema.index({ userId: 1, wallpaperId: 1 }, { unique: true });
DownloadHistorySchema.index({ userId: 1, downloadedAt: -1 });

module.exports = DownloadHistorySchema;
