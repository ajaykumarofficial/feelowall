/**
 * Validator middleware for Wallpapers Module
 */

const validateUpload = (req, res, next) => {
  const { title, category, imageUrl, filename } = req.body;

  if (!title || !category || !imageUrl || !filename) {
    return res.status(400).json({ message: 'Title, category, imageUrl, and filename are required.' });
  }

  next();
};

const validateUpdate = (req, res, next) => {
  const { title, category } = req.body;

  if (!title || !category) {
    return res.status(400).json({ message: 'Title and category are required.' });
  }

  next();
};

module.exports = {
  validateUpload,
  validateUpdate
};
