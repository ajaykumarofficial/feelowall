const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  wallpaperId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallpaper', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  authorName: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  status: { type: String, enum: ['visible', 'hidden', 'deleted'], default: 'visible' },
  createdAt: { type: Date, default: Date.now }
});

CommentSchema.index({ wallpaperId: 1, createdAt: 1 });

module.exports = CommentSchema;
