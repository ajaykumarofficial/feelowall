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
  removeContributor,
  setCover,
  reorderWallpapers,
  setTimeSlots,
  getCurrentSlot,
  downloadZip
} = require('./controller');
const { authenticateToken, optionalAuthenticateToken, softAuthenticateToken } = require('../../../middleware/auth');
const { zipLimiter } = require('../../../middleware/rateLimiter');

router.post('/', authenticateToken, createPlaylist);
router.get('/', optionalAuthenticateToken, getPlaylists);
router.get('/:id', optionalAuthenticateToken, getPlaylistById);
router.put('/:id', authenticateToken, updatePlaylist);
router.delete('/:id', authenticateToken, deletePlaylist);

router.post('/:id/wallpapers', authenticateToken, addWallpaperToPlaylist);
router.delete('/:id/wallpapers/:wpId', authenticateToken, removeWallpaperFromPlaylist);

router.post('/:id/contributors', authenticateToken, addContributor);
router.delete('/:id/contributors/:userId', authenticateToken, removeContributor);

router.put('/:id/cover', authenticateToken, setCover);
router.put('/:id/order', authenticateToken, reorderWallpapers);
router.put('/:id/time-slots', authenticateToken, setTimeSlots);
router.get('/:id/current', softAuthenticateToken, getCurrentSlot);
router.get('/:id/download', zipLimiter, softAuthenticateToken, downloadZip);

module.exports = router;
