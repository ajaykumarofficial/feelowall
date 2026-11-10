const crypto = require('crypto');
const { AuthToken } = require('../databaseModels');

const LIFETIME_MS = {
  'verify-email': 24 * 60 * 60 * 1000,
  'reset-password': 60 * 60 * 1000
};

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

/** Create a token and return its plain value. Any earlier token of this type stops working. */
const issueAccountToken = async (userId, type, email = '') => {
  await AuthToken.deleteMany({ userId, type });
  const token = crypto.randomBytes(32).toString('hex');
  await AuthToken.create({
    userId,
    type,
    email,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + LIFETIME_MS[type])
  });
  return token;
};

/** Atomically use a token, so two simultaneous requests can't both succeed. Returns null if invalid. */
const consumeAccountToken = (token, type) => {
  if (typeof token !== 'string' || !token) return null;
  return AuthToken.findOneAndDelete({
    tokenHash: hashToken(token),
    type,
    expiresAt: { $gt: new Date() }
  });
};

module.exports = { issueAccountToken, consumeAccountToken, hashToken };
