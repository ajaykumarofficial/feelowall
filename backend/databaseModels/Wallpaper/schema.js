const mongoose = require('mongoose');

const WallpaperSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
  },
  filename: {
    type: String,
    required: [true, 'Filename is required']
  },
  uploadedBy: {
    type: String,
    required: true
  },
  uploadedById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  viewsCount: {
    type: Number,
    default: 0
  },
  downloadsCount: {
    type: Number,
    default: 0
  },
  colors: [{
    hex: String,
    r: Number,
    g: Number,
    b: Number
  }],
  isFeatured: {
    type: Boolean,
    default: false
  },
  featuredAt: {
    type: Date,
    default: null
  },
  isLive: {
    type: Boolean,
    default: false
  },
  videoUrl: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true
  }]
});

module.exports = WallpaperSchema;
