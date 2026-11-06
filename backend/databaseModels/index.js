const mongoose = require('mongoose');
const config = require('../config');
const UserSchema = require('./User/schema');
const WallpaperSchema = require('./Wallpaper/schema');
const PlaylistSchema = require('./Playlist/schema');
const DailyAnalyticsSchema = require('./DailyAnalytics/schema');

let MONGODB_URI = config.MONGODB_URI;

if (process.env.NODE_ENV === 'test') {
  if (process.env.MONGODB_URI_TEST) {
    MONGODB_URI = process.env.MONGODB_URI_TEST;
  } else if (MONGODB_URI) {
    // Safely append '_test' to the database name inside the connection string
    // e.g. mongodb://host:port/dbname?query -> mongodb://host:port/dbname_test?query
    const match = MONGODB_URI.match(/^([^?]+)\/([^?]+)(\?.*)?$/);
    if (match) {
      const [_, base, dbName, query] = match;
      MONGODB_URI = `${base}/${dbName}_test${query || ''}`;
    } else {
      MONGODB_URI = MONGODB_URI + '_test';
    }
  }
}

// Connect to MongoDB
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB.'))
    .catch(err => console.error('Error connecting to MongoDB:', err));
} else {
  // For testing, connect if not already connected
  if (mongoose.connection.readyState === 0) {
    mongoose.connect(MONGODB_URI)
      .catch(err => console.error('Test DB connection error:', err));
  }
}

const User = mongoose.model('User', UserSchema);
const Wallpaper = mongoose.model('Wallpaper', WallpaperSchema);
const Playlist = mongoose.model('Playlist', PlaylistSchema);
const DailyAnalytics = mongoose.model('DailyAnalytics', DailyAnalyticsSchema);

async function clearDb() {
  await User.deleteMany({});
  await Wallpaper.deleteMany({});
  await Playlist.deleteMany({});
  await DailyAnalytics.deleteMany({});
}

async function closeDb() {
  await mongoose.connection.close();
}

module.exports = {
  User,
  Wallpaper,
  Playlist,
  DailyAnalytics,
  clearDb,
  closeDb,
  mongoose
};
