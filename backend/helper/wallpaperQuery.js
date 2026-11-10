const { publicFilter } = require('./visibility');
const { exactCI, containsCI, asString, normalizeTag } = require('./text');

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

const hexToRgb = (hex) => {
  if (typeof hex !== 'string') return null;
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const colorMatch = (color, threshold) => {
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  const range = parseInt(threshold, 10) || 45;
  return {
    $elemMatch: {
      r: { $gte: rgb.r - range, $lte: rgb.r + range },
      g: { $gte: rgb.g - range, $lte: rgb.g + range },
      b: { $gte: rgb.b - range, $lte: rgb.b + range }
    }
  };
};

const RESOLUTIONS = { '4k': 3840, '1440p': 2560, '1080p': 1920 };

const ASPECTS = {
  ultrawide: { aspectRatio: { $gte: 2.2 } },
  widescreen: { aspectRatio: { $gte: 1.5, $lt: 2.2 } },
  phone: { aspectRatio: { $lte: 0.65 } },
  square: { aspectRatio: { $gte: 0.95, $lte: 1.05 } }
};

/**
 * Build the Mongo filter for a public wallpaper listing. Only published work is
 * ever matched. `user` is an optional account document providing content preferences.
 */
const buildWallpaperFilter = (params = {}, user = null) => {
  const and = [publicFilter()];

  const category = asString(params.category);
  if (category && category !== 'All') and.push({ category: exactCI(category) });

  const search = asString(params.search);
  if (search) {
    const pattern = containsCI(search);
    and.push({ $or: [
      { title: pattern },
      { category: pattern },
      { uploadedBy: pattern },
      { tags: pattern },
      { altText: pattern }
    ] });
  }

  const tag = asString(params.tag);
  if (tag) and.push({ tags: exactCI(normalizeTag(tag)) });

  const creator = asString(params.creator);
  if (creator) and.push({ uploadedBy: exactCI(creator) });

  const colors = colorMatch(params.color, params.colorThreshold);
  if (colors) and.push({ colors });

  const minWidth = RESOLUTIONS[asString(params.resolution).toLowerCase()];
  if (minWidth) and.push({ width: { $gte: minWidth } });

  const orientation = asString(params.orientation).toLowerCase();
  if (['landscape', 'portrait', 'square'].includes(orientation)) and.push({ orientation });

  const aspect = ASPECTS[asString(params.aspect).toLowerCase()];
  if (aspect) and.push(aspect);

  // Mature content is off unless a signed-in user has turned it on.
  if (!user?.showMature) and.push({ isMature: { $ne: true } });
  if (user?.mutedUsers?.length) and.push({ uploadedById: { $nin: user.mutedUsers } });
  if (user?.mutedTags?.length) and.push({ tags: { $nin: user.mutedTags } });

  return { $and: and };
};

const SORTS = {
  likes: { likesCount: -1, uploadedAt: -1 },
  downloads: { downloadsCount: -1, uploadedAt: -1 },
  views: { viewsCount: -1, uploadedAt: -1 },
  trending: { trendingScore: -1, uploadedAt: -1 }
};

const buildSort = (sortBy) => SORTS[sortBy] || { uploadedAt: -1 };

const parsePaging = (params = {}) => {
  const page = Math.max(parseInt(params.page, 10) || 1, 1);
  const requested = parseInt(params.limit, 10);
  const limit = Math.min(requested > 0 ? requested : DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, limit, skip: (page - 1) * limit };
};

module.exports = { hexToRgb, buildWallpaperFilter, buildSort, parsePaging, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
