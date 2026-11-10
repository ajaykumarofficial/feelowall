const express = require('express');
const router = express.Router();
const { Wallpaper, Playlist } = require('../../databaseModels');
const { asyncHandler, HttpError } = require('../../helper/asyncHandler');
const { buildWallpaperFilter, buildSort, parsePaging } = require('../../helper/wallpaperQuery');
const { isPublic, publicFilter } = require('../../helper/visibility');
const { absoluteMediaUrl } = require('../../helper/media');
const { requireApiKey } = require('../../middleware/apiKey');
const { apiKeyLimiter } = require('../../middleware/rateLimiter');
const openapi = require('./openapi.json');

// A stable, deliberate shape: internal fields like the likes list never leak into the public API.
const toPublic = (wp) => ({
  id: String(wp._id),
  title: wp.title,
  category: wp.category,
  tags: wp.tags || [],
  imageUrl: absoluteMediaUrl(wp.imageUrl),
  altText: wp.altText || '',
  creator: wp.uploadedBy,
  license: wp.license || 'personal-use',
  sourceUrl: wp.sourceUrl || '',
  width: wp.width || null,
  height: wp.height || null,
  orientation: wp.orientation || null,
  colors: (wp.colors || []).map((color) => color.hex).filter(Boolean),
  likes: wp.likesCount || 0,
  views: wp.viewsCount || 0,
  downloads: wp.downloadsCount || 0,
  uploadedAt: wp.uploadedAt
});

router.get('/openapi.json', (req, res) => res.status(200).json(openapi));

router.use(requireApiKey, apiKeyLimiter);

router.get('/wallpapers', asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaging(req.query);
  const filter = buildWallpaperFilter(req.query);
  const [rows, total] = await Promise.all([
    Wallpaper.find(filter).sort(buildSort(req.query.sort)).skip(skip).limit(limit).lean(),
    Wallpaper.countDocuments(filter)
  ]);
  res.status(200).json({ data: rows.map(toPublic), page, limit, total, hasMore: page * limit < total });
}));

router.get('/wallpapers/:id', asyncHandler(async (req, res) => {
  const wallpaper = await Wallpaper.findById(req.params.id).lean();
  if (!wallpaper || !isPublic(wallpaper) || wallpaper.isMature) throw new HttpError(404, 'Wallpaper not found.');
  res.status(200).json({ data: toPublic(wallpaper) });
}));

router.get('/tags', asyncHandler(async (req, res) => {
  const rows = await Wallpaper.aggregate([
    { $match: publicFilter() },
    { $unwind: '$tags' },
    { $group: { _id: { $toLower: '$tags' }, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: Math.min(parseInt(req.query.limit, 10) || 50, 200) }
  ]);
  res.status(200).json({ data: rows.map((row) => ({ tag: row._id, count: row.count })) });
}));

/** A public collection, or a private one owned by or shared with the key's owner. */
const loadCollection = async (id, apiKey) => {
  const playlist = await Playlist.findById(id)
    .populate({ path: 'wallpapers', match: { ...publicFilter(), isMature: { $ne: true } } })
    .lean();
  const ownerId = String(apiKey.userId);
  const hasAccess = playlist && (
    playlist.isPublic ||
    String(playlist.creatorId) === ownerId ||
    (playlist.contributors || []).some((contributor) => String(contributor) === ownerId)
  );
  if (!hasAccess) throw new HttpError(404, 'Collection not found.');
  return playlist;
};

router.get('/collections/:id', asyncHandler(async (req, res) => {
  const playlist = await loadCollection(req.params.id, req.apiKey);
  res.status(200).json({
    data: {
      id: String(playlist._id),
      name: playlist.name,
      description: playlist.description,
      creator: playlist.creator,
      wallpapers: (playlist.wallpapers || []).map(toPublic)
    }
  });
}));

/** One random wallpaper. With ?redirect=1 it answers with the image itself, which suits phone automations. */
router.get('/collections/:id/random', asyncHandler(async (req, res) => {
  const playlist = await loadCollection(req.params.id, req.apiKey);
  const wallpapers = playlist.wallpapers || [];
  if (!wallpapers.length) throw new HttpError(404, 'This collection has no wallpapers.');

  const pick = wallpapers[Math.floor(Math.random() * wallpapers.length)];
  res.setHeader('Cache-Control', 'no-store');
  if (req.query.redirect === '1') return res.redirect(302, absoluteMediaUrl(pick.imageUrl));
  res.status(200).json({ data: toPublic(pick) });
}));

module.exports = router;
