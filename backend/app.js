require('./helper/nodeCompatibility');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config');
require('./databaseModels'); // Triggers connection to MongoDB

// Import routers
const authRouter = require('./app/v1/auth/router');
const wallpapersRouter = require('./app/v1/wallpapers/router');
const uploadRouter = require('./app/v1/upload/router');
const playlistsRouter = require('./app/v1/playlists/router');
const usersRouter = require('./app/v1/users/router');
const commentsRouter = require('./app/v1/comments/router');
const notificationsRouter = require('./app/v1/notifications/router');
const { adminRouter, reportsRouter } = require('./app/v1/admin/router');
const challengesRouter = require('./app/v1/challenges/router');
const savedSearchesRouter = require('./app/v1/savedSearches/router');
const paymentsRouter = require('./app/v1/payments/router');
const { stripeWebhook } = require('./app/v1/payments/controller');
const packsRouter = require('./app/v1/packs/router');
const developerRouter = require('./app/v1/developer/router');
const aiRouter = require('./app/v1/ai/router');
const publicApiRouter = require('./app/public/router');
const publicPagesRouter = require('./app/public/pages');
const mongoose = require('mongoose');
const { getUseRedis } = require('./helper/queue');
const { isStripeConfigured } = require('./helper/stripe');
const { isAiConfigured } = require('./helper/ai');
const { reportError, redact } = require('./helper/logger');

const app = express();
const PORT = config.PORT;

// Ensure uploads folder exists in root
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const { globalLimiter } = require('./middleware/rateLimiter');

// Global middlewares
app.use(cors());
// The Stripe signature check needs the untouched request body, so this goes before express.json.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json());

// Behind a reverse proxy (Render, Nginx, Cloudflare...), set TRUST_PROXY to the number of proxies.
// Otherwise every visitor looks like one IP address and they all share one rate limit.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);

/** For uptime monitors. Unhealthy means the database is unreachable. */
app.get('/health', (req, res) => {
  const database = mongoose.connection.readyState === 1 ? 'up' : 'down';
  res.setHeader('Cache-Control', 'no-store');
  res.status(database === 'up' ? 200 : 503).json({
    status: database === 'up' ? 'ok' : 'unavailable',
    database,
    queue: getUseRedis() ? 'redis' : 'in-memory',
    payments: isStripeConfigured() ? 'configured' : 'off',
    ai: isAiConfigured() ? 'configured' : 'off',
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
  }
}));
app.use('/cli', express.static(path.join(__dirname, '..', 'cli'), {
  setHeaders: (res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="feelowall-cli.js"');
  }
}));

// After the static files: one gallery page loads dozens of images, which aren't API calls.
app.use(globalLimiter);

// Route definitions
app.use('/api/auth', authRouter);
app.use('/api/wallpapers', wallpapersRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/users', usersRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/challenges', challengesRouter);
app.use('/api/saved-searches', savedSearchesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/packs', packsRouter);
app.use('/api/developer', developerRouter);
app.use('/api/ai', aiRouter);
app.use('/api/public/v1', publicApiRouter);
app.use('/', publicPagesRouter);

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  // A malformed ID in the URL means there's nothing there, not that the server broke.
  if (err.name === 'CastError') {
    return res.status(404).json({ success: false, message: 'Not found.' });
  }

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size allowed is 5MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`
    });
  }

  const status = err.status || 500;
  if (status >= 500) reportError(err, { method: req.method, path: req.path });

  // Internal error details stay in the log. Deliberate errors (HttpError) carry a safe message.
  res.status(status).json({
    success: false,
    message: status >= 500 && !err.code ? 'Something went wrong. Please try again.' : redact(err.message),
    ...(err.code && typeof err.code === 'string' ? { code: err.code } : {})
  });
});

// Start background worker
require('./helper/worker');

// Start server if not running tests
if (process.env.NODE_ENV !== 'test') {
  require('./helper/scheduler').startScheduler();

  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`Backend Express Server running at:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
}

module.exports = app;
