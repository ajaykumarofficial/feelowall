# Database Backup & Restore

There are two layers of protection. Use both.

## 1. Atlas scheduled backups (turn this on)

This has to be enabled in the MongoDB Atlas dashboard; it can't be done from this repo.

1. Open your cluster in Atlas and go to **Backup**.
2. Turn on **Cloud Backup** and choose a retention period. It isn't available on the free M0 tier, so use step 2 below on a schedule if you're on M0.
3. To restore, use **Restore** on a snapshot, and restore into a *new* cluster first so you can check it.

## 2. Manual backups with the scripts

Reads only, and writes one file per collection plus a manifest with counts:

```bash
cd backend
npm run db:backup -- ../../feelowall-backups
```

Keep backups outside the repo, because they contain user data. `backend/backups/` is gitignored as a safety net.

**Not included:** image files. Cloudinary holds them, or `backend/uploads/` for local storage, so back that folder up separately if you use it.

## Restoring

Restore only writes to an empty database, so it can't overwrite live data by accident. Point `MONGODB_URI` at a new database name first:

```bash
cd backend
MONGODB_URI="mongodb+srv://.../feelowall_restored" npm run db:restore -- <backup-folder>
```

It compares the restored counts with the backup's manifest and fails if they differ. Once you've checked the result, point the app at the restored database.

Indexes are rebuilt automatically the next time the app starts.

## Test a restore

An untested backup isn't a backup. Do this once now, then again every few months:

1. Run a backup.
2. Restore it into a throwaway database.
3. Start the app against that database and check that accounts and wallpapers look right.
4. Delete the throwaway database.
