const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test';

// Raises every limit together, for example when many people share one IP address.
const scale = Number(process.env.RATE_LIMIT_SCALE) > 0 ? Number(process.env.RATE_LIMIT_SCALE) : 1;

const limiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max: isTest ? 1000 : Math.ceil(max * scale),
  message: { message },
  standardHeaders: true,
  legacyHeaders: false
});

const MINUTE = 60 * 1000;

const authLimiter = limiter(MINUTE, 10, 'Too many authentication attempts. Please try again after a minute.');
const uploadLimiter = limiter(MINUTE, 5, 'Too many file uploads. Please try again after a minute.');
const analyticsLimiter = limiter(MINUTE, 30, 'Too many interactions. Please try again after a minute.');
const globalLimiter = limiter(MINUTE, 300, 'Too many requests. Please try again after a minute.');
const commentLimiter = limiter(MINUTE, 10, 'You are commenting too quickly. Please wait a minute.');
const reportLimiter = limiter(10 * MINUTE, 10, 'Too many reports. Please try again later.');
const zipLimiter = limiter(10 * MINUTE, 3, 'Too many ZIP downloads. Please try again in a few minutes.');
const aiLimiter = limiter(MINUTE, 10, 'Too many AI requests. Please try again after a minute.');
const paymentLimiter = limiter(MINUTE, 10, 'Too many payment attempts. Please try again after a minute.');
const emailLimiter = limiter(10 * MINUTE, 5, 'Too many email requests. Please try again later.');

/** Limit public API traffic per key, using the limit stored on that key. */
const apiKeyLimiter = rateLimit({
  windowMs: MINUTE,
  limit: (req) => req.apiKey?.rateLimitPerMinute || 60,
  keyGenerator: (req) => String(req.apiKey._id),
  message: { message: 'Rate limit exceeded for this API key.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false }
});

module.exports = {
  authLimiter,
  uploadLimiter,
  analyticsLimiter,
  globalLimiter,
  commentLimiter,
  reportLimiter,
  zipLimiter,
  aiLimiter,
  paymentLimiter,
  emailLimiter,
  apiKeyLimiter
};
