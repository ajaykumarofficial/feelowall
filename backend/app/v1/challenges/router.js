const express = require('express');
const router = express.Router();
const { Challenge, ChallengeSubmission, ChallengeVote, Wallpaper } = require('../../../databaseModels');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');
const { asString } = require('../../../helper/text');
const { isPublic } = require('../../../helper/visibility');
const { finalizeEndedChallenges } = require('../../../helper/publishing');
const { authenticateToken, softAuthenticateToken, requireRole } = require('../../../middleware/auth');

const phaseOf = (challenge, now = new Date()) => {
  if (now < challenge.submissionsStartAt) return 'upcoming';
  if (now < challenge.submissionsEndAt) return 'submissions';
  if (now < challenge.votingEndAt) return 'voting';
  return 'ended';
};

const summary = (challenge) => ({
  id: String(challenge._id),
  title: challenge.title,
  description: challenge.description,
  submissionsStartAt: challenge.submissionsStartAt,
  submissionsEndAt: challenge.submissionsEndAt,
  votingEndAt: challenge.votingEndAt,
  phase: phaseOf(challenge),
  finalized: !!challenge.finalizedAt
});

router.get('/', asyncHandler(async (req, res) => {
  await finalizeEndedChallenges();
  const challenges = await Challenge.find().sort({ submissionsStartAt: -1 }).limit(50).lean();
  res.status(200).json({ challenges: challenges.map(summary) });
}));

router.post('/', authenticateToken, requireRole('admin'), asyncHandler(async (req, res) => {
  const title = asString(req.body.title);
  const start = new Date(req.body.submissionsStartAt);
  const submissionsEnd = new Date(req.body.submissionsEndAt);
  const votingEnd = new Date(req.body.votingEndAt);

  if (!title) throw new HttpError(400, 'Please give the challenge a title.');
  if ([start, submissionsEnd, votingEnd].some((date) => Number.isNaN(date.getTime()))) {
    throw new HttpError(400, 'Please enter valid dates.');
  }
  if (!(start < submissionsEnd && submissionsEnd < votingEnd)) {
    throw new HttpError(400, 'Dates must run in order: submissions open, submissions close, voting ends.');
  }

  const challenge = await Challenge.create({
    title,
    description: asString(req.body.description),
    submissionsStartAt: start,
    submissionsEndAt: submissionsEnd,
    votingEndAt: votingEnd,
    createdBy: req.user.id
  });
  res.status(201).json({ message: 'Challenge created.', challenge: summary(challenge) });
}));

router.get('/:id', softAuthenticateToken, asyncHandler(async (req, res) => {
  await finalizeEndedChallenges();
  const challenge = await Challenge.findById(req.params.id).lean();
  if (!challenge) throw new HttpError(404, 'Challenge not found.');

  const phase = phaseOf(challenge);
  const submissions = await ChallengeSubmission.find({ challengeId: challenge._id })
    .populate('wallpaperId', 'title imageUrl uploadedBy status isMature altText')
    .sort(phase === 'ended' ? { votes: -1, createdAt: 1 } : { createdAt: 1 })
    .lean();

  const myVote = req.user
    ? await ChallengeVote.findOne({ challengeId: challenge._id, userId: req.user.id }).select('submissionId').lean()
    : null;
  const winners = new Set((challenge.winnerIds || []).map(String));

  res.status(200).json({
    challenge: summary(challenge),
    myVoteSubmissionId: myVote ? String(myVote.submissionId) : null,
    submissions: submissions
      .filter((row) => row.wallpaperId && isPublic(row.wallpaperId))
      .map((row) => ({
        id: String(row._id),
        wallpaper: row.wallpaperId,
        isMine: !!req.user && String(row.userId) === req.user.id,
        // Counts stay hidden until voting ends, so early leaders don't sway the vote.
        votes: phase === 'ended' ? row.votes : null,
        isWinner: winners.has(String(row._id))
      }))
  });
}));

router.post('/:id/submit', authenticateToken, asyncHandler(async (req, res) => {
  const challenge = await Challenge.findById(req.params.id).lean();
  if (!challenge) throw new HttpError(404, 'Challenge not found.');
  if (phaseOf(challenge) !== 'submissions') throw new HttpError(400, 'Submissions are not open for this challenge.');

  const wallpaper = await Wallpaper.findById(req.body.wallpaperId).lean();
  if (!wallpaper || String(wallpaper.uploadedById) !== req.user.id) {
    throw new HttpError(403, 'You can only submit your own wallpapers.');
  }
  if (!isPublic(wallpaper)) throw new HttpError(400, 'Publish this wallpaper before submitting it.');

  try {
    const submission = await ChallengeSubmission.create({
      challengeId: challenge._id,
      wallpaperId: wallpaper._id,
      userId: req.user.id
    });
    res.status(201).json({ message: 'Your wallpaper has been entered!', submissionId: String(submission._id) });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(400, 'This wallpaper is already entered.');
    throw err;
  }
}));

router.post('/:id/vote', authenticateToken, asyncHandler(async (req, res) => {
  const challenge = await Challenge.findById(req.params.id).lean();
  if (!challenge) throw new HttpError(404, 'Challenge not found.');
  if (phaseOf(challenge) !== 'voting') throw new HttpError(400, 'Voting is not open for this challenge.');

  const submission = await ChallengeSubmission.findOne({ _id: req.body.submissionId, challengeId: challenge._id });
  if (!submission) throw new HttpError(404, 'Submission not found.');
  if (String(submission.userId) === req.user.id) throw new HttpError(400, 'You can\'t vote for your own wallpaper.');

  try {
    // The unique index on this collection is what guarantees one vote per person.
    await ChallengeVote.create({ challengeId: challenge._id, userId: req.user.id, submissionId: submission._id });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(400, 'You have already voted in this challenge.');
    throw err;
  }
  await ChallengeSubmission.updateOne({ _id: submission._id }, { $inc: { votes: 1 } });
  res.status(200).json({ message: 'Vote counted!', submissionId: String(submission._id) });
}));

module.exports = router;
