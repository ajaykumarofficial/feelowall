const { verifyToken } = require('../helper/jwt');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const verified = verifyToken(token);
    req.user = verified;
    next();
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

const optionalAuthenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const verified = verifyToken(token);
    req.user = verified;
    next();
  } catch (error) {
    // If a token is provided but it's invalid, block the request
    res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

module.exports = {
  authenticateToken,
  optionalAuthenticateToken
};
