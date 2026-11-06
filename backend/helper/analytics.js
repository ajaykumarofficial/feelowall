const { DailyAnalytics, Wallpaper } = require('../databaseModels');

/**
 * Tracks a hit (view, download, or like change) for a specific wallpaper on the current day.
 * @param {string} wallpaperId - The ID of the wallpaper.
 * @param {string} type - The type of hit: 'views', 'downloads', or 'likes'.
 * @param {number} increment - The amount to increment/decrement (e.g. 1 or -1).
 */
const trackHit = async (wallpaperId, type, increment = 1) => {
  try {
    // 1. Get uploaderId (creatorId) of the wallpaper
    const wp = await Wallpaper.findById(wallpaperId);
    if (!wp) return;

    const creatorId = wp.uploadedById;
    
    // 2. Normalize date to start of UTC day
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 3. Upsert daily analytics record
    const update = {};
    update[type] = increment;

    await DailyAnalytics.findOneAndUpdate(
      { wallpaperId, date: today },
      { 
        $inc: update,
        $setOnInsert: { creatorId }
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Error tracking analytics hit:', err);
  }
};

module.exports = { trackHit };
