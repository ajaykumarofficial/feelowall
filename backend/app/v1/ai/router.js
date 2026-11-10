const express = require('express');
const fs = require('fs');
const router = express.Router();
const { Wallpaper, User } = require('../../../databaseModels');
const ai = require('../../../helper/ai');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');
const { asString, parseTags } = require('../../../helper/text');
const { buildWallpaperFilter, parsePaging } = require('../../../helper/wallpaperQuery');
const { authenticateToken, softAuthenticateToken } = require('../../../middleware/auth');
const { aiLimiter } = require('../../../middleware/rateLimiter');
const upload = require('../../../middleware/upload');

const MAX_QUERY_LENGTH = 300;

router.get('/status', (req, res) => res.status(200).json({ available: ai.isAiConfigured() }));

/** Suggest metadata for an image the creator is about to upload. Nothing is stored. */
router.post('/suggest', aiLimiter, authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Please choose an image.');
  try {
    if (!ai.isAiConfigured()) throw new HttpError(503, 'AI features are not set up on this server.', 'AI_UNAVAILABLE');
    if (!String(req.file.mimetype).startsWith('image/')) throw new HttpError(400, 'Please choose an image.');
    const suggestion = await ai.suggestMetadata(req.file.path);
    res.status(200).json({ ...suggestion, tags: parseTags(suggestion.tags) });
  } catch (err) {
    if (err instanceof ai.AiRefusalError) throw new HttpError(422, 'No suggestions are available for this image.');
    throw err;
  } finally {
    fs.unlink(req.file.path, () => {});
  }
}));

/**
 * Natural-language search: AI turns the sentence into filters, and the normal
 * search runs them. If AI is off or fails, it's a plain keyword search instead.
 */
router.post('/search', aiLimiter, softAuthenticateToken, asyncHandler(async (req, res) => {
  const query = asString(req.body.query).slice(0, MAX_QUERY_LENGTH);
  if (!query) throw new HttpError(400, 'Please enter a search.');

  const { page, limit, skip } = parsePaging(req.body);
  const preferences = req.user
    ? await User.findById(req.user.id).select('showMature mutedUsers mutedTags').lean()
    : null;

  const filter = buildWallpaperFilter({}, preferences);
  let mode = 'keyword';
  let interpreted = null;

  if (ai.isAiConfigured()) {
    try {
      interpreted = await ai.parseSearchQuery(query);
      mode = 'ai';
    } catch (err) {
      if (!(err instanceof ai.AiRefusalError) && !(err instanceof HttpError)) throw err;
    }
  }

  if (mode === 'ai') {
    const keywords = (Array.isArray(interpreted.keywords) ? interpreted.keywords : []).filter((word) => typeof word === 'string').slice(0, 5);
    const narrowed = buildWallpaperFilter({
      category: interpreted.category !== 'any' ? interpreted.category : '',
      orientation: interpreted.orientation !== 'any' ? interpreted.orientation : '',
      color: interpreted.color || ''
    }, preferences);
    filter.$and = narrowed.$and;
    if (keywords.length) {
      const keywordClauses = keywords.flatMap((word) => buildWallpaperFilter({ search: word }).$and.slice(-2, -1));
      filter.$and.push({ $or: keywordClauses });
    }
  } else {
    filter.$and = buildWallpaperFilter({ search: query }, preferences).$and;
  }

  const [wallpapers, total] = await Promise.all([
    Wallpaper.find(filter).sort({ trendingScore: -1, uploadedAt: -1 }).skip(skip).limit(limit).lean(),
    Wallpaper.countDocuments(filter)
  ]);
  res.status(200).json({ wallpapers, total, page, hasMore: page * limit < total, mode, interpreted });
}));

module.exports = router;
