const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { authenticateToken, optionalAuthenticateToken } = require('../../../middleware/auth');
const upload = require('../../../middleware/upload');

router.post('/follow/:username', authenticateToken, controller.toggleFollowUser);
router.get('/following', authenticateToken, controller.getFollowing);
router.put('/avatar', authenticateToken, upload.single('file'), controller.updateAvatar);
router.put('/profile', authenticateToken, controller.updateProfile);
router.get('/analytics', authenticateToken, controller.getCreatorAnalytics);
router.get('/profile/:username', optionalAuthenticateToken, controller.getCreatorProfile);
router.get('/leaderboard', controller.getLeaderboard);

router.put('/preferences', authenticateToken, controller.updatePreferences);
router.get('/muted', authenticateToken, controller.getMutedUsers);
router.post('/tags/:tag/follow', authenticateToken, controller.toggleFollowTag);
router.post('/tags/:tag/mute', authenticateToken, controller.toggleMuteTag);
router.post('/mute/:username', authenticateToken, controller.toggleMuteUser);

router.get('/me/downloads', authenticateToken, controller.getDownloads);
router.delete('/me/downloads', authenticateToken, controller.clearDownloads);
router.delete('/me/downloads/:id', authenticateToken, controller.removeDownload);
router.get('/me/export', authenticateToken, controller.exportMyData);
router.delete('/me', authenticateToken, controller.deleteMyAccount);

module.exports = router;
