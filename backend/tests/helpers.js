const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const db = require('../databaseModels');
const { signUserToken } = require('../helper/jwt');
const { UPLOADS_DIR } = require('../helper/media');

let counter = 0;
const createdFiles = [];

/** Create an account directly and return it with a login token. */
const createUser = async (name, fields = {}) => {
  const user = await db.User.create({
    username: name || `user${(counter += 1)}`,
    passwordHash: 'not-a-real-hash',
    ...fields
  });
  return { user, id: user.id, username: user.username, token: signUserToken(user), auth: `Bearer ${signUserToken(user)}` };
};

/** Staff need two-factor on before they can use staff tools. */
const createStaff = (name, role = 'admin') => createUser(name, {
  role,
  twoFactor: { enabled: true, secret: 'x', recoveryCodes: [], lastUsedStep: 0 }
});

const createWallpaper = (owner, fields = {}) => db.Wallpaper.create({
  title: `Wallpaper ${(counter += 1)}`,
  category: 'Nature',
  imageUrl: '/uploads/test.jpg',
  filename: 'test.jpg',
  uploadedBy: owner.username,
  uploadedById: owner.id,
  ...fields
});

/**
 * Write a real image into the uploads folder for tests that read files.
 * `seed` changes the pattern, so that different seeds aren't duplicates of each other.
 */
const createImageFile = async (name, { width = 320, height = 180, seed = 1, format = 'jpeg' } = {}) => {
  const channels = 3;
  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const value = Math.floor(127 + 127 * Math.sin((x / width) * seed * 6) * Math.cos((y / height) * (seed + 2) * 6));
      pixels[offset] = value;
      pixels[offset + 1] = 255 - value;
      pixels[offset + 2] = (value * seed) % 256;
    }
  }
  const filePath = path.join(UPLOADS_DIR, name);
  await sharp(pixels, { raw: { width, height, channels } }).toFormat(format).toFile(filePath);
  createdFiles.push(filePath);
  return { filePath, url: `/uploads/${name}`, filename: name };
};

const trackFile = (filePath) => createdFiles.push(filePath);

const cleanupFiles = () => {
  while (createdFiles.length) {
    const file = createdFiles.pop();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
};

/** supertest parser that keeps a binary response as a Buffer. */
const binaryParser = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

module.exports = { db, createUser, createStaff, createWallpaper, createImageFile, trackFile, cleanupFiles, binaryParser, daysFromNow };
