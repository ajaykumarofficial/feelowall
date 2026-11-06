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
app.use(express.json());
app.use(globalLimiter);
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

// Route definitions
app.use('/api/auth', authRouter);
app.use('/api/wallpapers', wallpapersRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/users', usersRouter);

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err.message || err);
  
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

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start background worker
require('./helper/worker');

// Start server if not running tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`Backend Express Server running at:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`==================================================`);
  });
}

module.exports = app;
