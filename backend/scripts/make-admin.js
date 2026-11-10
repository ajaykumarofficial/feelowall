#!/usr/bin/env node
/**
 * Give an existing account a staff role. This is how the first admin is created,
 * since the API only lets existing admins change roles.
 *
 *   npm run make-admin -- <username> [admin|moderator|user]
 *
 * Staff must then turn on two-factor authentication in Account Settings.
 */
const { User, closeDb, mongoose } = require('../databaseModels');
const { exactCI } = require('../helper/text');

const run = async () => {
  const [username, role = 'admin'] = process.argv.slice(2);
  if (!username || !['admin', 'moderator', 'user'].includes(role)) {
    console.error('Usage: npm run make-admin -- <username> [admin|moderator|user]');
    process.exitCode = 1;
    return;
  }
  await mongoose.connection.asPromise();
  const user = await User.findOneAndUpdate({ username: exactCI(username) }, { $set: { role } }, { new: true });
  if (!user) {
    console.error(`No user named "${username}" in the "${mongoose.connection.name}" database.`);
    process.exitCode = 1;
    return;
  }
  console.log(`${user.username} is now: ${user.role} (database "${mongoose.connection.name}").`);
  if (role !== 'user') console.log('They must turn on two-factor authentication in Account Settings before using staff tools.');
};

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
