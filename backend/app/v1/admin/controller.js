const { Report, Wallpaper, User, Comment } = require('../../../databaseModels');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');
const { asString, containsCI } = require('../../../helper/text');
const { notify } = require('../../../helper/notifications');

const USER_REASONS = ['copyright', 'nsfw', 'spam', 'other'];

/** Anyone signed in can report a wallpaper, profile, or comment. */
const createReport = asyncHandler(async (req, res) => {
  const { targetType, targetId, reason } = req.body;
  if (!['wallpaper', 'user', 'comment'].includes(targetType) || typeof targetId !== 'string') {
    throw new HttpError(400, 'Please choose something to report.');
  }
  if (!USER_REASONS.includes(reason)) throw new HttpError(400, 'Please choose a reason.');

  const Model = { wallpaper: Wallpaper, user: User, comment: Comment }[targetType];
  if (!await Model.exists({ _id: targetId })) throw new HttpError(404, 'That item no longer exists.');
  if (targetType === 'user' && targetId === req.user.id) throw new HttpError(400, 'You can\'t report yourself.');

  try {
    await Report.create({
      targetType,
      targetId,
      reason,
      reporterId: req.user.id,
      details: asString(req.body.details).slice(0, 1000)
    });
  } catch (err) {
    if (err.code === 11000) return res.status(200).json({ message: 'You have already reported this. Our team will review it.' });
    throw err;
  }
  res.status(201).json({ message: 'Thanks. Our team will review this report.' });
});

const getStats = asyncHandler(async (req, res) => {
  const [openReports, users, wallpapers, suspended] = await Promise.all([
    Report.countDocuments({ status: 'open' }),
    User.countDocuments(),
    Wallpaper.countDocuments(),
    User.countDocuments({ status: 'suspended' })
  ]);
  res.status(200).json({ openReports, users, wallpapers, suspended });
});

const describeTarget = async (report) => {
  if (report.targetType === 'wallpaper') {
    const wallpaper = await Wallpaper.findById(report.targetId).select('title imageUrl status uploadedBy uploadedById duplicateOf').lean();
    return wallpaper && {
      label: wallpaper.title,
      imageUrl: wallpaper.imageUrl,
      status: wallpaper.status || 'published',
      owner: wallpaper.uploadedBy,
      ownerId: wallpaper.uploadedById,
      duplicateOf: wallpaper.duplicateOf,
      link: `/wallpaper/${wallpaper._id}`
    };
  }
  if (report.targetType === 'user') {
    const user = await User.findById(report.targetId).select('username status').lean();
    return user && { label: user.username, status: user.status, owner: user.username, ownerId: user._id, link: `/creator/${user.username}` };
  }
  const comment = await Comment.findById(report.targetId).select('text status authorName authorId wallpaperId').lean();
  return comment && {
    label: comment.text,
    status: comment.status,
    owner: comment.authorName,
    ownerId: comment.authorId,
    link: `/wallpaper/${comment.wallpaperId}`
  };
};

const listReports = asyncHandler(async (req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
  const reports = await Report.find({ status })
    .sort({ createdAt: status === 'open' ? 1 : -1 })
    .limit(100)
    .populate('reporterId', 'username')
    .lean();

  const views = await Promise.all(reports.map(async (report) => ({
    id: String(report._id),
    targetType: report.targetType,
    targetId: String(report.targetId),
    reason: report.reason,
    details: report.details,
    status: report.status,
    resolution: report.resolution,
    reporter: report.reporterId?.username || 'Automated check',
    createdAt: report.createdAt,
    target: await describeTarget(report)
  })));
  res.status(200).json({ reports: views });
});

const setWallpaperStatus = async (wallpaper, status) => {
  wallpaper.status = status;
  if (status !== 'published') {
    wallpaper.isFeatured = false;
    wallpaper.featuredAt = null;
  }
  await wallpaper.save();
  if (status === 'hidden' || status === 'removed') {
    await notify({
      userId: wallpaper.uploadedById,
      type: 'moderation',
      text: `Your wallpaper "${wallpaper.title}" was ${status === 'hidden' ? 'hidden' : 'removed'} by a moderator.`,
      link: '/studio'
    });
  }
};

/** Suspending takes effect on the user's next request. Staff can't be suspended from here. */
const suspendAccount = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'User not found.');
  if (user.role !== 'user') throw new HttpError(403, 'Staff accounts can\'t be suspended. Change their role first.');
  user.status = 'suspended';
  await user.save();
  return user;
};

const resolveReport = asyncHandler(async (req, res) => {
  const { action } = req.body;
  if (!['dismiss', 'hide', 'remove', 'suspend'].includes(action)) throw new HttpError(400, 'Please choose an action.');

  const report = await Report.findById(req.params.id);
  if (!report) throw new HttpError(404, 'Report not found.');
  if (report.status !== 'open') throw new HttpError(400, 'This report has already been handled.');

  if (action === 'hide' || action === 'remove') {
    if (report.targetType === 'wallpaper') {
      const wallpaper = await Wallpaper.findById(report.targetId);
      if (wallpaper) await setWallpaperStatus(wallpaper, action === 'hide' ? 'hidden' : 'removed');
    } else if (report.targetType === 'comment') {
      await Comment.updateOne({ _id: report.targetId }, { $set: { status: 'hidden' } });
    } else {
      throw new HttpError(400, 'Profiles can only be suspended or dismissed.');
    }
  }

  if (action === 'suspend') {
    let userId = report.targetId;
    if (report.targetType === 'wallpaper') {
      userId = (await Wallpaper.findById(report.targetId).select('uploadedById').lean())?.uploadedById;
    } else if (report.targetType === 'comment') {
      userId = (await Comment.findById(report.targetId).select('authorId').lean())?.authorId;
    }
    if (!userId) throw new HttpError(404, 'The account no longer exists.');
    await suspendAccount(userId);
  }

  report.status = action === 'dismiss' ? 'dismissed' : 'resolved';
  report.resolution = action;
  report.resolvedBy = req.user.id;
  report.resolvedAt = new Date();
  await report.save();

  res.status(200).json({ message: 'Report handled.' });
});

const updateWallpaperStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['published', 'hidden', 'removed'].includes(status)) throw new HttpError(400, 'Please choose a valid status.');
  const wallpaper = await Wallpaper.findById(req.params.id);
  if (!wallpaper) throw new HttpError(404, 'Wallpaper not found.');
  await setWallpaperStatus(wallpaper, status);
  res.status(200).json({ message: 'Wallpaper updated.', status });
});

const listUsers = asyncHandler(async (req, res) => {
  const q = asString(req.query.q);
  const filter = q ? { username: containsCI(q) } : {};
  const users = await User.find(filter)
    .select('username role status isVerified email emailVerified twoFactor.enabled createdAt')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  res.status(200).json({
    users: users.map((user) => ({
      id: String(user._id),
      username: user.username,
      role: user.role || 'user',
      status: user.status || 'active',
      isVerified: !!user.isVerified,
      emailVerified: !!user.emailVerified,
      twoFactorEnabled: !!user.twoFactor?.enabled,
      createdAt: user.createdAt
    }))
  });
});

const setUserStatus = asyncHandler(async (req, res) => {
  const { suspended } = req.body;
  if (typeof suspended !== 'boolean') throw new HttpError(400, 'Please say whether to suspend this user.');
  if (suspended) {
    await suspendAccount(req.params.id);
    return res.status(200).json({ message: 'User suspended.', status: 'suspended' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { status: 'active' } });
  if (!user) throw new HttpError(404, 'User not found.');
  res.status(200).json({ message: 'Suspension lifted.', status: 'active' });
});

const setUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'moderator', 'admin'].includes(role)) throw new HttpError(400, 'Please choose a valid role.');
  if (req.params.id === req.user.id) throw new HttpError(400, 'You can\'t change your own role.');
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { role } });
  if (!user) throw new HttpError(404, 'User not found.');
  res.status(200).json({ message: `Role changed to ${role}.`, role });
});

const setUserVerified = asyncHandler(async (req, res) => {
  const { isVerified } = req.body;
  if (typeof isVerified !== 'boolean') throw new HttpError(400, 'Please say whether to verify this user.');
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { isVerified } });
  if (!user) throw new HttpError(404, 'User not found.');
  if (isVerified) {
    await notify({ userId: user._id, type: 'verified', text: 'You are now a verified creator!', link: `/creator/${user.username}` });
  }
  res.status(200).json({ message: isVerified ? 'Creator verified.' : 'Verification removed.', isVerified });
});

module.exports = {
  createReport,
  getStats,
  listReports,
  resolveReport,
  updateWallpaperStatus,
  listUsers,
  setUserStatus,
  setUserRole,
  setUserVerified
};
