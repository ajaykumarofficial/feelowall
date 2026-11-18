const fs = require('fs');
const storage = require('../../../helper/storage');

/**
 * Handle file upload: to S3 when configured, otherwise keep it on local disk.
 */
const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    if (storage.isConfigured() && process.env.NODE_ENV !== 'test') {
      try {
        const result = await storage.uploadAndRemoveLocal(file.path, { contentType: file.mimetype });
        return res.status(200).json({
          message: 'File uploaded successfully.',
          url: result.url,
          publicId: result.key
        });
      } catch (uploadErr) {
        console.error('S3 upload failed:', uploadErr);
        return res.status(500).json({ message: 'Upload to storage failed. Please try again.' });
      }
    }

    // Local fallback: multer already saved the file to disk
    return res.status(200).json({
      message: 'File uploaded successfully.',
      url: `/uploads/${file.filename}`,
      publicId: file.filename
    });
  } catch (error) {
    res.status(500).json({ message: 'Upload controller error.', error: error.message });
  }
};

module.exports = {
  uploadFile
};
