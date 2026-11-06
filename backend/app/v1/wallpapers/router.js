const express = require('express');
const router = express.Router();
const { 
  getWallpapers, 
  getWallpaperById,
  uploadWallpaper, 
  updateWallpaper, 
  deleteWallpaper,
  toggleLikeWallpaper,
  incrementViews,
  incrementDownloads,
  getFeed,
  getFeaturedWallpapers,
  toggleFeatureWallpaper,
  getSimilarWallpapers
} = require('./controller');
const { validateUpload, validateUpdate } = require('./validator');
const { authenticateToken } = require('../../../middleware/auth');

router.get('/', getWallpapers);
router.get('/featured', getFeaturedWallpapers);
router.get('/feed', authenticateToken, getFeed);
router.get('/:id/similar', getSimilarWallpapers);
router.get('/:id', getWallpaperById);
router.post('/upload', authenticateToken, validateUpload, uploadWallpaper);
router.put('/:id', authenticateToken, validateUpdate, updateWallpaper);
router.put('/:id/feature', authenticateToken, toggleFeatureWallpaper);
router.delete('/:id', authenticateToken, deleteWallpaper);

const { analyticsLimiter } = require('../../../middleware/rateLimiter');

router.post('/:id/like', analyticsLimiter, authenticateToken, toggleLikeWallpaper);
router.post('/:id/view', analyticsLimiter, incrementViews);
router.post('/:id/download', analyticsLimiter, incrementDownloads);

module.exports = router;
