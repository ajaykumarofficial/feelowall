const { isAllowedMediaUrl, isSafeFilename } = require('../../../helper/media');
const { isHttpUrl } = require('../../../helper/text');

/**
 * Validator middleware for Wallpapers Module
 */

const LICENSES = ['personal-use', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc0', 'all-rights-reserved'];

const checkAttribution = ({ license, sourceUrl }) => {
  if (license !== undefined && !LICENSES.includes(license)) return 'Please choose a valid license.';
  if (sourceUrl && !isHttpUrl(sourceUrl)) return 'The source link must start with http:// or https://.';
  return null;
};

const validateUpload = (req, res, next) => {
  const { title, category, imageUrl, filename, videoUrl, status, scheduledAt } = req.body;

  if (!title || !category || !imageUrl || !filename) {
    return res.status(400).json({ message: 'Title, category, imageUrl, and filename are required.' });
  }

  if (typeof title !== 'string' || typeof category !== 'string') {
    return res.status(400).json({ message: 'Title and category must be text.' });
  }

  // Only accept files this app stored: the worker later downloads and deletes based on these.
  if (!isAllowedMediaUrl(imageUrl) || !isSafeFilename(filename, imageUrl)) {
    return res.status(400).json({ message: 'The image must be uploaded through FeeloWall.' });
  }
  if (videoUrl && !isAllowedMediaUrl(videoUrl)) {
    return res.status(400).json({ message: 'The video must be uploaded through FeeloWall.' });
  }

  const attributionError = checkAttribution(req.body);
  if (attributionError) return res.status(400).json({ message: attributionError });

  if (status !== undefined && !['draft', 'scheduled', 'published'].includes(status)) {
    return res.status(400).json({ message: 'Status must be draft, scheduled, or published.' });
  }
  if (status === 'scheduled') {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      return res.status(400).json({ message: 'Choose a publish time in the future.' });
    }
  }

  next();
};

const validateUpdate = (req, res, next) => {
  const { title, category } = req.body;

  if (!title || !category || typeof title !== 'string' || typeof category !== 'string') {
    return res.status(400).json({ message: 'Title and category are required.' });
  }

  const attributionError = checkAttribution(req.body);
  if (attributionError) return res.status(400).json({ message: attributionError });

  next();
};

module.exports = {
  validateUpload,
  validateUpdate,
  LICENSES
};
