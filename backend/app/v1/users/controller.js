const fs = require('fs');
const path = require('path');
const cloudinary = require('../../../helper/cloudinary');
const {
  User, Wallpaper, Playlist, Comment, Notification, SavedSearch, AuthToken, ApiKey,
  DownloadHistory, Payment, Pack, Report, DailyAnalytics
} = require('../../../databaseModels');
const { comparePassword } = require('../../../helper/bcrypt');
const { exactCI, normalizeTag } = require('../../../helper/text');
const { publicFilter } = require('../../../helper/visibility');
const { notify } = require('../../../helper/notifications');
const { selfView } = require('../../../helper/accountView');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');
const totp = require('../../../helper/totp');

/**
 * Follow or unfollow a user by their username
 */
const toggleFollowUser = async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user.id;

    if (req.user.username.toLowerCase() === username.toLowerCase()) {
      return res.status(400).json({ message: 'You cannot follow yourself.' });
    }

    // Find the target user
    const targetUser = await User.findOne({ username: exactCI(username) });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Find the current user
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: 'Current user session invalid.' });
    }

    // Ensure following array is initialized
    if (!currentUser.following) currentUser.following = [];

    const index = currentUser.following.indexOf(targetUser._id);
    let followed = false;

    if (index > -1) {
      // Already following: unfollow
      currentUser.following.splice(index, 1);
      followed = false;
    } else {
      // Not following: follow
      currentUser.following.push(targetUser._id);
      followed = true;
    }

    await currentUser.save();

    if (followed) {
      await notify({
        userId: targetUser._id,
        type: 'follow',
        actorId: currentUser._id,
        actorName: currentUser.username,
        text: 'started following you',
        link: `/creator/${encodeURIComponent(currentUser.username)}`,
        groupKey: 'follow'
      });
    }

    res.status(200).json({
      message: followed ? `You followed ${targetUser.username}.` : `You unfollowed ${targetUser.username}.`,
      followed,
      followingCount: currentUser.following.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error toggling follow.', error: error.message });
  }
};

/**
 * Get list of users the current user is following
 */
const getFollowing = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const user = await User.findById(currentUserId).populate({
      path: 'following',
      select: 'username createdAt'
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json(user.following || []);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving following list.', error: error.message });
  }
};

/**
 * Update current user's profile avatar
 */
const updateAvatar = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const currentUserId = req.user.id;
    const user = await User.findById(currentUserId);
    if (!user) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(404).json({ message: 'User not found.' });
    }

    let url = '';

    if (cloudinary.isConfigured() && process.env.NODE_ENV !== 'test') {
      try {
        const result = await cloudinary.uploadToCloudinary(file.path);
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        url = result.secure_url;
      } catch (cloudErr) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(500).json({
          message: 'Cloudinary upload failed.',
          error: cloudErr.message
        });
      }
    } else {
      url = `/uploads/${file.filename}`;
    }

    // Clean up old local avatar if it exists
    if (user.avatarUrl && user.avatarUrl.startsWith('/uploads/')) {
      const oldFilename = user.avatarUrl.replace('/uploads/', '');
      const oldPath = path.join(__dirname, '../../../uploads', oldFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (err) {
          console.error('Failed to delete old avatar:', err);
        }
      }
    }

    user.avatarUrl = url;
    await user.save();

    res.status(200).json({
      message: 'Avatar updated successfully.',
      avatarUrl: url
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Server error updating avatar.', error: error.message });
  }
};

/**
 * Update current user's profile bio and tipping links
 */
const updateProfile = async (req, res) => {
  try {
    const { bio, tippingLinks } = req.body;
    const currentUserId = req.user.id;

    const user = await User.findById(currentUserId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (bio !== undefined) user.bio = bio;
    if (tippingLinks !== undefined) {
      user.tippingLinks = {
        kofi: tippingLinks.kofi !== undefined ? tippingLinks.kofi : user.tippingLinks?.kofi || '',
        buyMeACoffee: tippingLinks.buyMeACoffee !== undefined ? tippingLinks.buyMeACoffee : user.tippingLinks?.buyMeACoffee || '',
        stripe: tippingLinks.stripe !== undefined ? tippingLinks.stripe : user.tippingLinks?.stripe || ''
      };
    }

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully.',
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        tippingLinks: user.tippingLinks
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error updating profile.', error: error.message });
  }
};

const calculateAchievements = (stats, wallpapersCount, hasGenerative) => {
  const achievementsList = [
    // Views
    { id: 'rising_star', name: 'Rising Star', desc: 'Accumulate 100+ views.', target: 100, current: stats.totalViews, type: 'views' },
    { id: 'superstar', name: 'Superstar', desc: 'Accumulate 1,000+ views.', target: 1000, current: stats.totalViews, type: 'views' },
    { id: 'legend', name: 'Legend', desc: 'Accumulate 10,000+ views.', target: 10000, current: stats.totalViews, type: 'views' },
    // Downloads
    { id: 'collector_choice', name: 'Collector Choice', desc: 'Accumulate 10+ downloads.', target: 10, current: stats.totalDownloads, type: 'downloads' },
    { id: 'viral_hit', name: 'Viral Hit', desc: 'Accumulate 100+ downloads.', target: 100, current: stats.totalDownloads, type: 'downloads' },
    { id: 'hall_of_fame', name: 'Hall of Fame', desc: 'Accumulate 1,000+ downloads.', target: 1000, current: stats.totalDownloads, type: 'downloads' },
    // Likes
    { id: 'crowd_pleaser', name: 'Crowd Pleaser', desc: 'Accumulate 10+ likes.', target: 10, current: stats.totalLikes, type: 'likes' },
    { id: 'community_idol', name: 'Community Idol', desc: 'Accumulate 50+ likes.', target: 50, current: stats.totalLikes, type: 'likes' },
    { id: 'beloved_creator', name: 'Beloved Creator', desc: 'Accumulate 250+ likes.', target: 250, current: stats.totalLikes, type: 'likes' },
    // Uploads
    { id: 'newbie', name: 'Newbie', desc: 'Upload your first wallpaper.', target: 1, current: wallpapersCount, type: 'uploads' },
    { id: 'pro_contributor', name: 'Pro Contributor', desc: 'Upload 10+ wallpapers.', target: 10, current: wallpapersCount, type: 'uploads' },
    { id: 'master_creator', name: 'Master Creator', desc: 'Upload 50+ wallpapers.', target: 50, current: wallpapersCount, type: 'uploads' },
    // Special
    { id: 'digital_alchemist', name: 'Digital Alchemist', desc: 'Publish a generative shader artwork.', target: 1, current: hasGenerative ? 1 : 0, type: 'special' }
  ];

  return achievementsList.map(ach => ({
    ...ach,
    unlocked: ach.current >= ach.target
  }));
};

/**
 * Get public creator profile details (including wallpapers, public playlists, followers count, and status)
 */
const getCreatorProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user ? req.user.id : null;

    // Find the target user
    const targetUser = await User.findOne({ username: exactCI(username) })
      .select('username avatarUrl bio tippingLinks createdAt status isVerified badges stripeChargesEnabled');

    if (!targetUser || targetUser.status === 'suspended') {
      return res.status(404).json({ message: 'Creator not found.' });
    }

    // Find wallpapers uploaded by this user
    const wallpapers = await Wallpaper.find({ uploadedById: targetUser._id, ...publicFilter() }).sort({ uploadedAt: -1 });

    // Find public playlists created by this user
    const playlists = await Playlist.find({ creatorId: targetUser._id, isPublic: true })
      .sort({ createdAt: -1 })
      .populate({ path: 'coverWallpaperId', select: 'imageUrl status', match: publicFilter() });

    // Calculate stats
    const totalViews = wallpapers.reduce((sum, wp) => sum + (wp.viewsCount || 0), 0);
    const totalDownloads = wallpapers.reduce((sum, wp) => sum + (wp.downloadsCount || 0), 0);
    const totalLikes = wallpapers.reduce((sum, wp) => sum + (wp.likesCount || 0), 0);

    // Count followers
    const followersCount = await User.countDocuments({ following: targetUser._id });

    // Check if the current logged-in user is following the target creator
    let isFollowing = false;
    if (currentUserId) {
      const currentUser = await User.findById(currentUserId);
      if (currentUser && currentUser.following) {
        isFollowing = currentUser.following.includes(targetUser._id);
      }
    }

    const hasGenerative = wallpapers.some(wp => wp.tags && (wp.tags.includes('generative') || wp.tags.includes('shader')));
    const achievements = [
      ...calculateAchievements({ totalViews, totalDownloads, totalLikes }, wallpapers.length, hasGenerative),
      ...(targetUser.badges || []).map((badge) => ({
        id: badge.id,
        name: badge.name,
        desc: badge.desc,
        type: 'special',
        target: 1,
        current: 1,
        unlocked: true
      }))
    ];

    res.status(200).json({
      id: targetUser._id,
      username: targetUser.username,
      avatarUrl: targetUser.avatarUrl || '',
      bio: targetUser.bio || '',
      tippingLinks: targetUser.tippingLinks || { kofi: '', buyMeACoffee: '', stripe: '' },
      createdAt: targetUser.createdAt,
      isVerified: !!targetUser.isVerified,
      acceptsTips: !!targetUser.stripeChargesEnabled,
      wallpapers,
      playlists,
      stats: {
        totalViews,
        totalDownloads,
        totalLikes,
        followersCount
      },
      achievements,
      isFollowing
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving creator profile.', error: error.message });
  }
};

/**
 * Get daily aggregated analytics for a creator's wallpapers over the past N days.
 */
const getCreatorAnalytics = async (req, res) => {
  try {
    const creatorId = req.user.id;
    const days = parseInt(req.query.days) || 7;
    
    const cutoffDate = new Date();
    cutoffDate.setUTCHours(0, 0, 0, 0);
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - days + 1);

    const mongoose = require('mongoose');

    const analyticsData = await DailyAnalytics.aggregate([
      {
        $match: {
          creatorId: new mongoose.Types.ObjectId(creatorId),
          date: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: '$date',
          views: { $sum: '$views' },
          downloads: { $sum: '$downloads' },
          likes: { $sum: '$likes' }
        }
      }
    ]);

    // Create a map of existing data by date string (YYYY-MM-DD)
    const dataMap = {};
    analyticsData.forEach(item => {
      if (item._id) {
        const dateStr = new Date(item._id).toISOString().split('T')[0];
        dataMap[dateStr] = {
          views: item.views || 0,
          downloads: item.downloads || 0,
          likes: item.likes || 0
        };
      }
    });

    // Generate list of all days in the range
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(cutoffDate);
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayData = dataMap[dateStr] || { views: 0, downloads: 0, likes: 0 };
      result.push({
        date: dateStr,
        ...dayData
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving analytics.', error: error.message });
  }
};

// ─── Leaderboards ────────────────────────────────────────────

const LEADERBOARD_PERIODS = { week: 7, month: 30 };

/** Top creators by activity on their wallpapers, weighted the same way as trending. */
const getLeaderboard = asyncHandler(async (req, res) => {
  const period = LEADERBOARD_PERIODS[req.query.period] ? req.query.period : 'week';
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - LEADERBOARD_PERIODS[period] + 1);

  const rows = await DailyAnalytics.aggregate([
    { $match: { date: { $gte: since } } },
    { $group: {
      _id: '$creatorId',
      views: { $sum: '$views' },
      downloads: { $sum: '$downloads' },
      likes: { $sum: '$likes' }
    } },
    { $addFields: { score: { $add: ['$views', { $multiply: ['$downloads', 3] }, { $multiply: ['$likes', 5] }] } } },
    { $match: { score: { $gt: 0 } } },
    { $sort: { score: -1 } },
    { $limit: 100 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: { 'user.status': { $ne: 'suspended' } } },
    { $limit: 50 }
  ]);

  res.status(200).json({
    period,
    creators: rows.map((row, index) => ({
      rank: index + 1,
      username: row.user.username,
      avatarUrl: row.user.avatarUrl || '',
      isVerified: !!row.user.isVerified,
      views: row.views,
      downloads: row.downloads,
      likes: row.likes,
      score: row.score
    }))
  });
});

// ─── Preferences ─────────────────────────────────────────────

const updatePreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (typeof req.body.showMature === 'boolean') user.showMature = req.body.showMature;
  await user.save();
  res.status(200).json({ message: 'Preferences saved.', user: selfView(user) });
});

/** Add or remove a value from one of the user's preference lists. */
const toggleInList = (list, value) => {
  const index = list.findIndex((item) => String(item) === String(value));
  if (index === -1) list.push(value);
  else list.splice(index, 1);
  return index === -1;
};

const toggleTagList = (field, label) => asyncHandler(async (req, res) => {
  const tag = normalizeTag(req.params.tag || '');
  if (!tag) throw new HttpError(400, 'Please choose a tag.');
  const user = await User.findById(req.user.id);
  const active = toggleInList(user[field], tag);
  await user.save();
  res.status(200).json({ message: `${active ? label.on : label.off} #${tag}.`, active, tags: user[field] });
});

const toggleFollowTag = toggleTagList('followedTags', { on: 'Following', off: 'Unfollowed' });
const toggleMuteTag = toggleTagList('mutedTags', { on: 'Muted', off: 'Unmuted' });

const toggleMuteUser = asyncHandler(async (req, res) => {
  const target = await User.findOne({ username: exactCI(req.params.username) }).select('username').lean();
  if (!target) throw new HttpError(404, 'User not found.');
  if (String(target._id) === req.user.id) throw new HttpError(400, 'You can\'t mute yourself.');
  const user = await User.findById(req.user.id);
  const active = toggleInList(user.mutedUsers, target._id);
  await user.save();
  res.status(200).json({ message: `${active ? 'Muted' : 'Unmuted'} ${target.username}.`, active });
});

const getMutedUsers = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).populate('mutedUsers', 'username').lean();
  res.status(200).json({ users: (user.mutedUsers || []).map((muted) => muted.username), tags: user.mutedTags || [] });
});

// ─── Download history ────────────────────────────────────────

const getDownloads = asyncHandler(async (req, res) => {
  const rows = await DownloadHistory.find({ userId: req.user.id })
    .sort({ downloadedAt: -1 })
    .limit(200)
    .populate('wallpaperId', 'title imageUrl uploadedBy status altText')
    .lean();
  res.status(200).json({
    downloads: rows
      .filter((row) => row.wallpaperId && !['removed', 'hidden'].includes(row.wallpaperId.status))
      .map((row) => ({ id: String(row._id), downloadedAt: row.downloadedAt, wallpaper: row.wallpaperId }))
  });
});

const clearDownloads = asyncHandler(async (req, res) => {
  await DownloadHistory.deleteMany({ userId: req.user.id });
  res.status(200).json({ message: 'Download history cleared.' });
});

const removeDownload = asyncHandler(async (req, res) => {
  await DownloadHistory.deleteOne({ _id: req.params.id, userId: req.user.id });
  res.status(200).json({ message: 'Removed from history.' });
});

// ─── Data export & account deletion ──────────────────────────

const exportMyData = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const [user, wallpapers, playlists, comments, liked, downloads, savedSearches, payments, packs] = await Promise.all([
    User.findById(userId).select('-passwordHash -twoFactor -tokenVersion').populate('following', 'username').lean(),
    Wallpaper.find({ uploadedById: userId }).select('-likes').lean(),
    Playlist.find({ creatorId: userId }).lean(),
    Comment.find({ authorId: userId, status: 'visible' }).select('wallpaperId text createdAt').lean(),
    Wallpaper.find({ likes: userId }).select('title').lean(),
    DownloadHistory.find({ userId }).lean(),
    SavedSearch.find({ userId }).lean(),
    Payment.find({ buyerId: userId }).select('-stripeSessionId -stripePaymentIntentId').lean(),
    Pack.find({ creatorId: userId }).lean()
  ]);

  res.setHeader('Content-Disposition', 'attachment; filename="feelowall-data.json"');
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({
    exportedAt: new Date(),
    account: user,
    wallpapers,
    collections: playlists,
    comments,
    likedWallpapers: liked,
    downloadHistory: downloads,
    savedSearches,
    purchases: payments,
    packs
  });
});

/**
 * What deletion does:
 * - Removed: profile, uploads and their files, owned collections, saved searches,
 *   notifications, API keys, download history, and reports the user filed.
 * - Anonymised: comments stay in their threads as "[deleted]".
 * - Kept: payment records, for accounting, with the buyer removed. Packs that have
 *   sold stay available to their buyers, so those wallpapers are kept too.
 */
const deleteMyAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  const { password, confirmUsername, code } = req.body;

  if (user.oauthProvider) {
    if (confirmUsername !== user.username) throw new HttpError(400, 'Type your username to confirm.');
  } else if (typeof password !== 'string' || !await comparePassword(password, user.passwordHash)) {
    throw new HttpError(400, 'Your password is incorrect.');
  }

  if (user.twoFactor?.enabled) {
    const secret = totp.decryptSecret(user.twoFactor.secret);
    const validCode = totp.verifyCode(secret, code, user.twoFactor.lastUsedStep || 0) !== null
      || (user.twoFactor.recoveryCodes || []).includes(totp.hashRecoveryCode(code));
    if (!validCode) throw new HttpError(400, 'Your authentication code is incorrect.');
  }

  if (user.role === 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) {
    throw new HttpError(400, 'Make someone else an admin before deleting the only admin account.');
  }

  const { destroyWallpaper } = require('../wallpapers/controller');
  const userId = user._id;

  // Keep wallpapers that buyers have paid for.
  const packs = await Pack.find({ creatorId: userId });
  const keptWallpapers = new Set();
  for (const pack of packs) {
    const sold = await Payment.exists({ type: 'pack', packId: pack._id, status: 'paid' });
    if (sold) {
      pack.status = 'archived';
      await pack.save();
      pack.wallpapers.forEach((id) => keptWallpapers.add(String(id)));
    } else {
      await Pack.deleteOne({ _id: pack._id });
    }
  }

  const wallpapers = await Wallpaper.find({ uploadedById: userId });
  for (const wallpaper of wallpapers) {
    if (!keptWallpapers.has(String(wallpaper._id))) await destroyWallpaper(wallpaper);
  }

  const removeFromLikes = await Wallpaper.find({ likes: userId }).select('_id').lean();
  await Promise.all(removeFromLikes.map((wallpaper) => Wallpaper.updateOne(
    { _id: wallpaper._id },
    { $pull: { likes: userId }, $inc: { likesCount: -1 } }
  )));

  await Promise.all([
    Comment.updateMany({ authorId: userId }, { $set: { status: 'deleted', text: '[deleted]', authorId: null, authorName: 'deleted' } }),
    Playlist.deleteMany({ creatorId: userId }),
    Playlist.updateMany({ contributors: userId }, { $pull: { contributors: userId } }),
    User.updateMany({ following: userId }, { $pull: { following: userId } }),
    User.updateMany({ mutedUsers: userId }, { $pull: { mutedUsers: userId } }),
    Notification.deleteMany({ userId }),
    SavedSearch.deleteMany({ userId }),
    AuthToken.deleteMany({ userId }),
    ApiKey.deleteMany({ userId }),
    DownloadHistory.deleteMany({ userId }),
    Report.deleteMany({ reporterId: userId }),
    Report.deleteMany({ targetType: 'user', targetId: userId }),
    Payment.updateMany({ buyerId: userId }, { $set: { buyerId: null } })
  ]);
  await User.deleteOne({ _id: userId });

  res.status(200).json({ message: 'Your account has been deleted.' });
});

module.exports = {
  getLeaderboard,
  updatePreferences,
  toggleFollowTag,
  toggleMuteTag,
  toggleMuteUser,
  getMutedUsers,
  getDownloads,
  clearDownloads,
  removeDownload,
  exportMyData,
  deleteMyAccount,
  toggleFollowUser,
  getFollowing,
  updateAvatar,
  updateProfile,
  getCreatorProfile,
  getCreatorAnalytics
};
