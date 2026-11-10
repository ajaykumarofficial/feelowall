const mongoose = require('mongoose');

const ChallengeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  submissionsStartAt: { type: Date, required: true },
  submissionsEndAt: { type: Date, required: true },
  votingEndAt: { type: Date, required: true },
  winnerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChallengeSubmission' }],
  finalizedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

ChallengeSchema.index({ votingEndAt: 1, finalizedAt: 1 });

module.exports = ChallengeSchema;
