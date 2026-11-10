const { Comment, Wallpaper } = require('../../../databaseModels');
const { canView, isStaff } = require('../../../helper/visibility');
const { asString } = require('../../../helper/text');
const { notify } = require('../../../helper/notifications');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');

const MAX_COMMENT_LENGTH = 1000;

const toView = (comment) => ({
  id: String(comment._id),
  parentId: comment.parentId ? String(comment.parentId) : null,
  authorId: comment.status === 'visible' && comment.authorId ? String(comment.authorId) : null,
  authorName: comment.status === 'visible' ? comment.authorName : '',
  text: comment.status === 'visible' ? comment.text : '',
  removed: comment.status !== 'visible',
  createdAt: comment.createdAt
});

const loadWallpaper = async (id, user) => {
  const wallpaper = await Wallpaper.findById(id).select('title status uploadedById').lean();
  if (!wallpaper || !canView(wallpaper, user)) throw new HttpError(404, 'Wallpaper not found.');
  return wallpaper;
};

/** Comments as one level of threads. A removed comment stays as a placeholder only if it has replies. */
const listComments = asyncHandler(async (req, res) => {
  await loadWallpaper(req.params.id, req.user);
  const rows = await Comment.find({ wallpaperId: req.params.id }).sort({ createdAt: 1 }).limit(1000).lean();

  const threads = new Map();
  for (const row of rows.filter((comment) => !comment.parentId)) {
    threads.set(String(row._id), { ...toView(row), replies: [] });
  }
  for (const row of rows.filter((comment) => comment.parentId && comment.status === 'visible')) {
    threads.get(String(row.parentId))?.replies.push(toView(row));
  }

  const comments = [...threads.values()].filter((thread) => !thread.removed || thread.replies.length);
  res.status(200).json({ comments, total: rows.filter((comment) => comment.status === 'visible').length });
});

const createComment = asyncHandler(async (req, res) => {
  const wallpaper = await loadWallpaper(req.params.id, req.user);

  const text = asString(req.body.text);
  if (!text) throw new HttpError(400, 'Please write a comment first.');
  if (text.length > MAX_COMMENT_LENGTH) throw new HttpError(400, `Comments can be up to ${MAX_COMMENT_LENGTH} characters.`);

  let parent = null;
  if (req.body.parentId) {
    parent = await Comment.findOne({ _id: req.body.parentId, wallpaperId: req.params.id, status: 'visible' });
    if (!parent) throw new HttpError(404, 'The comment you are replying to no longer exists.');
    // Replying to a reply stays in the same thread, keeping threads one level deep.
  }

  const comment = await Comment.create({
    wallpaperId: req.params.id,
    authorId: req.user.id,
    authorName: req.user.username,
    text,
    parentId: parent ? (parent.parentId || parent._id) : null
  });

  const link = `/wallpaper/${req.params.id}#comment-${comment._id}`;
  await notify({
    userId: wallpaper.uploadedById,
    type: 'comment',
    actorId: req.user.id,
    actorName: req.user.username,
    text: `commented on "${wallpaper.title}"`,
    link,
    groupKey: `comment:${req.params.id}`
  });
  if (parent && parent.authorId && String(parent.authorId) !== String(wallpaper.uploadedById)) {
    await notify({
      userId: parent.authorId,
      type: 'reply',
      actorId: req.user.id,
      actorName: req.user.username,
      text: `replied to your comment on "${wallpaper.title}"`,
      link,
      groupKey: `reply:${parent._id}`
    });
  }

  res.status(201).json({ message: 'Comment posted.', comment: { ...toView(comment), replies: [] } });
});

/** The comment's author, the wallpaper's owner, or staff may delete a comment. */
const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment || comment.status === 'deleted') throw new HttpError(404, 'Comment not found.');

  const wallpaper = await Wallpaper.findById(comment.wallpaperId).select('uploadedById').lean();
  const allowed = String(comment.authorId) === req.user.id
    || (wallpaper && String(wallpaper.uploadedById) === req.user.id)
    || isStaff(req.user);
  if (!allowed) throw new HttpError(403, 'You can\'t delete this comment.');

  comment.status = 'deleted';
  comment.text = '[deleted]';
  await comment.save();
  res.status(200).json({ message: 'Comment deleted.' });
});

module.exports = { listComments, createComment, deleteComment };
