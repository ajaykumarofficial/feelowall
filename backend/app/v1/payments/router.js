const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { authenticateToken } = require('../../../middleware/auth');
const { paymentLimiter } = require('../../../middleware/rateLimiter');

router.use(authenticateToken);
router.get('/connect', controller.getConnectStatus);
router.post('/connect/onboard', paymentLimiter, controller.startOnboarding);
router.post('/connect/refresh', paymentLimiter, controller.refreshConnectStatus);
router.post('/connect/dashboard', paymentLimiter, controller.createDashboardLink);
router.post('/tips', paymentLimiter, controller.createTip);
router.get('/earnings', controller.getEarnings);

module.exports = router;
