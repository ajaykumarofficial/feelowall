const fs = require('fs');
const cloudinary = require('../../../helper/cloudinary');

/**
 * Handle file upload, uploading to Cloudinary if configured, or fallback to local disk
 */
const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    if (cloudinary.isConfigured() && process.env.NODE_ENV !== 'test') {
      try {
        const result = await cloudinary.uploadToCloudinary(file.path);
        // Clean up temporary local file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(200).json({
          message: 'File uploaded to Cloudinary successfully.',
          url: result.secure_url,
          publicId: result.public_id
        });
      } catch (cloudErr) {
        // Clean up temporary local file on failure
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(500).json({
          message: 'Cloudinary upload failed.',
          error: cloudErr.message
        });
      }
    } else {
      // Local fallback: file was already saved to disk by multer
      const url = `/uploads/${file.filename}`;
      return res.status(200).json({
        message: 'File uploaded locally successfully (Cloudinary fallback).',
        url,
        publicId: file.filename
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Upload controller error.', error: error.message });
  }
};

module.exports = {
  uploadFile
};
