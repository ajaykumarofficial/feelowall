const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Sign a payload to generate a JWT token.
 * @param {object} payload 
 * @returns {string}
 */
const signToken = (payload) => {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });
};

/**
 * Verify a JWT token.
 * @param {string} token 
 * @returns {object}
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET);
};

module.exports = {
  signToken,
  verifyToken
};
