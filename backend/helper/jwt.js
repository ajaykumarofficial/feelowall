const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Sign a login token.
 * @param {object} payload
 * @returns {string}
 */
const signToken = (payload) => {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });
};

/**
 * Verify a login token. Purpose tokens (OAuth state, 2FA challenges, download
 * links) are rejected, so they can never be used to authenticate as a user.
 * @param {string} token
 * @returns {object}
 */
const verifyToken = (token) => {
  const payload = jwt.verify(token, config.JWT_SECRET);
  if (payload.purpose) throw new Error('Not a login token.');
  return payload;
};

/** Short-lived token that is only valid for one named purpose. */
const signPurposeToken = (payload, purpose, expiresIn) => {
  return jwt.sign({ ...payload, purpose }, config.JWT_SECRET, { expiresIn });
};

const verifyPurposeToken = (token, purpose) => {
  const payload = jwt.verify(String(token), config.JWT_SECRET);
  if (payload.purpose !== purpose) throw new Error('Wrong token purpose.');
  return payload;
};

/** The login token for a user document. */
const signUserToken = (user) => signToken({
  id: user.id,
  username: user.username,
  tv: user.tokenVersion || 0
});

module.exports = {
  signToken,
  verifyToken,
  signPurposeToken,
  verifyPurposeToken,
  signUserToken
};
