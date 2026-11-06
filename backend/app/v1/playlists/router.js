const express = require('express');
const router = express.Router();
const {
  createPlaylist,
  getPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addWallpaperToPlaylist,
  removeWallpaperFromPlaylist,
  addContributor,
  removeContributor
} = require('./controller');
const { authenticateToken, optionalAuthenticateToken } = require('../../../middleware/auth');

router.post('/', authenticateToken, createPlaylist);
router.get('/', optionalAuthenticateToken, getPlaylists);
router.get('/:id', optionalAuthenticateToken, getPlaylistById);
router.put('/:id', authenticateToken, updatePlaylist);
router.delete('/:id', authenticateToken, deletePlaylist);

router.post('/:id/wallpapers', authenticateToken, addWallpaperToPlaylist);
router.delete('/:id/wallpapers/:wpId', authenticateToken, removeWallpaperFromPlaylist);

router.post('/:id/contributors', authenticateToken, addContributor);
router.delete('/:id/contributors/:userId', authenticateToken, removeContributor);

module.exports = router;
