const mongoose = require('mongoose');

const PlaylistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Playlist name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  creator: {
    type: String,
    required: true
  },
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  wallpapers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallpaper'
  }],
  contributors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // The order of `wallpapers` is the display and slideshow order.
  coverWallpaperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper', default: null },
  // Optional time-of-day set: which wallpaper to show in each part of the day.
  timeSlots: {
    dawn: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper', default: null },
    day: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper', default: null },
    dusk: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper', default: null },
    night: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper', default: null }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = PlaylistSchema;
