const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { validateRegister, validateLogin } = require('./validator');
const { authenticateToken } = require('../../../middleware/auth');
const { authLimiter, emailLimiter } = require('../../../middleware/rateLimiter');

router.post('/register', authLimiter, validateRegister, controller.register);
router.post('/login', authLimiter, validateLogin, controller.login);

router.get('/oauth/providers', controller.listOAuthProviders);
router.get('/oauth/:provider/start', authLimiter, controller.startOAuth);
router.post('/oauth/:provider/callback', authLimiter, controller.oauthCallback);

router.get('/me', authenticateToken, controller.getMe);
router.put('/email', authLimiter, authenticateToken, controller.setEmail);
router.post('/verify-email', authLimiter, controller.verifyEmail);
router.post('/resend-verification', emailLimiter, authenticateToken, controller.resendVerification);
router.post('/forgot-password', emailLimiter, controller.forgotPassword);
router.post('/reset-password', authLimiter, controller.resetPassword);
router.put('/password', authLimiter, authenticateToken, controller.changePassword);

router.post('/2fa/setup', authLimiter, authenticateToken, controller.setupTwoFactor);
router.post('/2fa/enable', authLimiter, authenticateToken, controller.enableTwoFactor);
router.post('/2fa/disable', authLimiter, authenticateToken, controller.disableTwoFactor);
router.post('/2fa/verify', authLimiter, controller.verifyTwoFactorLogin);

module.exports = router;
