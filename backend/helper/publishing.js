const { User, SavedSearch, Wallpaper, Challenge, ChallengeSubmission } = require('../databaseModels');
const { notify } = require('./notifications');
const { reportError } = require('./logger');
const { containsCI } = require('./text');

const MAX_FOLLOWER_ALERTS = 5000;
const MAX_SEARCH_ALERTS = 5000;

const matchesSavedSearch = (saved, wallpaper) => {
  if (saved.category && saved.category.toLowerCase() !== String(wallpaper.category).toLowerCase()) return false;
  const tags = (wallpaper.tags || []).map((tag) => String(tag).toLowerCase());
  if (saved.tag && !tags.includes(saved.tag.toLowerCase())) return false;
  if (saved.search) {
    const pattern = containsCI(saved.search);
    const haystack = [wallpaper.title, wallpaper.category, wallpaper.uploadedBy, wallpaper.altText, ...tags];
    if (!haystack.some((value) => pattern.test(String(value || '')))) return false;
  }
  return !!(saved.search || saved.category || saved.tag);
};

/** Tell followers and saved-search owners about a newly public wallpaper. */
const onWallpaperPublished = async (wallpaper) => {
  try {
    const link = `/wallpaper/${wallpaper._id}`;
    const followers = await User.find({ following: wallpaper.uploadedById }).select('_id').limit(MAX_FOLLOWER_ALERTS).lean();
    await Promise.all(followers.map((follower) => notify({
      userId: follower._id,
      type: 'upload',
      actorId: wallpaper.uploadedById,
      actorName: wallpaper.uploadedBy,
      text: `posted "${wallpaper.title}"`,
      link,
      groupKey: `upload:${wallpaper.uploadedById}`
    })));

    const searches = await SavedSearch.find({ alertsEnabled: true }).limit(MAX_SEARCH_ALERTS).lean();
    const alerted = new Set();
    for (const saved of searches) {
      const owner = String(saved.userId);
      if (owner === String(wallpaper.uploadedById) || alerted.has(owner) || !matchesSavedSearch(saved, wallpaper)) continue;
      alerted.add(owner);
      await notify({
        userId: saved.userId,
        type: 'saved-search',
        text: `New match for your saved search "${saved.name}": ${wallpaper.title}`,
        link,
        groupKey: `saved-search:${saved._id}`
      });
    }
  } catch (err) {
    reportError(err, { source: 'onWallpaperPublished' });
  }
};

/** Publish every scheduled wallpaper whose time has come. The atomic update means it only fires once. */
const publishDueWallpapers = async (now = new Date()) => {
  let published = 0;
  for (;;) {
    const wallpaper = await Wallpaper.findOneAndUpdate(
      { status: 'scheduled', scheduledAt: { $lte: now } },
      { $set: { status: 'published', publishedAt: now, uploadedAt: now } },
      { new: true }
    );
    if (!wallpaper) return published;
    published += 1;
    await onWallpaperPublished(wallpaper);
  }
};

/** Pick winners (including ties) for challenges whose voting has ended, award badges, and notify them. */
const finalizeEndedChallenges = async (now = new Date()) => {
  let finalized = 0;
  for (;;) {
    const challenge = await Challenge.findOneAndUpdate(
      { votingEndAt: { $lte: now }, finalizedAt: null },
      { $set: { finalizedAt: now } },
      { new: true }
    );
    if (!challenge) return finalized;
    finalized += 1;

    const top = await ChallengeSubmission.findOne({ challengeId: challenge._id }).sort({ votes: -1 }).lean();
    if (!top || top.votes <= 0) continue;

    const winners = await ChallengeSubmission.find({ challengeId: challenge._id, votes: top.votes }).lean();
    challenge.winnerIds = winners.map((winner) => winner._id);
    await challenge.save();

    const badge = {
      id: `challenge-${challenge._id}`,
      name: 'Challenge Winner',
      desc: `Won the "${challenge.title}" community challenge.`
    };
    for (const winner of winners) {
      await User.updateOne(
        { _id: winner.userId, 'badges.id': { $ne: badge.id } },
        { $push: { badges: badge } }
      );
      await notify({
        userId: winner.userId,
        type: 'challenge-win',
        text: `You won the "${challenge.title}" challenge!`,
        link: `/challenges/${challenge._id}`
      });
    }
  }
};

module.exports = { onWallpaperPublished, publishDueWallpapers, finalizeEndedChallenges, matchesSavedSearch };
