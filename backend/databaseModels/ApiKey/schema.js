const mongoose = require('mongoose');

const ApiKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  keyHash: { type: String, required: true, unique: true },
  prefix: { type: String, required: true },
  rateLimitPerMinute: { type: Number, default: 60 },
  lastUsedAt: { type: Date, default: null },
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

ApiKeySchema.index({ userId: 1, revokedAt: 1 });

module.exports = ApiKeySchema;
