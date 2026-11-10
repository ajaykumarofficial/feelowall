const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required']
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  bio: {
    type: String,
    default: ''
  },
  tippingLinks: {
    kofi: { type: String, default: '' },
    buyMeACoffee: { type: String, default: '' },
    stripe: { type: String, default: '' }
  },
  oauthProvider: {
    type: String,
    default: null
  },
  // Roles & moderation
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  isVerified: { type: Boolean, default: false },
  badges: [{
    id: String,
    name: String,
    desc: String,
    awardedAt: { type: Date, default: Date.now }
  }],

  // Account recovery. Bumping tokenVersion invalidates every issued login token.
  email: { type: String, trim: true, lowercase: true },
  emailVerified: { type: Boolean, default: false },
  tokenVersion: { type: Number, default: 0 },

  // Two-factor authentication
  twoFactor: {
    enabled: { type: Boolean, default: false },
    secret: { type: String, default: '' },
    recoveryCodes: [String],
    lastUsedStep: { type: Number, default: 0 }
  },

  // Payments
  stripeAccountId: { type: String, default: null },
  stripeChargesEnabled: { type: Boolean, default: false },

  // Preferences
  followedTags: [{ type: String, trim: true, lowercase: true }],
  mutedTags: [{ type: String, trim: true, lowercase: true }],
  mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  showMature: { type: Boolean, default: false },

  oauthId: {
    type: String,
    default: null
  }
});

UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
UserSchema.index(
  { oauthProvider: 1, oauthId: 1 },
  { unique: true, partialFilterExpression: { oauthId: { $type: 'string' } } }
);
UserSchema.index({ following: 1 });
UserSchema.index({ stripeAccountId: 1 });

module.exports = UserSchema;
