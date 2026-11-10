const express = require('express');
const router = express.Router();
const { Pack, Payment, Wallpaper, User } = require('../../../databaseModels');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');
const { asString } = require('../../../helper/text');
const { isAllowedMediaUrl } = require('../../../helper/media');
const { signPurposeToken, verifyPurposeToken } = require('../../../helper/jwt');
const { streamWallpapersZip } = require('../../../helper/zipStream');
const { createCheckout } = require('../payments/controller');
const { authenticateToken, softAuthenticateToken } = require('../../../middleware/auth');
const { paymentLimiter, zipLimiter } = require('../../../middleware/rateLimiter');
const config = require('../../../config');

const MIN_PRICE_CENTS = 100;
const MAX_PRICE_CENTS = 100000;
const MAX_PACK_ITEMS = 100;
const DOWNLOAD_LINK_MINUTES = 15;

const hasPurchased = (packId, userId) => (userId
  ? Payment.exists({ type: 'pack', packId, buyerId: userId, status: 'paid' })
  : null);

const salesCount = (packId) => Payment.countDocuments({ type: 'pack', packId, status: { $in: ['paid', 'pending'] } });

const summary = (pack) => ({
  id: String(pack._id),
  title: pack.title,
  description: pack.description,
  creatorName: pack.creatorName,
  creatorId: String(pack.creatorId),
  priceCents: pack.priceCents,
  currency: pack.currency,
  coverUrl: pack.coverUrl,
  status: pack.status,
  itemCount: (pack.wallpapers || []).length
});

/** Validate that every wallpaper belongs to the creator and isn't under moderation. */
const loadOwnWallpapers = async (ids, userId) => {
  if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'Choose at least one wallpaper.');
  if (ids.length > MAX_PACK_ITEMS) throw new HttpError(400, `A pack can hold up to ${MAX_PACK_ITEMS} wallpapers.`);
  const unique = [...new Set(ids.map(String))];
  const wallpapers = await Wallpaper.find({
    _id: { $in: unique },
    uploadedById: userId,
    status: { $nin: ['hidden', 'removed'] }
  }).select('_id').lean();
  if (wallpapers.length !== unique.length) throw new HttpError(403, 'You can only sell your own wallpapers that are in good standing.');
  return unique;
};

const validatePackFields = ({ title, priceCents, coverUrl }) => {
  if (title !== undefined && !asString(title)) throw new HttpError(400, 'Please give the pack a title.');
  if (priceCents !== undefined) {
    const price = Number(priceCents);
    if (!Number.isInteger(price) || price < MIN_PRICE_CENTS || price > MAX_PRICE_CENTS) {
      throw new HttpError(400, 'Pack prices can be from $1 to $1,000.');
    }
  }
  if (coverUrl && !isAllowedMediaUrl(coverUrl)) throw new HttpError(400, 'The cover must be uploaded through FeeloWall.');
};

const loadOwnedPack = async (id, userId) => {
  const pack = await Pack.findById(id);
  if (!pack) throw new HttpError(404, 'Pack not found.');
  if (String(pack.creatorId) !== userId) throw new HttpError(403, 'This isn\'t your pack.');
  return pack;
};

router.get('/', asyncHandler(async (req, res) => {
  const packs = await Pack.find({ status: 'published' }).sort({ createdAt: -1 }).limit(60).lean();
  res.status(200).json({ packs: packs.map(summary) });
}));

router.get('/mine', authenticateToken, asyncHandler(async (req, res) => {
  const packs = await Pack.find({ creatorId: req.user.id }).sort({ createdAt: -1 }).lean();
  res.status(200).json({ packs: packs.map(summary) });
}));

router.get('/purchased', authenticateToken, asyncHandler(async (req, res) => {
  const purchases = await Payment.find({ type: 'pack', buyerId: req.user.id, status: 'paid' }).select('packId').lean();
  const packs = await Pack.find({ _id: { $in: purchases.map((row) => row.packId) } }).lean();
  res.status(200).json({ packs: packs.map(summary) });
}));

/** The link itself is the credential, because browsers can't add auth headers to a download. */
router.get('/download/:token', zipLimiter, asyncHandler(async (req, res) => {
  let payload;
  try {
    payload = verifyPurposeToken(req.params.token, 'pack-download');
  } catch {
    throw new HttpError(410, 'This download link has expired. Please get a new one from the pack page.');
  }
  const pack = await Pack.findById(payload.packId).populate('wallpapers', 'title imageUrl filename').lean();
  if (!pack) throw new HttpError(404, 'Pack not found.');

  // Checked again here, so that a refund also cancels links already issued.
  const allowed = String(pack.creatorId) === payload.userId || await hasPurchased(pack._id, payload.userId);
  if (!allowed) throw new HttpError(403, 'This purchase is no longer active.');

  await streamWallpapersZip(res, pack.wallpapers || [], pack.title);
}));

router.get('/:id', softAuthenticateToken, asyncHandler(async (req, res) => {
  const pack = await Pack.findById(req.params.id).populate('wallpapers', 'title imageUrl altText width height').lean();
  if (!pack) throw new HttpError(404, 'Pack not found.');

  const isCreator = !!req.user && String(pack.creatorId) === req.user.id;
  const purchased = !!await hasPurchased(pack._id, req.user?.id);
  if (pack.status === 'draft' && !isCreator) throw new HttpError(404, 'Pack not found.');
  if (pack.status === 'archived' && !isCreator && !purchased) throw new HttpError(404, 'Pack not found.');

  const canSeeFiles = isCreator || purchased;
  res.status(200).json({
    pack: {
      ...summary(pack),
      // Before purchase, buyers see only titles: the image addresses are what they're paying for.
      items: (pack.wallpapers || []).map((item) => (canSeeFiles
        ? item
        : { _id: item._id, title: item.title }))
    },
    isCreator,
    purchased
  });
}));

router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const { title, description, priceCents, coverUrl, wallpaperIds } = req.body;
  if (priceCents === undefined || title === undefined) throw new HttpError(400, 'Title and price are required.');
  validatePackFields({ title, priceCents, coverUrl });
  const wallpapers = await loadOwnWallpapers(wallpaperIds, req.user.id);

  const pack = await Pack.create({
    title: asString(title),
    description: asString(description),
    priceCents: Number(priceCents),
    coverUrl: coverUrl || '',
    wallpapers,
    creatorId: req.user.id,
    creatorName: req.user.username
  });
  res.status(201).json({ message: 'Pack saved as a draft.', pack: summary(pack) });
}));

/** Going on sale requires working payouts, and takes the wallpapers out of the public gallery. */
router.put('/:id/publish', authenticateToken, asyncHandler(async (req, res) => {
  const pack = await loadOwnedPack(req.params.id, req.user.id);
  if (!pack.wallpapers.length) throw new HttpError(400, 'Add at least one wallpaper first.');

  const creator = await User.findById(req.user.id).select('stripeChargesEnabled').lean();
  if (!creator.stripeChargesEnabled) throw new HttpError(403, 'Finish setting up payouts before selling a pack.', 'PAYOUTS_REQUIRED');

  await Wallpaper.updateMany(
    { _id: { $in: pack.wallpapers }, uploadedById: req.user.id, status: { $nin: ['hidden', 'removed'] } },
    { $set: { status: 'pack-only', isFeatured: false, featuredAt: null } }
  );
  pack.status = 'published';
  await pack.save();
  res.status(200).json({ message: 'Your pack is on sale.', pack: summary(pack) });
}));

/** Packs with sales are archived, so buyers keep their downloads. Otherwise wallpapers go back to public. */
router.put('/:id/unpublish', authenticateToken, asyncHandler(async (req, res) => {
  const pack = await loadOwnedPack(req.params.id, req.user.id);
  if (await salesCount(pack._id) > 0) {
    pack.status = 'archived';
  } else {
    pack.status = 'draft';
    await Wallpaper.updateMany({ _id: { $in: pack.wallpapers }, status: 'pack-only' }, { $set: { status: 'published' } });
  }
  await pack.save();
  res.status(200).json({ message: pack.status === 'archived' ? 'Pack taken off sale. Buyers keep access.' : 'Pack returned to drafts.', pack: summary(pack) });
}));

router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const pack = await loadOwnedPack(req.params.id, req.user.id);
  if (await salesCount(pack._id) > 0) throw new HttpError(400, 'Packs with sales can\'t be deleted, so buyers keep access. Take it off sale instead.');
  await Wallpaper.updateMany({ _id: { $in: pack.wallpapers }, status: 'pack-only' }, { $set: { status: 'published' } });
  await Pack.deleteOne({ _id: pack._id });
  res.status(200).json({ message: 'Pack deleted.' });
}));

router.post('/:id/checkout', paymentLimiter, authenticateToken, asyncHandler(async (req, res) => {
  const pack = await Pack.findById(req.params.id);
  if (!pack || pack.status !== 'published') throw new HttpError(404, 'Pack not found.');
  if (String(pack.creatorId) === req.user.id) throw new HttpError(400, 'You can\'t buy your own pack.');
  if (await hasPurchased(pack._id, req.user.id)) throw new HttpError(400, 'You already own this pack.');

  const creator = await User.findById(pack.creatorId);
  if (!creator?.stripeChargesEnabled || !creator.stripeAccountId) {
    throw new HttpError(400, 'This pack isn\'t available right now.');
  }

  const session = await createCheckout({
    type: 'pack',
    buyerId: req.user.id,
    creator,
    amountCents: pack.priceCents,
    productName: `${pack.title} (FeeloWall pack)`,
    packId: pack._id,
    successPath: `/packs/${pack._id}?purchase=thanks`,
    cancelPath: `/packs/${pack._id}`
  });
  res.status(200).json({ url: session.url });
}));

router.post('/:id/download-link', authenticateToken, asyncHandler(async (req, res) => {
  const pack = await Pack.findById(req.params.id).select('creatorId').lean();
  if (!pack) throw new HttpError(404, 'Pack not found.');
  const allowed = String(pack.creatorId) === req.user.id || await hasPurchased(pack._id, req.user.id);
  if (!allowed) throw new HttpError(403, 'Buy this pack to download it.');

  const token = signPurposeToken({ packId: String(pack._id), userId: req.user.id }, 'pack-download', `${DOWNLOAD_LINK_MINUTES}m`);
  res.status(200).json({
    url: `${config.API_PUBLIC_URL}/api/packs/download/${token}`,
    expiresInMinutes: DOWNLOAD_LINK_MINUTES
  });
}));

module.exports = router;
