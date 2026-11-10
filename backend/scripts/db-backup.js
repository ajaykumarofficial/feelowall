#!/usr/bin/env node
/**
 * Write every collection to a timestamped folder as Extended JSON, which keeps
 * ObjectIds and dates intact. Reads only; never changes the database.
 *
 *   npm run db:backup -- [output-folder]
 *
 * Uploaded image files are not included: Cloudinary or the uploads folder holds those.
 * See docs/backup-restore.md.
 */
const fs = require('fs');
const path = require('path');
const { ALL_MODELS, closeDb, mongoose } = require('../databaseModels');

const { EJSON } = mongoose.mongo.BSON;

const backup = async (outputRoot) => {
  await mongoose.connection.asPromise();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folder = path.join(outputRoot, `${mongoose.connection.name}-${stamp}`);
  fs.mkdirSync(folder, { recursive: true });

  const summary = {};
  for (const Model of ALL_MODELS) {
    const name = Model.collection.collectionName;
    const output = fs.createWriteStream(path.join(folder, `${name}.jsonl`));
    let count = 0;
    for await (const doc of Model.collection.find({})) {
      if (!output.write(`${EJSON.stringify(doc, { relaxed: false })}\n`)) {
        await new Promise((resolve) => output.once('drain', resolve));
      }
      count += 1;
    }
    await new Promise((resolve, reject) => output.end((err) => (err ? reject(err) : resolve())));
    summary[name] = count;
  }

  const manifest = { database: mongoose.connection.name, createdAt: new Date().toISOString(), collections: summary };
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { folder, manifest };
};

if (require.main === module) {
  const outputRoot = process.argv[2] || path.join(__dirname, '..', 'backups');
  backup(outputRoot)
    .then(({ folder, manifest }) => {
      console.log(`Backup written to ${folder}`);
      console.table(manifest.collections);
    })
    .catch((err) => {
      console.error(`Backup failed: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => closeDb());
}

module.exports = { backup };
