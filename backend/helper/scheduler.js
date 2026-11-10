const { publishDueWallpapers, finalizeEndedChallenges } = require('./publishing');
const { recomputeTrending } = require('./trending');
const { reportError } = require('./logger');

const MINUTE = 60 * 1000;

const guarded = (name, task) => () => task().catch((err) => reportError(err, { source: `scheduler:${name}` }));

/**
 * Periodic jobs. These read their work from MongoDB, so scheduled posts survive
 * restarts and work with or without Redis. Each job claims records atomically,
 * so running several server instances won't publish anything twice.
 */
const startScheduler = () => {
  const everyMinute = guarded('minute', async () => {
    await publishDueWallpapers();
    await finalizeEndedChallenges();
  });
  const trending = guarded('trending', () => recomputeTrending());

  everyMinute();
  trending();
  const timers = [setInterval(everyMinute, MINUTE), setInterval(trending, 10 * MINUTE)];
  timers.forEach((timer) => timer.unref());
  return timers;
};

module.exports = { startScheduler };
