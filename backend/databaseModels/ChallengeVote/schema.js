const mongoose = require('mongoose');

const ChallengeVoteSchema = new mongoose.Schema({
  challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChallengeSubmission', required: true },
  createdAt: { type: Date, default: Date.now }
});

// The database enforces one vote per user per challenge.
ChallengeVoteSchema.index({ challengeId: 1, userId: 1 }, { unique: true });

module.exports = ChallengeVoteSchema;
