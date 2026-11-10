/** Who can see what. Records created before `status` existed have none, and count as published. */

const PUBLIC_STATUSES = ['published', null];

const publicFilter = () => ({ status: { $in: PUBLIC_STATUSES } });

const isPublic = (wallpaper) => !wallpaper.status || wallpaper.status === 'published';

const isStaff = (user) => !!user && (user.role === 'admin' || user.role === 'moderator');

const isOwner = (wallpaper, user) => !!user && String(wallpaper.uploadedById) === String(user.id);

/** Removed wallpapers stay hidden from owners too; only staff can still open them. */
const canView = (wallpaper, user) => {
  if (isPublic(wallpaper) || isStaff(user)) return true;
  return isOwner(wallpaper, user) && wallpaper.status !== 'removed';
};

module.exports = { publicFilter, isPublic, isStaff, isOwner, canView };
