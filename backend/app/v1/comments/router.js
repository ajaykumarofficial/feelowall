const express = require('express');
const router = express.Router();
const { deleteComment } = require('./controller');
const { authenticateToken } = require('../../../middleware/auth');

// Listing and posting live under /api/wallpapers/:id/comments
router.delete('/:id', authenticateToken, deleteComment);

module.exports = router;
