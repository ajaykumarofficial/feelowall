const express = require('express');
const router = express.Router();
const { toggleFollowUser, getFollowing, updateAvatar, updateProfile, getCreatorProfile, getCreatorAnalytics } = require('./controller');
const { authenticateToken, optionalAuthenticateToken } = require('../../../middleware/auth');
const upload = require('../../../middleware/upload');

router.post('/follow/:username', authenticateToken, toggleFollowUser);
router.get('/following', authenticateToken, getFollowing);
router.put('/avatar', authenticateToken, upload.single('file'), updateAvatar);
router.put('/profile', authenticateToken, updateProfile);
router.get('/analytics', authenticateToken, getCreatorAnalytics);
router.get('/profile/:username', optionalAuthenticateToken, getCreatorProfile);

module.exports = router;
