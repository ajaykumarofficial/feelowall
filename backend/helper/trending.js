const { DailyAnalytics, Wallpaper } = require('../databaseModels');

const WINDOW_DAYS = 14;
const HALF_LIFE_DAYS = 3;
const WEIGHTS = { views: 1, downloads: 3, likes: 5 };
const DAY_MS = 24 * 60 * 60 * 1000;

/** Activity from `ageDays` ago, halved every HALF_LIFE_DAYS. Un-likes can make a day negative, so it floors at 0. */
const dayScore = ({ views = 0, downloads = 0, likes = 0 }, ageDays) => {
  const raw = views * WEIGHTS.views + downloads * WEIGHTS.downloads + likes * WEIGHTS.likes;
  return Math.max(raw, 0) * Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
};

/** Recalculate trendingScore for every wallpaper with recent activity, and clear it on the rest. */
const recomputeTrending = async (now = new Date()) => {
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const rows = await DailyAnalytics.find({ date: { $gte: since } })
    .select('wallpaperId date views downloads likes')
    .lean();

  const scores = new Map();
  for (const row of rows) {
    const ageDays = Math.max((now.getTime() - new Date(row.date).getTime()) / DAY_MS, 0);
    const key = String(row.wallpaperId);
    scores.set(key, (scores.get(key) || 0) + dayScore(row, ageDays));
  }

  const ids = [...scores.keys()];
  if (ids.length) {
    await Wallpaper.bulkWrite(ids.map((id) => ({
      updateOne: { filter: { _id: id }, update: { $set: { trendingScore: Math.round(scores.get(id) * 1000) / 1000 } } }
    })));
  }
  await Wallpaper.updateMany({ _id: { $nin: ids }, trendingScore: { $ne: 0 } }, { $set: { trendingScore: 0 } });
  return ids.length;
};

module.exports = { recomputeTrending, dayScore, WEIGHTS, HALF_LIFE_DAYS };
