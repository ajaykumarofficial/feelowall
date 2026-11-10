const crypto = require('crypto');
const { ApiKey, User } = require('../databaseModels');

const hashApiKey = (key) => crypto.createHash('sha256').update(String(key)).digest('hex');

/** Keys come from a header only: URLs end up in logs and browser history. */
const readKey = (req) => {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header) return header;
  const auth = req.headers.authorization;
  return auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
};

const requireApiKey = async (req, res, next) => {
  try {
    const plain = readKey(req);
    if (!plain) return res.status(401).json({ message: 'Send your API key in the X-API-Key header.' });

    const apiKey = await ApiKey.findOne({ keyHash: hashApiKey(plain), revokedAt: null }).lean();
    if (!apiKey) return res.status(401).json({ message: 'Invalid or revoked API key.' });

    const owner = await User.findById(apiKey.userId).select('status').lean();
    if (!owner || owner.status === 'suspended') return res.status(403).json({ message: 'This API key is not active.' });

    req.apiKey = apiKey;
    // Fire and forget: this bookkeeping shouldn't slow down or fail the request.
    ApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireApiKey, hashApiKey };
