#!/usr/bin/env node
/**
 * Load a backup into the database MONGODB_URI points at. It only ever writes to
 * an empty database, so it can't overwrite live data by accident.
 *
 *   npm run db:restore -- <backup-folder>
 *
 * See docs/backup-restore.md.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ALL_MODELS, closeDb, mongoose } = require('../databaseModels');

const { EJSON } = mongoose.mongo.BSON;
const BATCH_SIZE = 500;

const restore = async (folder) => {
  await mongoose.connection.asPromise();
  const manifestPath = path.join(folder, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`${folder} has no manifest.json, so it isn't a backup folder.`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  for (const Model of ALL_MODELS) {
    const existing = await Model.collection.countDocuments();
    if (existing > 0) {
      throw new Error(`"${mongoose.connection.name}" isn't empty (${Model.collection.collectionName} has ${existing} documents). Restore into an empty database.`);
    }
  }

  const restored = {};
  for (const Model of ALL_MODELS) {
    const name = Model.collection.collectionName;
    const file = path.join(folder, `${name}.jsonl`);
    restored[name] = 0;
    if (!fs.existsSync(file)) continue;

    let batch = [];
    const lines = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      batch.push(EJSON.parse(line, { relaxed: false }));
      if (batch.length >= BATCH_SIZE) {
        await Model.collection.insertMany(batch);
        restored[name] += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await Model.collection.insertMany(batch);
      restored[name] += batch.length;
    }
  }

  // A backup only counts as restored if every count matches what was written.
  for (const [name, expected] of Object.entries(manifest.collections)) {
    if ((restored[name] || 0) !== expected) throw new Error(`${name}: expected ${expected} documents but restored ${restored[name] || 0}.`);
  }
  return restored;
};

if (require.main === module) {
  const folder = process.argv[2];
  if (!folder) {
    console.error('Usage: npm run db:restore -- <backup-folder>');
    process.exitCode = 1;
    closeDb();
  } else {
    restore(path.resolve(folder))
      .then((restored) => {
        console.log(`Restored into "${mongoose.connection.name}". All counts match the backup.`);
        console.table(restored);
      })
      .catch((err) => {
        console.error(`Restore failed: ${err.message}`);
        process.exitCode = 1;
      })
      .finally(() => closeDb());
  }
}

module.exports = { restore };
