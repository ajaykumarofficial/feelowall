const mongoose = require('mongoose');

const ChallengeSubmissionSchema = new mongoose.Schema({
  challengeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
  wallpaperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  votes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

ChallengeSubmissionSchema.index({ challengeId: 1, wallpaperId: 1 }, { unique: true });
ChallengeSubmissionSchema.index({ challengeId: 1, votes: -1 });

module.exports = ChallengeSubmissionSchema;
