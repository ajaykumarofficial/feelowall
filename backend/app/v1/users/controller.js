const fs = require('fs');
const path = require('path');
const cloudinary = require('../../../helper/cloudinary');
const { User } = require('../../../databaseModels');

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
    const targetUser = await User.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });
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
    const targetUser = await User.findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } })
      .select('-passwordHash');

    if (!targetUser) {
      return res.status(404).json({ message: 'Creator not found.' });
    }

    // Import other models here to avoid circular imports if any
    const { Wallpaper, Playlist } = require('../../../databaseModels');

    // Find wallpapers uploaded by this user
    const wallpapers = await Wallpaper.find({ uploadedById: targetUser._id }).sort({ uploadedAt: -1 });

    // Find public playlists created by this user
    const playlists = await Playlist.find({ creatorId: targetUser._id, isPublic: true }).sort({ createdAt: -1 });

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
    const achievements = calculateAchievements({ totalViews, totalDownloads, totalLikes }, wallpapers.length, hasGenerative);

    res.status(200).json({
      id: targetUser._id,
      username: targetUser.username,
      avatarUrl: targetUser.avatarUrl || '',
      bio: targetUser.bio || '',
      tippingLinks: targetUser.tippingLinks || { kofi: '', buyMeACoffee: '', stripe: '' },
      createdAt: targetUser.createdAt,
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
    const { DailyAnalytics } = require('../../../databaseModels');

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

module.exports = {
  toggleFollowUser,
  getFollowing,
  updateAvatar,
  updateProfile,
  getCreatorProfile,
  getCreatorAnalytics
};
