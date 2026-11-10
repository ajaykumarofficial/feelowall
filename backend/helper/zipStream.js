const fs = require('fs');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');
const archiver = require('archiver');
const { localPathFor, isFetchableRemote } = require('./media');
const { reportError } = require('./logger');

const MAX_FILES = 100;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024; // 1 GB

const safeName = (title, fallback) => (String(title || fallback).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || fallback);

const extensionFor = (wallpaper) => {
  const match = /\.(jpe?g|png|webp|gif)$/i.exec(String(wallpaper.filename || '')) || /\.(jpe?g|png|webp|gif)(\?|$)/i.exec(String(wallpaper.imageUrl || ''));
  return match ? match[1].toLowerCase() : 'jpg';
};

const openImage = async (url) => {
  const localPath = localPathFor(url);
  if (localPath) return fs.existsSync(localPath) ? fs.createReadStream(localPath) : null;
  if (!isFetchableRemote(url)) return null;
  const response = await fetch(url, { redirect: 'error' });
  if (!response.ok || !response.body) return null;
  return Readable.fromWeb(response.body);
};

/**
 * Stream wallpapers to the client as a ZIP. Images are already compressed, so
 * they're stored as they are, using little CPU and no temporary disk space.
 * Files that can't be read are skipped and listed in a text file in the archive.
 */
const streamWallpapersZip = async (res, wallpapers, archiveName) => {
  const items = wallpapers.slice(0, MAX_FILES);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(archiveName, 'feelowall')}.zip"`);
  res.setHeader('Cache-Control', 'private, no-store');

  const archive = archiver('zip', { store: true });
  archive.on('warning', (err) => reportError(err, { source: 'zip' }));
  const finished = pipeline(archive, res).catch((err) => {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') reportError(err, { source: 'zip' });
  });

  const usedNames = new Set();
  const skipped = wallpapers.slice(MAX_FILES).map((wallpaper) => `${wallpaper.title}: over the ${MAX_FILES}-file limit`);
  let totalBytes = 0;

  for (const [index, wallpaper] of items.entries()) {
    if (totalBytes >= MAX_TOTAL_BYTES) {
      skipped.push(`${wallpaper.title}: over the download size limit`);
      continue;
    }
    try {
      const source = await openImage(wallpaper.imageUrl);
      if (!source) {
        skipped.push(`${wallpaper.title}: file unavailable`);
        continue;
      }
      const base = safeName(wallpaper.title, `wallpaper-${index + 1}`);
      let name = `${base}.${extensionFor(wallpaper)}`;
      if (usedNames.has(name)) name = `${base}-${index + 1}.${extensionFor(wallpaper)}`;
      usedNames.add(name);

      // Wait for each entry so only one remote image is open at a time.
      await new Promise((resolve, reject) => {
        const meter = new Transform({
          transform(chunk, _encoding, done) {
            totalBytes += chunk.length;
            done(totalBytes > MAX_TOTAL_BYTES * 2 ? new Error('Download too large.') : null, chunk);
          }
        });
        source.on('error', reject);
        meter.on('error', reject);
        const onEntry = (entry) => {
          if (entry.name === name) {
            archive.off('entry', onEntry);
            resolve();
          }
        };
        archive.on('entry', onEntry);
        archive.append(source.pipe(meter), { name });
      });
    } catch (err) {
      reportError(err, { source: 'zip' });
      skipped.push(`${wallpaper.title}: download failed`);
    }
  }

  if (skipped.length) archive.append(`Not included in this download:\n${skipped.join('\n')}\n`, { name: 'NOT-INCLUDED.txt' });
  await archive.finalize();
  await finished;
  return { included: usedNames.size, skipped: skipped.length };
};

module.exports = { streamWallpapersZip, MAX_FILES, MAX_TOTAL_BYTES };
