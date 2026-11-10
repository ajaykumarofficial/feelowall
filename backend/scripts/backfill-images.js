#!/usr/bin/env node
/**
 * Fill in dimensions and the duplicate-detection hash for wallpapers uploaded
 * before those fields existed, so they show up in resolution and orientation
 * filters. Safe to run repeatedly: it only touches records missing these values.
 * It doesn't modify image files or flag older images as duplicates.
 *
 *   npm run backfill:images
 */
const fs = require('fs');
const sharp = require('sharp');
const { Wallpaper, closeDb, mongoose } = require('../databaseModels');
const { computeDHash, describeDimensions } = require('../helper/perceptualHash');
const { localPathFor, isFetchableRemote } = require('../helper/media');

const loadImage = async (url) => {
  const local = localPathFor(url);
  if (local) return fs.existsSync(local) ? fs.promises.readFile(local) : null;
  if (!isFetchableRemote(url)) return null;
  const response = await fetch(url, { redirect: 'error' });
  return response.ok ? Buffer.from(await response.arrayBuffer()) : null;
};

const run = async () => {
  await mongoose.connection.asPromise();
  const missing = await Wallpaper.find({ $or: [{ width: null }, { perceptualHash: null }] }).select('imageUrl title').lean();
  console.log(`${missing.length} wallpapers to process in "${mongoose.connection.name}".`);

  let updated = 0;
  let skipped = 0;
  for (const wallpaper of missing) {
    try {
      const image = await loadImage(wallpaper.imageUrl);
      if (!image) {
        skipped += 1;
        console.warn(`Skipped "${wallpaper.title}": image unavailable.`);
        continue;
      }
      const { width, height } = await sharp(image).metadata();
      await Wallpaper.updateOne({ _id: wallpaper._id }, {
        $set: { ...describeDimensions(width, height), perceptualHash: await computeDHash(image) }
      });
      updated += 1;
    } catch (err) {
      skipped += 1;
      console.warn(`Skipped "${wallpaper.title}": ${err.message}`);
    }
  }
  console.log(`Done. Updated ${updated}, skipped ${skipped}.`);
};

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
