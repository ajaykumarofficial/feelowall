const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { Wallpaper, User, DailyAnalytics, DownloadHistory, Comment, Report } = require('../../../databaseModels');
const storage = require('../../../helper/storage');
const { trackHit } = require('../../../helper/analytics');
const { buildWallpaperFilter, buildSort, parsePaging } = require('../../../helper/wallpaperQuery');
const { publicFilter, canView, isPublic, isStaff, isOwner } = require('../../../helper/visibility');
const { parseTags, asString, normalizeTag, escapeRegex } = require('../../../helper/text');
const { isAllowedMediaUrl, isSafeFilename, UPLOADS_DIR } = require('../../../helper/media');
const { notify } = require('../../../helper/notifications');
const { onWallpaperPublished } = require('../../../helper/publishing');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');

const PREFERENCE_FIELDS = 'showMature mutedUsers mutedTags followedTags following';

const loadPreferences = (req) => (req.user
  ? User.findById(req.user.id).select(PREFERENCE_FIELDS).lean()
  : Promise.resolve(null));

/** A record's "not found" for anything the viewer isn't allowed to see, so hidden items can't be probed. */
const loadVisible = async (id, user) => {
  const wallpaper = await Wallpaper.findById(id);
  if (!wallpaper || !canView(wallpaper, user)) throw new HttpError(404, 'Wallpaper not found.');
  return wallpaper;
};

const loadOwned = async (id, user, action = 'update') => {
  const wallpaper = await Wallpaper.findById(id);
  if (!wallpaper) throw new HttpError(404, 'Wallpaper not found.');
  if (!isOwner(wallpaper, user)) throw new HttpError(403, `You are not authorized to ${action} this wallpaper.`);
  return wallpaper;
};

/**
 * Get all wallpapers (with category, search, sort & pagination)
 */
const getWallpapers = asyncHandler(async (req, res) => {
  // Personalised results must not be stored in shared caches, and the browser
  // must not reuse a signed-out response after logging in.
  res.setHeader('Vary', 'Authorization');
  res.setHeader('Cache-Control', req.user
    ? 'private, no-store'
    : 'public, max-age=60, s-maxage=3600, stale-while-revalidate=600');

  const preferences = await loadPreferences(req);
  const filter = buildWallpaperFilter(req.query, preferences);
  const { page, limit, skip } = parsePaging(req.query);

  const [wallpapers, total] = await Promise.all([
    Wallpaper.find(filter).sort(buildSort(req.query.sortBy)).skip(skip).limit(limit).lean(),
    Wallpaper.countDocuments(filter)
  ]);

  res.status(200).json({ wallpapers, hasMore: page * limit < total, total, page });
});

/**
 * Handle custom wallpaper uploads
 */
const uploadWallpaper = asyncHandler(async (req, res) => {
  const {
    title, category, imageUrl, filename, colors, isLive, videoUrl, tags,
    license, sourceUrl, altText, isMature, status, scheduledAt
  } = req.body;

  const finalStatus = status || 'published';
  const now = new Date();

  const newWallpaper = new Wallpaper({
    title,
    category,
    imageUrl,
    filename,
    colors: Array.isArray(colors) ? colors : [],
    isLive: !!isLive,
    videoUrl: videoUrl || '',
    tags: parseTags(tags),
    license: license || 'personal-use',
    sourceUrl: sourceUrl || '',
    altText: asString(altText).slice(0, 500),
    isMature: !!isMature,
    status: finalStatus,
    scheduledAt: finalStatus === 'scheduled' ? new Date(scheduledAt) : null,
    publishedAt: finalStatus === 'published' ? now : null,
    uploadedBy: req.user.username,
    uploadedById: req.user.id
  });
  await newWallpaper.save();

  // Trigger background image optimization, WebP conversion, and color extraction
  const { enqueueImageProcess } = require('../../../helper/queue');

  const isRemote = String(imageUrl).startsWith('http');
  const localFilePath = isRemote ? '' : path.join(UPLOADS_DIR, filename);

  enqueueImageProcess({
    wpId: newWallpaper._id,
    filePath: localFilePath,
    imageUrl,
    isRemote,
    originalFilename: filename
  }).catch(err => console.error('Background processing enqueuing failed:', err));

  if (finalStatus === 'published') await onWallpaperPublished(newWallpaper);

  res.status(201).json({
    message: finalStatus === 'draft'
      ? 'Draft saved.'
      : finalStatus === 'scheduled'
        ? 'Wallpaper scheduled.'
        : 'Wallpaper uploaded successfully. Processing optimization in background.',
    wallpaper: newWallpaper
  });
});

/**
 * Update custom wallpaper details
 */
const updateWallpaper = asyncHandler(async (req, res) => {
  const wp = await loadOwned(req.params.id, req.user);
  const { title, category, tags, license, sourceUrl, altText, isMature } = req.body;

  wp.title = title;
  wp.category = category;
  if (tags !== undefined) wp.tags = parseTags(tags);
  if (license !== undefined) wp.license = license;
  if (sourceUrl !== undefined) wp.sourceUrl = sourceUrl;
  if (altText !== undefined) wp.altText = asString(altText).slice(0, 500);
  if (isMature !== undefined) wp.isMature = !!isMature;
  await wp.save();

  res.status(200).json({
    message: 'Wallpaper updated successfully.',
    wallpaper: wp
  });
});

/**
 * Publish a draft now, schedule it, or return it to drafts.
 * Moderated and pack-only wallpapers can't be changed this way.
 */
const setPublishState = asyncHandler(async (req, res) => {
  const wp = await loadOwned(req.params.id, req.user);
  const { status, scheduledAt } = req.body;

  if (!['draft', 'scheduled', 'published'].includes(wp.status || 'published')) {
    throw new HttpError(403, 'This wallpaper can\'t be changed right now.');
  }
  if (!['draft', 'scheduled', 'published'].includes(status)) {
    throw new HttpError(400, 'Status must be draft, scheduled, or published.');
  }

  const wasPublic = isPublic(wp);
  const now = new Date();

  if (status === 'scheduled') {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when <= now) throw new HttpError(400, 'Choose a publish time in the future.');
    wp.scheduledAt = when;
  } else {
    wp.scheduledAt = null;
  }
  if (status === 'published' && !wasPublic) {
    wp.publishedAt = now;
    wp.uploadedAt = now;
  }
  wp.status = status;
  await wp.save();

  if (status === 'published' && !wasPublic) await onWallpaperPublished(wp);

  res.status(200).json({ message: 'Publishing settings saved.', wallpaper: wp });
});

/** All of the signed-in creator's wallpapers, including drafts and hidden ones. */
const getMyWallpapers = asyncHandler(async (req, res) => {
  const filter = { uploadedById: req.user.id, status: { $ne: 'removed' } };
  if (['draft', 'scheduled', 'published', 'hidden', 'pack-only'].includes(req.query.status)) {
    filter.status = req.query.status;
  }
  const wallpapers = await Wallpaper.find(filter).sort({ uploadedAt: -1 }).limit(500).lean();
  res.status(200).json({ wallpapers });
});

const removeStoredFile = async (imageUrl, filename) => {
  if (String(imageUrl).startsWith('http')) {
    // Only delete objects that live in our own bucket.
    const key = storage.keyFromUrl(String(imageUrl));
    if (key) {
      try {
        await storage.deleteFile(key);
      } catch (storageErr) {
        // Don't block DB deletion if S3 fails (e.g. credentials or permissions)
        console.error('S3 deletion failed:', storageErr.message);
      }
    }
    return;
  }
  // Records from before filename validation could hold a path, so only ever delete inside uploads.
  const filePath = path.join(UPLOADS_DIR, path.basename(String(filename)));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

/** Delete a wallpaper, its files, and the records that hang off it. */
const destroyWallpaper = async (wp) => {
  await removeStoredFile(wp.imageUrl, wp.filename);
  for (const variant of wp.variants || []) await removeStoredFile(variant.imageUrl, variant.filename);

  const comments = await Comment.find({ wallpaperId: wp._id }).select('_id').lean();
  await Promise.all([
    Comment.deleteMany({ wallpaperId: wp._id }),
    Report.deleteMany({ targetType: 'comment', targetId: { $in: comments.map((c) => c._id) } }),
    DownloadHistory.deleteMany({ wallpaperId: wp._id }),
    Report.deleteMany({ targetType: 'wallpaper', targetId: wp._id }),
    DailyAnalytics.deleteMany({ wallpaperId: wp._id }),
    Wallpaper.deleteOne({ _id: wp._id })
  ]);
};

/**
 * Delete custom wallpaper and physical file
 */
const deleteWallpaper = asyncHandler(async (req, res) => {
  const wp = await loadOwned(req.params.id, req.user, 'delete');
  if (wp.status === 'pack-only') {
    throw new HttpError(400, 'This wallpaper is part of a pack. Remove it from sale first.');
  }
  await destroyWallpaper(wp);
  res.status(200).json({
    message: 'Wallpaper deleted successfully.'
  });
});

/**
 * Toggle like for a wallpaper
 */
const toggleLikeWallpaper = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const wp = await loadVisible(id, req.user);

  // Ensure likes array exists (safeguard)
  if (!wp.likes) wp.likes = [];

  const index = wp.likes.indexOf(userId);
  const liked = index === -1;
  if (liked) wp.likes.push(userId);
  else wp.likes.splice(index, 1);

  wp.likesCount = wp.likes.length;
  await wp.save();

  // Track analytics hit asynchronously
  trackHit(id, 'likes', liked ? 1 : -1);

  if (liked) {
    await notify({
      userId: wp.uploadedById,
      type: 'like',
      actorId: userId,
      actorName: req.user.username,
      text: `liked "${wp.title}"`,
      link: `/wallpaper/${wp._id}`,
      groupKey: `like:${wp._id}`
    });
  }

  res.status(200).json({
    message: liked ? 'Wallpaper liked.' : 'Wallpaper unliked.',
    liked,
    likesCount: wp.likesCount
  });
});

/**
 * Increment view count for a wallpaper
 */
const incrementViews = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const wp = await Wallpaper.findByIdAndUpdate(id, { $inc: { viewsCount: 1 } }, { new: true });
  if (!wp) {
    return res.status(404).json({ message: 'Wallpaper not found.' });
  }
  // Track views analytics asynchronously
  trackHit(id, 'views', 1);
  res.status(200).json({ viewsCount: wp.viewsCount });
});

/**
 * Increment download count for a wallpaper, and add it to the user's history if signed in
 */
const incrementDownloads = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const wp = await Wallpaper.findByIdAndUpdate(id, { $inc: { downloadsCount: 1 } }, { new: true });
  if (!wp) {
    return res.status(404).json({ message: 'Wallpaper not found.' });
  }
  // Track downloads analytics asynchronously
  trackHit(id, 'downloads', 1);
  if (req.user) {
    await DownloadHistory.findOneAndUpdate(
      { userId: req.user.id, wallpaperId: wp._id },
      { $set: { downloadedAt: new Date() } },
      { upsert: true }
    );
  }
  res.status(200).json({ downloadsCount: wp.downloadsCount });
});

/** Latest uploads from followed creators and followed tags. */
const getFeed = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select(PREFERENCE_FIELDS).lean();
  const following = user?.following || [];
  const followedTags = user?.followedTags || [];

  if (!following.length && !followedTags.length) {
    return res.status(200).json({ wallpapers: [], hasMore: false, total: 0, page: 1 });
  }

  const sources = [];
  if (following.length) sources.push({ uploadedById: { $in: following } });
  if (followedTags.length) sources.push({ tags: { $in: followedTags } });

  const filter = buildWallpaperFilter({}, user);
  filter.$and.push({ $or: sources });
  filter.$and.push({ uploadedById: { $ne: req.user.id } });

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const { limit, skip } = parsePaging({ page, limit: req.query.limit || 12 });

  const [wallpapers, total] = await Promise.all([
    Wallpaper.find(filter).sort({ uploadedAt: -1 }).skip(skip).limit(limit).lean(),
    Wallpaper.countDocuments(filter)
  ]);

  res.status(200).json({ wallpapers, hasMore: page * limit < total, total, page });
});

/**
 * Retrieve a list of featured wallpapers
 */
const getFeaturedWallpapers = asyncHandler(async (req, res) => {
  const featured = await Wallpaper.find({ isFeatured: true, ...publicFilter(), isMature: { $ne: true } })
    .sort({ featuredAt: -1 })
    .limit(5)
    .lean();
  res.status(200).json(featured);
});

/**
 * Toggle featured status of a wallpaper (admins only, so the showcase stays curated)
 */
const toggleFeatureWallpaper = asyncHandler(async (req, res) => {
  const wp = await Wallpaper.findById(req.params.id);
  if (!wp) {
    return res.status(404).json({ message: 'Wallpaper not found.' });
  }

  wp.isFeatured = !wp.isFeatured;
  wp.featuredAt = wp.isFeatured ? new Date() : null;
  await wp.save();

  if (wp.isFeatured) {
    await notify({
      userId: wp.uploadedById,
      type: 'featured',
      text: `Your wallpaper "${wp.title}" is now featured!`,
      link: `/wallpaper/${wp._id}`
    });
  }

  res.status(200).json({
    message: wp.isFeatured ? 'Wallpaper marked as featured.' : 'Wallpaper removed from featured.',
    isFeatured: wp.isFeatured,
    wallpaper: wp
  });
});

/**
 * Get a single wallpaper by ID
 */
const getWallpaperById = asyncHandler(async (req, res) => {
  const wallpaper = await loadVisible(req.params.id, req.user);
  res.status(200).json(wallpaper);
});

const MAX_SIMILAR_CANDIDATES = 500;

/** Chamfer distance between two palettes: lower means more alike. */
const paletteDistance = (first, second) => {
  if (!first?.length || !second?.length) return 441.67; // Max possible Euclidean distance in RGB space
  const oneWay = (from, to) => from.reduce((sum, a) => sum + Math.min(...to.map((b) => Math.sqrt(
    ((a.r || 0) - (b.r || 0)) ** 2 +
    ((a.g || 0) - (b.g || 0)) ** 2 +
    ((a.b || 0) - (b.b || 0)) ** 2
  ))), 0) / from.length;
  return (oneWay(first, second) + oneWay(second, first)) / 2;
};

/**
 * Suggest similar wallpapers using color distance matching and tags/category overlap
 */
const getSimilarWallpapers = asyncHandler(async (req, res) => {
  const target = await loadVisible(req.params.id, req.user);
  const preferences = await loadPreferences(req);

  const filter = buildWallpaperFilter({}, preferences);
  filter.$and.push({ _id: { $ne: target._id } });

  // Score a bounded set of the newest wallpapers rather than the whole collection.
  const candidates = await Wallpaper.find(filter)
    .sort({ uploadedAt: -1 })
    .limit(MAX_SIMILAR_CANDIDATES)
    .select('-likes')
    .lean();

  const targetCategory = String(target.category || '').toLowerCase();
  const targetTags = target.tags || [];

  const scored = candidates.map((candidate) => {
    let bonus = 0;
    if (targetCategory && targetCategory === String(candidate.category || '').toLowerCase()) bonus += 30;
    bonus += (candidate.tags || []).filter((tag) => targetTags.includes(tag)).length * 15;
    return { ...candidate, similarityScore: paletteDistance(target.colors, candidate.colors) - bonus };
  });

  scored.sort((a, b) => a.similarityScore - b.similarityScore);
  res.status(200).json(scored.slice(0, 6));
});

/** Popular tags, optionally narrowed by what's been typed so far. */
const getTags = asyncHandler(async (req, res) => {
  const query = asString(req.query.q).toLowerCase();
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  const pipeline = [
    { $match: publicFilter() },
    { $unwind: '$tags' },
    { $project: { tag: { $toLower: '$tags' } } }
  ];
  if (query) pipeline.push({ $match: { tag: { $regex: `^${escapeRegex(normalizeTag(query))}` } } });
  pipeline.push(
    { $group: { _id: '$tag', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit }
  );

  const rows = await Wallpaper.aggregate(pipeline);
  res.status(200).json({ tags: rows.map((row) => ({ tag: row._id, count: row.count })) });
});

/** The signed-in user's likes, newest first. */
const getLikedWallpapers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query);
  const filter = { likes: req.user.id, ...publicFilter() };
  const [wallpapers, total] = await Promise.all([
    Wallpaper.find(filter).sort({ uploadedAt: -1 }).skip(skip).limit(limit).select('-likes').lean(),
    Wallpaper.countDocuments(filter)
  ]);
  res.status(200).json({ wallpapers, hasMore: page * limit < total, total, page });
});

/**
 * Personal recommendations. Builds a profile from what the user has liked and
 * follows, then scores recent wallpapers against it. Falls back to trending for
 * new users with nothing to learn from.
 */
const getForYou = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging({ page: req.query.page, limit: req.query.limit || 24 });
  const user = await User.findById(req.user.id).select(PREFERENCE_FIELDS).lean();

  const liked = await Wallpaper.find({ likes: req.user.id })
    .sort({ uploadedAt: -1 })
    .limit(200)
    .select('category tags colors')
    .lean();

  const filter = buildWallpaperFilter({}, user);
  filter.$and.push({ uploadedById: { $ne: req.user.id } }, { likes: { $ne: req.user.id } });

  if (!liked.length && !user?.following?.length && !user?.followedTags?.length) {
    const [wallpapers, total] = await Promise.all([
      Wallpaper.find(filter).sort(buildSort('trending')).skip(skip).limit(limit).lean(),
      Wallpaper.countDocuments(filter)
    ]);
    return res.status(200).json({ wallpapers, hasMore: page * limit < total, total, page, personalized: false });
  }

  const categoryWeights = {};
  const tagWeights = {};
  for (const tag of user?.followedTags || []) tagWeights[tag] = 3;
  for (const item of liked) {
    const category = String(item.category || '').toLowerCase();
    if (category) categoryWeights[category] = (categoryWeights[category] || 0) + 1;
    for (const tag of item.tags || []) {
      const key = String(tag).toLowerCase();
      tagWeights[key] = (tagWeights[key] || 0) + 1;
    }
  }
  const palette = liked.flatMap((item) => item.colors || []).slice(0, 60);
  const followed = new Set((user?.following || []).map(String));

  const candidates = await Wallpaper.find(filter)
    .sort({ uploadedAt: -1 })
    .limit(MAX_SIMILAR_CANDIDATES)
    .lean();

  const scored = candidates.map((candidate) => {
    let score = (categoryWeights[String(candidate.category || '').toLowerCase()] || 0) * 2;
    for (const tag of candidate.tags || []) score += tagWeights[String(tag).toLowerCase()] || 0;
    if (followed.has(String(candidate.uploadedById))) score += 8;
    if (palette.length && candidate.colors?.length) score += Math.max(0, 6 - paletteDistance(candidate.colors, palette) / 25);
    score += Math.min(candidate.trendingScore || 0, 50) / 25;
    return { candidate, score };
  });
  scored.sort((a, b) => b.score - a.score);

  res.status(200).json({
    wallpapers: scored.slice(skip, skip + limit).map((row) => row.candidate),
    hasMore: skip + limit < scored.length,
    total: scored.length,
    page,
    personalized: true
  });
});

/** Daily stats for one wallpaper, for its owner or staff. */
const getWallpaperAnalytics = asyncHandler(async (req, res) => {
  const wp = await Wallpaper.findById(req.params.id).lean();
  if (!wp) throw new HttpError(404, 'Wallpaper not found.');
  if (!isOwner(wp, req.user) && !isStaff(req.user)) {
    throw new HttpError(403, 'You can only view analytics for your own wallpapers.');
  }

  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);

  const rows = await DailyAnalytics.find({
    wallpaperId: new mongoose.Types.ObjectId(req.params.id),
    date: { $gte: start }
  }).lean();
  const byDate = new Map(rows.map((row) => [new Date(row.date).toISOString().split('T')[0], row]));

  const series = Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    const date = day.toISOString().split('T')[0];
    const row = byDate.get(date) || {};
    return { date, views: row.views || 0, downloads: row.downloads || 0, likes: row.likes || 0 };
  });

  const period = series.reduce((sum, day) => ({
    views: sum.views + day.views,
    downloads: sum.downloads + day.downloads,
    likes: sum.likes + day.likes
  }), { views: 0, downloads: 0, likes: 0 });

  res.status(200).json({
    wallpaper: { id: wp._id, title: wp.title },
    totals: { views: wp.viewsCount || 0, downloads: wp.downloadsCount || 0, likes: wp.likesCount || 0 },
    period: { ...period, downloadRate: period.views ? Math.round((period.downloads / period.views) * 1000) / 10 : 0 },
    series
  });
});

// ─── Variants ────────────────────────────────────────────────

const VARIANT_LABELS = ['desktop', 'mobile', 'tablet', 'ultrawide', 'light', 'dark'];

const addVariant = asyncHandler(async (req, res) => {
  const wp = await loadOwned(req.params.id, req.user);
  const { label, imageUrl, filename, width, height } = req.body;

  if (!VARIANT_LABELS.includes(label)) throw new HttpError(400, 'Please choose a valid variant type.');
  if (!isAllowedMediaUrl(imageUrl) || !isSafeFilename(filename, imageUrl)) {
    throw new HttpError(400, 'The image must be uploaded through FeeloWall.');
  }
  if ((wp.variants || []).some((variant) => variant.label === label)) {
    throw new HttpError(400, `This wallpaper already has a ${label} version.`);
  }

  wp.variants.push({
    label,
    imageUrl,
    filename,
    width: Number(width) > 0 ? Number(width) : null,
    height: Number(height) > 0 ? Number(height) : null
  });
  await wp.save();
  res.status(201).json({ message: 'Variant added.', variants: wp.variants });
});

const deleteVariant = asyncHandler(async (req, res) => {
  const wp = await loadOwned(req.params.id, req.user);
  const variant = wp.variants.id(req.params.variantId);
  if (!variant) throw new HttpError(404, 'Variant not found.');

  await removeStoredFile(variant.imageUrl, variant.filename);
  variant.deleteOne();
  await wp.save();
  res.status(200).json({ message: 'Variant removed.', variants: wp.variants });
});

module.exports = {
  getWallpapers,
  getWallpaperById,
  uploadWallpaper,
  updateWallpaper,
  setPublishState,
  getMyWallpapers,
  deleteWallpaper,
  destroyWallpaper,
  toggleLikeWallpaper,
  incrementViews,
  incrementDownloads,
  getFeed,
  getFeaturedWallpapers,
  toggleFeatureWallpaper,
  getSimilarWallpapers,
  getTags,
  getForYou,
  getLikedWallpapers,
  getWallpaperAnalytics,
  addVariant,
  deleteVariant
};
