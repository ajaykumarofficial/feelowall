const express = require('express');
const controller = require('./controller');
const { authenticateToken, requireRole } = require('../../../middleware/auth');
const { reportLimiter } = require('../../../middleware/rateLimiter');

const adminRouter = express.Router();
const staff = requireRole('admin', 'moderator');
const adminOnly = requireRole('admin');

adminRouter.use(authenticateToken);
adminRouter.get('/stats', staff, controller.getStats);
adminRouter.get('/reports', staff, controller.listReports);
adminRouter.put('/reports/:id', staff, controller.resolveReport);
adminRouter.put('/wallpapers/:id/status', staff, controller.updateWallpaperStatus);
adminRouter.get('/users', staff, controller.listUsers);
adminRouter.put('/users/:id/status', staff, controller.setUserStatus);
adminRouter.put('/users/:id/role', adminOnly, controller.setUserRole);
adminRouter.put('/users/:id/verified', adminOnly, controller.setUserVerified);

const reportsRouter = express.Router();
reportsRouter.post('/', reportLimiter, authenticateToken, controller.createReport);

module.exports = { adminRouter, reportsRouter };
