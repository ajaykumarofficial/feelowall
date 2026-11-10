const mongoose = require('mongoose');

const PackSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  creatorName: { type: String, required: true },
  priceCents: { type: Number, required: true, min: 100 },
  currency: { type: String, default: 'usd' },
  coverUrl: { type: String, default: '' },
  wallpapers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper' }],
  // archived: off sale, but existing buyers keep their downloads
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  createdAt: { type: Date, default: Date.now }
});

PackSchema.index({ status: 1, createdAt: -1 });
PackSchema.index({ creatorId: 1 });

module.exports = PackSchema;
