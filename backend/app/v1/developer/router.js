const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { ApiKey } = require('../../../databaseModels');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');
const { asString } = require('../../../helper/text');
const { hashApiKey } = require('../../../middleware/apiKey');
const { authenticateToken } = require('../../../middleware/auth');

const MAX_ACTIVE_KEYS = 5;

const toView = (key) => ({
  id: String(key._id),
  name: key.name,
  prefix: key.prefix,
  rateLimitPerMinute: key.rateLimitPerMinute,
  lastUsedAt: key.lastUsedAt,
  createdAt: key.createdAt
});

router.use(authenticateToken);

router.get('/keys', asyncHandler(async (req, res) => {
  const keys = await ApiKey.find({ userId: req.user.id, revokedAt: null }).sort({ createdAt: -1 }).lean();
  res.status(200).json({ keys: keys.map(toView) });
}));

/** The full key is only ever returned here. Only its hash is stored. */
router.post('/keys', asyncHandler(async (req, res) => {
  const name = asString(req.body.name).slice(0, 80);
  if (!name) throw new HttpError(400, 'Please name this key.');
  if (await ApiKey.countDocuments({ userId: req.user.id, revokedAt: null }) >= MAX_ACTIVE_KEYS) {
    throw new HttpError(400, `You can have up to ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);
  }
  const plain = `fw_${crypto.randomBytes(24).toString('hex')}`;
  const key = await ApiKey.create({
    userId: req.user.id,
    name,
    keyHash: hashApiKey(plain),
    prefix: plain.slice(0, 9)
  });
  res.status(201).json({ message: 'Copy this key now. You won\'t be able to see it again.', key: plain, details: toView(key) });
}));

router.delete('/keys/:id', asyncHandler(async (req, res) => {
  const result = await ApiKey.updateOne(
    { _id: req.params.id, userId: req.user.id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  if (!result.matchedCount) throw new HttpError(404, 'Key not found.');
  res.status(200).json({ message: 'Key revoked.' });
}));

module.exports = router;
