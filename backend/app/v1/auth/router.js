const express = require('express');
const router = express.Router();
const { register, login, oauthLogin } = require('./controller');
const { validateRegister, validateLogin } = require('./validator');

const { authLimiter } = require('../../../middleware/rateLimiter');

router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/oauth', authLimiter, oauthLogin);

module.exports = router;
