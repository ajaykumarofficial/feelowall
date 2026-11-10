const express = require('express');
const router = express.Router();
const controller = require('./controller');
const comments = require('../comments/controller');
const { validateUpload, validateUpdate } = require('./validator');
const { authenticateToken, softAuthenticateToken, requireRole } = require('../../../middleware/auth');
const { analyticsLimiter, commentLimiter } = require('../../../middleware/rateLimiter');

// Fixed paths must come before /:id
router.get('/', softAuthenticateToken, controller.getWallpapers);
router.get('/featured', controller.getFeaturedWallpapers);
router.get('/tags', controller.getTags);
router.get('/feed', authenticateToken, controller.getFeed);
router.get('/for-you', authenticateToken, controller.getForYou);
router.get('/mine', authenticateToken, controller.getMyWallpapers);
router.get('/liked', authenticateToken, controller.getLikedWallpapers);
router.post('/upload', authenticateToken, validateUpload, controller.uploadWallpaper);

router.get('/:id/similar', softAuthenticateToken, controller.getSimilarWallpapers);
router.get('/:id/analytics', authenticateToken, controller.getWallpaperAnalytics);
router.get('/:id', softAuthenticateToken, controller.getWallpaperById);
router.put('/:id', authenticateToken, validateUpdate, controller.updateWallpaper);
router.put('/:id/publish', authenticateToken, controller.setPublishState);
router.put('/:id/feature', authenticateToken, requireRole('admin'), controller.toggleFeatureWallpaper);
router.delete('/:id', authenticateToken, controller.deleteWallpaper);

router.post('/:id/variants', authenticateToken, controller.addVariant);
router.delete('/:id/variants/:variantId', authenticateToken, controller.deleteVariant);

router.post('/:id/like', analyticsLimiter, authenticateToken, controller.toggleLikeWallpaper);
router.post('/:id/view', analyticsLimiter, controller.incrementViews);
router.post('/:id/download', analyticsLimiter, softAuthenticateToken, controller.incrementDownloads);

router.get('/:id/comments', softAuthenticateToken, comments.listComments);
router.post('/:id/comments', commentLimiter, authenticateToken, comments.createComment);

module.exports = router;
