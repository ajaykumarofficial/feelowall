const { verifyToken } = require('../helper/jwt');
const { User } = require('../databaseModels');

const readBearer = (req) => {
  const authHeader = req.headers['authorization'];
  return authHeader && authHeader.split(' ')[1];
};

/**
 * Turn a token into req.user. Checks the database on every request so that
 * suspensions, deleted accounts, and password resets take effect immediately.
 */
const resolveUser = async (token) => {
  const verified = verifyToken(token);
  const account = await User.findById(verified.id).select('role status tokenVersion username').lean();
  if (!account) {
    const err = new Error('This account no longer exists.');
    err.status = 401;
    throw err;
  }
  if (account.status === 'suspended') {
    const err = new Error('This account has been suspended.');
    err.status = 403;
    throw err;
  }
  if ((verified.tv || 0) !== (account.tokenVersion || 0)) {
    const err = new Error('Session expired. Please sign in again.');
    err.status = 401;
    throw err;
  }
  return { id: String(account._id), username: account.username, role: account.role || 'user' };
};

const authFailure = (res, error) => {
  const status = error.status || 403;
  res.status(status).json({ message: error.status ? error.message : 'Invalid or expired token.' });
};

const authenticateToken = async (req, res, next) => {
  const token = readBearer(req);
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  try {
    req.user = await resolveUser(token);
    next();
  } catch (error) {
    authFailure(res, error);
  }
};

const optionalAuthenticateToken = async (req, res, next) => {
  const token = readBearer(req);
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = await resolveUser(token);
    next();
  } catch (error) {
    // If a token is provided but it's invalid, block the request
    authFailure(res, error);
  }
};

/** For public pages: an expired token just means the visitor is treated as signed out. */
const softAuthenticateToken = async (req, res, next) => {
  req.user = null;
  const token = readBearer(req);
  if (token) {
    try {
      req.user = await resolveUser(token);
    } catch {
      req.user = null;
    }
  }
  next();
};

/**
 * Must run after authenticateToken. Staff accounts must also have two-factor
 * authentication turned on before they can use staff powers.
 */
const requireRole = (...roles) => async (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'You do not have permission to do this.' });
  }
  try {
    const account = await User.findById(req.user.id).select('twoFactor.enabled').lean();
    if (!account?.twoFactor?.enabled) {
      return res.status(403).json({
        message: 'Turn on two-factor authentication in Account Settings to use staff tools.',
        code: 'TWO_FACTOR_REQUIRED'
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticateToken,
  optionalAuthenticateToken,
  softAuthenticateToken,
  requireRole
};
