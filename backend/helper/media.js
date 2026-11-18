const path = require('path');
const config = require('../config');
const storage = require('./storage');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

/**
 * Accepts only images this app stored itself: local /uploads paths, or URLs in
 * this project's S3 bucket. The worker downloads remote images from the
 * server, so an open URL field would let users reach internal addresses.
 */
const isAllowedMediaUrl = (url) => {
  if (typeof url !== 'string' || !url) return false;
  if (url.startsWith('/uploads/')) {
    const name = url.slice('/uploads/'.length);
    return !!name && path.basename(name) === name && !name.includes('..');
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.search || parsed.hash) return false;
    const key = storage.keyFromUrl(url);
    return !!key && !key.split('/').includes('..');
  } catch {
    return false;
  }
};

/**
 * Filenames are later joined to the uploads folder and deleted, so a local
 * filename must not contain a path. S3 object keys may contain "/".
 */
const isSafeFilename = (filename, imageUrl) => {
  if (typeof filename !== 'string' || !filename || filename.includes('..')) return false;
  if (String(imageUrl).startsWith('/uploads/')) {
    return path.basename(filename) === filename && !filename.includes('\\');
  }
  return !filename.includes('\\');
};

/** Absolute path for a stored /uploads URL, or null if it isn't one. */
const localPathFor = (url) => {
  if (!isAllowedMediaUrl(url) || !url.startsWith('/uploads/')) return null;
  return path.join(UPLOADS_DIR, url.slice('/uploads/'.length));
};

/** Hosts the server may fetch from when building ZIP downloads. */
const isFetchableRemote = (url) => {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:') return false;
    // res.cloudinary.com: wallpapers uploaded before the move to S3 still live there.
    if (hostname === 'images.unsplash.com' || hostname === 'res.cloudinary.com') return true;
    return !!storage.keyFromUrl(url);
  } catch {
    return false;
  }
};

const absoluteMediaUrl = (url) => (String(url || '').startsWith('/uploads') ? `${config.API_PUBLIC_URL}${url}` : url);

module.exports = { UPLOADS_DIR, isAllowedMediaUrl, isSafeFilename, localPathFor, isFetchableRemote, absoluteMediaUrl };
