const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');

/**
 * Image storage on Amazon S3. When the bucket isn't configured, callers fall
 * back to the local /uploads folder.
 *
 * Objects are read through their public URL
 * (https://<bucket>.s3.<region>.amazonaws.com/<key>), so the bucket needs a
 * policy that allows public s3:GetObject on the key prefix.
 */

const isConfigured = () => Boolean(
  config.AWS_S3_BUCKET &&
  config.AWS_REGION &&
  config.AWS_ACCESS_KEY_ID &&
  config.AWS_SECRET_ACCESS_KEY
);

let client = null;
const getClient = () => {
  if (!client) {
    client = new S3Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY
      }
    });
  }
  return client;
};

/** Base URL that object keys are appended to, without a trailing slash. */
const publicBaseUrl = () => (
  config.S3_PUBLIC_URL || `https://${config.AWS_S3_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com`
).replace(/\/$/, '');

const publicUrlFor = (key) => `${publicBaseUrl()}/${key.split('/').map(encodeURIComponent).join('/')}`;

/** The object key for a URL in this bucket, or null if the URL is somewhere else. */
const keyFromUrl = (url) => {
  if (!isConfigured() || typeof url !== 'string') return null;
  const base = `${publicBaseUrl()}/`;
  if (!url.startsWith(base)) return null;
  try {
    return decodeURIComponent(url.slice(base.length).split('?')[0]);
  } catch {
    return null;
  }
};

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

const contentTypeFor = (filePath, fallback) => (
  fallback || CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
);

/**
 * Upload a local file and return { url, key }.
 * @param {string} localPath  file on disk
 * @param {object} [options]  { contentType, folder }
 */
const uploadFile = async (localPath, { contentType, folder = 'wallpapers' } = {}) => {
  if (!isConfigured()) throw new Error('S3 storage is not configured.');

  const ext = path.extname(localPath).toLowerCase() || '';
  const prefix = (config.S3_KEY_PREFIX || 'feelowall').replace(/^\/|\/$/g, '');
  const key = `${prefix}/${folder}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

  await getClient().send(new PutObjectCommand({
    Bucket: config.AWS_S3_BUCKET,
    Key: key,
    Body: fs.createReadStream(localPath),
    ContentLength: fs.statSync(localPath).size,
    ContentType: contentTypeFor(localPath, contentType),
    // Keys are unique per upload, so the file at a URL never changes.
    CacheControl: 'public, max-age=31536000, immutable'
  }));

  return { url: publicUrlFor(key), key };
};

/** Delete an object by key. Deleting a key that doesn't exist is not an error. */
const deleteFile = async (key) => {
  if (!isConfigured()) throw new Error('S3 storage is not configured.');
  if (!key) return;
  await getClient().send(new DeleteObjectCommand({ Bucket: config.AWS_S3_BUCKET, Key: key }));
};

/** Upload, then remove the local temp file whether or not the upload worked. */
const uploadAndRemoveLocal = async (localPath, options) => {
  try {
    return await uploadFile(localPath, options);
  } finally {
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  }
};

module.exports = {
  isConfigured,
  uploadFile,
  uploadAndRemoveLocal,
  deleteFile,
  publicBaseUrl,
  publicUrlFor,
  keyFromUrl
};
