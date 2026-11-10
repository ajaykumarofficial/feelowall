const mongoose = require('mongoose');

// Single-use account tokens. Only a hash is stored, so a database leak can't be replayed.
const AuthTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['verify-email', 'reset-password'], required: true },
  tokenHash: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  expiresAt: { type: Date, required: true }
});

AuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = AuthTokenSchema;
