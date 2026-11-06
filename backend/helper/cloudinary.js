const cloudinary = require('cloudinary').v2;
const config = require('../config');

const isConfigured = () => {
  return (
    config.CLOUDINARY_CLOUD_NAME &&
    config.CLOUDINARY_API_KEY &&
    config.CLOUDINARY_API_SECRET &&
    config.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
    config.CLOUDINARY_API_KEY !== 'your_api_key' &&
    config.CLOUDINARY_API_SECRET !== 'your_api_secret'
  );
};

if (isConfigured()) {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET
  });
}

/**
 * Upload local file to Cloudinary
 * @param {string} localPath - Absolute path of file on local disk
 * @returns {Promise<object>} Upload result
 */
const uploadToCloudinary = async (localPath) => {
  if (!isConfigured()) {
    throw new Error('Cloudinary is not configured.');
  }
  const result = await cloudinary.uploader.upload(localPath, {
    folder: 'feelowall_wallpapers',
    resource_type: 'auto'
  });
  return result;
};

/**
 * Delete asset from Cloudinary
 * @param {string} publicId - Cloudinary public id of asset
 * @returns {Promise<object>} Delete result
 */
const deleteFromCloudinary = async (publicId) => {
  if (!isConfigured()) {
    throw new Error('Cloudinary is not configured.');
  }
  const result = await cloudinary.uploader.destroy(publicId);
  return result;
};

module.exports = {
  isConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  cloudinaryInstance: cloudinary
};
