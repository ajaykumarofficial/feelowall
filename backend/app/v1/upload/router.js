const express = require('express');
const router = express.Router();
const { uploadFile } = require('./controller');
const { authenticateToken } = require('../../../middleware/auth');
const upload = require('../../../middleware/upload');

const { uploadLimiter } = require('../../../middleware/rateLimiter');

// POST /api/upload - Accepts standard multipart/form-data upload with key 'file'
router.post('/', uploadLimiter, authenticateToken, upload.single('file'), uploadFile);

module.exports = router;
