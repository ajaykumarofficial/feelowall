const { Wallpaper } = require('../../../databaseModels');
const cloudinary = require('../../../helper/cloudinary');
const { trackHit } = require('../../../helper/analytics');

/**
 * Get all wallpapers (with category, search, sort & pagination)
 */
const hexToRgb = (hex) => {
  if (!hex) return null;
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

/**
 * Get all wallpapers (with category, search, sort & pagination)
 */
const getWallpapers = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=600');
    const { category, search, sortBy, page, limit, color, colorThreshold } = req.query;
    const query = {};

    // Sanitize query inputs to prevent NoSQL injection
    const categoryString = typeof category === 'string' ? category.replace(/\$[a-zA-Z]+/g, '') : '';
    const searchString = typeof search === 'string' ? search.replace(/\$[a-zA-Z]+/g, '') : '';

    if (categoryString && categoryString !== 'All') {
      query.category = { $regex: new RegExp('^' + categoryString + '$', 'i') };
    }

    if (searchString) {
      const searchQuery = { $regex: new RegExp(searchString, 'i') };
      query.$or = [
        { title: searchQuery },
        { category: searchQuery },
        { uploadedBy: searchQuery },
        { tags: searchQuery }
      ];
    }

    if (color) {
      const rgb = hexToRgb(color);
      if (rgb) {
        const threshold = parseInt(colorThreshold) || 45;
        query.colors = {
          $elemMatch: {
            r: { $gte: rgb.r - threshold, $lte: rgb.r + threshold },
            g: { $gte: rgb.g - threshold, $lte: rgb.g + threshold },
            b: { $gte: rgb.b - threshold, $lte: rgb.b + threshold }
          }
        };
      }
    }

    // Sort option
    let sortOption = { uploadedAt: -1 };
    if (sortBy === 'likes') {
      sortOption = { likesCount: -1, uploadedAt: -1 };
    } else if (sortBy === 'downloads') {
      sortOption = { downloadsCount: -1, uploadedAt: -1 };
    } else if (sortBy === 'views') {
      sortOption = { viewsCount: -1, uploadedAt: -1 };
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 0; // 0 = no limit (backward-compatible)

    let wallpapersQuery = Wallpaper.find(query).sort(sortOption);

    if (limitNum > 0) {
      const skip = (pageNum - 1) * limitNum;
      wallpapersQuery = wallpapersQuery.skip(skip).limit(limitNum);
    }

    const [wallpapers, total] = await Promise.all([
      wallpapersQuery.lean(),
      Wallpaper.countDocuments(query)
    ]);

    const hasMore = limitNum > 0
      ? pageNum * limitNum < total
      : false;

    res.status(200).json({ wallpapers, hasMore, total, page: pageNum });
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving wallpapers.', error: error.message });
  }
};

/**
 * Handle custom wallpaper uploads
 */
const uploadWallpaper = async (req, res) => {
  try {
    const { title, category, imageUrl, filename, colors, isLive, videoUrl, tags } = req.body;

    let parsedTags = [];
    if (Array.isArray(tags)) {
      parsedTags = tags.map(t => typeof t === 'string' ? t.trim() : '').filter(Boolean);
    } else if (typeof tags === 'string') {
      parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    const newWallpaper = new Wallpaper({
      title,
      category,
      imageUrl,
      filename,
      colors: colors || [],
      isLive: !!isLive,
      videoUrl: videoUrl || '',
      tags: parsedTags,
      uploadedBy: req.user.username,
      uploadedById: req.user.id
    });
    await newWallpaper.save();

    // Trigger background image optimization, WebP conversion, and color extraction
    const { enqueueImageProcess } = require('../../../helper/queue');
    const path = require('path');

    const isCloudinary = imageUrl.startsWith('http') || imageUrl.includes('res.cloudinary.com');
    const localFilePath = isCloudinary ? '' : path.join(__dirname, '../../../uploads', filename);

    enqueueImageProcess({
      wpId: newWallpaper._id,
      filePath: localFilePath,
      imageUrl,
      isCloudinary,
      originalFilename: filename
    }).catch(err => console.error('Background processing enqueuing failed:', err));

    res.status(201).json({
      message: 'Wallpaper uploaded successfully. Processing optimization in background.',
      wallpaper: newWallpaper
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during upload.', error: error.message });
  }
};

/**
 * Update custom wallpaper details
 */
const updateWallpaper = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, tags } = req.body;

    const wp = await Wallpaper.findById(id);
    if (!wp) {
      return res.status(404).json({ message: 'Wallpaper not found.' });
    }

    // Check ownership
    if (wp.uploadedById.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to update this wallpaper.' });
    }

    wp.title = title;
    wp.category = category;
    if (tags !== undefined) {
      let parsedTags = [];
      if (Array.isArray(tags)) {
        parsedTags = tags.map(t => typeof t === 'string' ? t.trim() : '').filter(Boolean);
      } else if (typeof tags === 'string') {
        parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
      }
      wp.tags = parsedTags;
    }
    await wp.save();

    res.status(200).json({
      message: 'Wallpaper updated successfully.',
      wallpaper: wp
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during update.', error: error.message });
  }
};

/**
 * Delete custom wallpaper and physical file
 */
const deleteWallpaper = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  try {
    const { id } = req.params;

    const wp = await Wallpaper.findById(id);
    if (!wp) {
      return res.status(404).json({ message: 'Wallpaper not found.' });
    }

    // Check ownership
    if (wp.uploadedById.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to delete this wallpaper.' });
    }

    // Check if the image was uploaded via Cloudinary
    const isCloudinary = wp.imageUrl.startsWith('http') || wp.imageUrl.includes('res.cloudinary.com');

    if (isCloudinary) {
      // Delete from Cloudinary
      if (cloudinary.isConfigured()) {
        try {
          await cloudinary.deleteFromCloudinary(wp.filename);
        } catch (cloudErr) {
          console.error('Cloudinary deletion failed:', cloudErr.message);
          // Don't block DB deletion if Cloudinary fails (e.g. invalid public_id or credentials)
        }
      }
    } else {
      // Delete physical file from local disk
      const filePath = path.join(__dirname, '../../../uploads', wp.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete from DB
    await Wallpaper.deleteOne({ _id: id });

    res.status(200).json({
      message: 'Wallpaper deleted successfully.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during deletion.', error: error.message });
  }
};

/**
 * Toggle like for a wallpaper
 */
const toggleLikeWallpaper = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const wp = await Wallpaper.findById(id);
    if (!wp) {
      return res.status(404).json({ message: 'Wallpaper not found.' });
    }

    // Ensure likes array exists (safeguard)
    if (!wp.likes) wp.likes = [];

    const index = wp.likes.indexOf(userId);
    let liked = false;

    if (index > -1) {
      // Already liked, so unlike it
      wp.likes.splice(index, 1);
      liked = false;
    } else {
      // Like it
      wp.likes.push(userId);
      liked = true;
    }

    wp.likesCount = wp.likes.length;
    await wp.save();

    // Track analytics hit asynchronously
    trackHit(id, 'likes', liked ? 1 : -1);

    res.status(200).json({
      message: liked ? 'Wallpaper liked.' : 'Wallpaper unliked.',
      liked,
      likesCount: wp.likesCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error toggling like.', error: error.message });
  }
};

/**
 * Increment view count for a wallpaper
 */
const incrementViews = async (req, res) => {
  try {
    const { id } = req.params;
    const wp = await Wallpaper.findByIdAndUpdate(
      id,
      { $inc: { viewsCount: 1 } },
      { new: true }
    );
    if (!wp) {
      return res.status(404).json({ message: 'Wallpaper not found.' });
    }
    // Track views analytics asynchronously
    trackHit(id, 'views', 1);
    res.status(200).json({ viewsCount: wp.viewsCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error incrementing view count.', error: error.message });
  }
};

/**
 * Increment download count for a wallpaper
 */
const incrementDownloads = async (req, res) => {
  try {
    const { id } = req.params;
    const wp = await Wallpaper.findByIdAndUpdate(
      id,
      { $inc: { downloadsCount: 1 } },
      { new: true }
    );
    if (!wp) {
      return res.status(404).json({ message: 'Wallpaper not found.' });
    }
    // Track downloads analytics asynchronously
    trackHit(id, 'downloads', 1);
    res.status(200).json({ downloadsCount: wp.downloadsCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error incrementing download count.', error: error.message });
  }
};

const getFeed = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const currentUserId = req.user.id;

    const { User } = require('../../../databaseModels');
    const user = await User.findById(currentUserId);
    if (!user || !user.following || user.following.length === 0) {
      return res.status(200).json({ wallpapers: [], hasMore: false, total: 0, page: 1 });
    }

    const query = { uploadedById: { $in: user.following } };

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 12;
    const skip = (pageNum - 1) * limitNum;

    const [wallpapers, total] = await Promise.all([
      Wallpaper.find(query).sort({ uploadedAt: -1 }).skip(skip).limit(limitNum).lean(),
      Wallpaper.countDocuments(query)
    ]);

    const hasMore = pageNum * limitNum < total;

    res.status(200).json({ wallpapers, hasMore, total, page: pageNum });
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving feed.', error: error.message });
  }
};

/**
 * Retrieve a list of featured wallpapers
 */
const getFeaturedWallpapers = async (req, res) => {
  try {
    const featured = await Wallpaper.find({ isFeatured: true })
      .sort({ featuredAt: -1 })
      .limit(5)
      .lean();
    res.status(200).json(featured);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving featured wallpapers.', error: error.message });
  }
};

/**
 * Toggle featured status of a wallpaper (Owner-only)
 */
const toggleFeatureWallpaper = async (req, res) => {
  try {
    const { id } = req.params;
    const wp = await Wallpaper.findById(id);
    if (!wp) {
      return res.status(404).json({ message: 'Wallpaper not found.' });
    }

    // Check ownership
    if (wp.uploadedById.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to feature this wallpaper.' });
    }

    // Toggle featured status
    wp.isFeatured = !wp.isFeatured;
    wp.featuredAt = wp.isFeatured ? new Date() : null;
    await wp.save();

    res.status(200).json({
      message: wp.isFeatured ? 'Wallpaper marked as featured.' : 'Wallpaper removed from featured.',
      isFeatured: wp.isFeatured,
      wallpaper: wp
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error toggling featured status.', error: error.message });
  }
};

/**
 * Get a single wallpaper by ID
 */
const getWallpaperById = async (req, res) => {
  try {
    const { id } = req.params;
    const wallpaper = await Wallpaper.findById(id);
    if (!wallpaper) {
      return res.status(404).json({ message: 'Wallpaper not found.' });
    }
    res.status(200).json(wallpaper);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving wallpaper.', error: error.message });
  }
};

/**
 * Suggest similar wallpapers using color distance matching and tags/category overlap
 */
const getSimilarWallpapers = async (req, res) => {
  try {
    const { id } = req.params;
    const target = await Wallpaper.findById(id);
    if (!target) {
      return res.status(404).json({ message: 'Wallpaper not found.' });
    }

    // Chamfer distance calculation helper between target palette T and candidate palette C
    const getPaletteDistance = (tPalette, cPalette) => {
      if (!tPalette || tPalette.length === 0 || !cPalette || cPalette.length === 0) {
        return 441.67; // Max possible Euclidean distance in RGB space
      }

      const getMinDistance = (p1, p2) => {
        let sum = 0;
        for (const c1 of p1) {
          let minD = Infinity;
          for (const c2 of p2) {
            const d = Math.sqrt(
              Math.pow((c1.r || 0) - (c2.r || 0), 2) +
              Math.pow((c1.g || 0) - (c2.g || 0), 2) +
              Math.pow((c1.b || 0) - (c2.b || 0), 2)
            );
            if (d < minD) minD = d;
          }
          sum += minD;
        }
        return sum / p1.length;
      };

      const d1 = getMinDistance(tPalette, cPalette);
      const d2 = getMinDistance(cPalette, tPalette);
      return (d1 + d2) / 2;
    };

    // Fetch other wallpapers
    const candidates = await Wallpaper.find({ _id: { $ne: target._id } }).lean();

    const scoredCandidates = candidates.map(candidate => {
      let colorDist = getPaletteDistance(target.colors, candidate.colors);

      // Category match bonus: subtract 30 from score
      let bonus = 0;
      if (target.category && candidate.category && target.category.toLowerCase() === candidate.category.toLowerCase()) {
        bonus += 30;
      }

      // Tag match bonus: subtract 15 per matching tag
      if (target.tags && candidate.tags && Array.isArray(target.tags) && Array.isArray(candidate.tags)) {
        const matchingTags = candidate.tags.filter(t => target.tags.includes(t));
        bonus += matchingTags.length * 15;
      }

      const finalScore = colorDist - bonus;

      return {
        ...candidate,
        similarityScore: finalScore
      };
    });

    // Sort ascending by score (lower score = higher similarity)
    scoredCandidates.sort((a, b) => a.similarityScore - b.similarityScore);

    // Return the top 6 most similar wallpapers
    const topSimilar = scoredCandidates.slice(0, 6);

    res.status(200).json(topSimilar);
  } catch (error) {
    res.status(500).json({ message: 'Server error retrieving similar wallpapers.', error: error.message });
  }
};

module.exports = {
  getWallpapers,
  getWallpaperById,
  uploadWallpaper,
  updateWallpaper,
  deleteWallpaper,
  toggleLikeWallpaper,
  incrementViews,
  incrementDownloads,
  getFeed,
  getFeaturedWallpapers,
  toggleFeatureWallpaper,
  getSimilarWallpapers
};

