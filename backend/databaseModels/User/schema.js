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
  oauthId: {
    type: String,
    default: null
  }
});

module.exports = UserSchema;
