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
  }],

  // Publishing & moderation. Records created before this field existed have no status and count as published.
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'published', 'hidden', 'removed', 'pack-only'],
    default: 'published'
  },
  scheduledAt: { type: Date, default: null },
  publishedAt: { type: Date, default: null },
  isMature: { type: Boolean, default: false },

  // Licensing & attribution
  license: {
    type: String,
    enum: ['personal-use', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc0', 'all-rights-reserved'],
    default: 'personal-use'
  },
  sourceUrl: { type: String, trim: true, default: '' },

  // Image metadata, filled in by the background worker
  width: { type: Number, default: null },
  height: { type: Number, default: null },
  aspectRatio: { type: Number, default: null },
  orientation: { type: String, enum: ['landscape', 'portrait', 'square', null], default: null },
  perceptualHash: { type: String, default: null },
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper', default: null },

  // Accessible description (written by the creator or approved from an AI suggestion)
  altText: { type: String, trim: true, maxlength: 500, default: '' },

  // Time-decayed score, recalculated by the scheduler
  trendingScore: { type: Number, default: 0 },

  // Alternate versions of the same artwork
  variants: [{
    label: { type: String, enum: ['desktop', 'mobile', 'tablet', 'ultrawide', 'light', 'dark'], required: true },
    imageUrl: { type: String, required: true },
    filename: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null }
  }]
});

WallpaperSchema.index({ status: 1, uploadedAt: -1 });
WallpaperSchema.index({ status: 1, likesCount: -1, uploadedAt: -1 });
WallpaperSchema.index({ status: 1, viewsCount: -1, uploadedAt: -1 });
WallpaperSchema.index({ status: 1, downloadsCount: -1, uploadedAt: -1 });
WallpaperSchema.index({ status: 1, trendingScore: -1, uploadedAt: -1 });
WallpaperSchema.index({ status: 1, category: 1, uploadedAt: -1 });
WallpaperSchema.index({ status: 1, tags: 1 });
WallpaperSchema.index({ status: 1, width: 1, orientation: 1 });
WallpaperSchema.index({ uploadedById: 1, uploadedAt: -1 });
WallpaperSchema.index({ isFeatured: 1, featuredAt: -1 });
WallpaperSchema.index({ status: 1, scheduledAt: 1 });
WallpaperSchema.index({ perceptualHash: 1 });

module.exports = WallpaperSchema;
