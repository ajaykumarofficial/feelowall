const mongoose = require('mongoose');
const config = require('../config');
const UserSchema = require('./User/schema');
const WallpaperSchema = require('./Wallpaper/schema');
const PlaylistSchema = require('./Playlist/schema');
const DailyAnalyticsSchema = require('./DailyAnalytics/schema');
const ReportSchema = require('./Report/schema');
const CommentSchema = require('./Comment/schema');
const NotificationSchema = require('./Notification/schema');
const ChallengeSchema = require('./Challenge/schema');
const ChallengeSubmissionSchema = require('./ChallengeSubmission/schema');
const ChallengeVoteSchema = require('./ChallengeVote/schema');
const SavedSearchSchema = require('./SavedSearch/schema');
const AuthTokenSchema = require('./AuthToken/schema');
const PaymentSchema = require('./Payment/schema');
const PackSchema = require('./Pack/schema');
const ApiKeySchema = require('./ApiKey/schema');
const DownloadHistorySchema = require('./DownloadHistory/schema');

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
const Report = mongoose.model('Report', ReportSchema);
const Comment = mongoose.model('Comment', CommentSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const Challenge = mongoose.model('Challenge', ChallengeSchema);
const ChallengeSubmission = mongoose.model('ChallengeSubmission', ChallengeSubmissionSchema);
const ChallengeVote = mongoose.model('ChallengeVote', ChallengeVoteSchema);
const SavedSearch = mongoose.model('SavedSearch', SavedSearchSchema);
const AuthToken = mongoose.model('AuthToken', AuthTokenSchema);
const Payment = mongoose.model('Payment', PaymentSchema);
const Pack = mongoose.model('Pack', PackSchema);
const ApiKey = mongoose.model('ApiKey', ApiKeySchema);
const DownloadHistory = mongoose.model('DownloadHistory', DownloadHistorySchema);

const ALL_MODELS = [
  User, Wallpaper, Playlist, DailyAnalytics, Report, Comment, Notification, Challenge,
  ChallengeSubmission, ChallengeVote, SavedSearch, AuthToken, Payment, Pack, ApiKey, DownloadHistory
];

const isTestDatabaseName = (name) => /_test$/i.test(name || '');

/**
 * Delete every document in every collection.
 * Refuses to run unless the connected database name ends in "_test". The only
 * override is { allowNonTest: true }, used by `npm run seed --force` after it
 * has asked the operator to confirm the database name.
 */
async function clearDb({ allowNonTest = false } = {}) {
  await mongoose.connection.asPromise();
  const dbName = mongoose.connection.name;
  if (!isTestDatabaseName(dbName) && !allowNonTest) {
    throw new Error(`clearDb refused: "${dbName}" is not a test database (name must end in "_test").`);
  }
  await Promise.all(ALL_MODELS.map((Model) => Model.deleteMany({})));
}

async function closeDb() {
  await mongoose.connection.close();
}

module.exports = {
  User,
  Wallpaper,
  Playlist,
  DailyAnalytics,
  Report,
  Comment,
  Notification,
  Challenge,
  ChallengeSubmission,
  ChallengeVote,
  SavedSearch,
  AuthToken,
  Payment,
  Pack,
  ApiKey,
  DownloadHistory,
  ALL_MODELS,
  isTestDatabaseName,
  clearDb,
  closeDb,
  mongoose
};
