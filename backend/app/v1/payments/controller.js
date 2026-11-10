const config = require('../../../config');
const { User, Payment, Pack } = require('../../../databaseModels');
const { getStripe, isStripeConfigured, platformFee } = require('../../../helper/stripe');
const { asyncHandler, HttpError } = require('../../../helper/asyncHandler');
const { notify } = require('../../../helper/notifications');
const { exactCI } = require('../../../helper/text');
const { reportError } = require('../../../helper/logger');

const MIN_TIP_CENTS = 100;
const MAX_TIP_CENTS = 50000;

const getConnectStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('stripeAccountId stripeChargesEnabled emailVerified').lean();
  res.status(200).json({
    paymentsAvailable: isStripeConfigured(),
    connected: !!user.stripeAccountId,
    chargesEnabled: !!user.stripeChargesEnabled,
    emailVerified: !!user.emailVerified
  });
});

/** Create or continue the creator's Stripe Express account setup. Requires a confirmed email. */
const startOnboarding = asyncHandler(async (req, res) => {
  const stripe = getStripe();
  const user = await User.findById(req.user.id);
  if (!user.emailVerified) throw new HttpError(403, 'Confirm your email address before setting up payouts.', 'EMAIL_NOT_VERIFIED');

  if (!user.stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      metadata: { userId: user.id },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } }
    });
    user.stripeAccountId = account.id;
    await user.save();
  }

  const link = await stripe.accountLinks.create({
    account: user.stripeAccountId,
    type: 'account_onboarding',
    refresh_url: `${config.FRONTEND_URL}/studio?tab=earnings&stripe=refresh`,
    return_url: `${config.FRONTEND_URL}/studio?tab=earnings&stripe=done`
  });
  res.status(200).json({ url: link.url });
});

/** Called on return from Stripe, in case the webhook hasn't arrived yet. */
const refreshConnectStatus = asyncHandler(async (req, res) => {
  const stripe = getStripe();
  const user = await User.findById(req.user.id);
  if (!user.stripeAccountId) return res.status(200).json({ connected: false, chargesEnabled: false });
  const account = await stripe.accounts.retrieve(user.stripeAccountId);
  user.stripeChargesEnabled = !!account.charges_enabled;
  await user.save();
  res.status(200).json({ connected: true, chargesEnabled: user.stripeChargesEnabled });
});

const createDashboardLink = asyncHandler(async (req, res) => {
  const stripe = getStripe();
  const user = await User.findById(req.user.id).select('stripeAccountId').lean();
  if (!user.stripeAccountId) throw new HttpError(400, 'Set up payouts first.');
  const link = await stripe.accounts.createLoginLink(user.stripeAccountId);
  res.status(200).json({ url: link.url });
});

/** Hosted Stripe checkout. The money goes to the creator's account, minus any platform fee. */
const createCheckout = async ({ type, buyerId, creator, amountCents, productName, packId, successPath, cancelPath }) => {
  const stripe = getStripe();
  const feeCents = platformFee(amountCents);
  const metadata = {
    type,
    creatorId: String(creator._id),
    buyerId: String(buyerId),
    ...(packId ? { packId: String(packId) } : {})
  };

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: amountCents,
        product_data: { name: productName }
      }
    }],
    payment_intent_data: {
      ...(feeCents > 0 ? { application_fee_amount: feeCents } : {}),
      transfer_data: { destination: creator.stripeAccountId },
      metadata
    },
    metadata,
    ...(config.STRIPE_AUTOMATIC_TAX ? { automatic_tax: { enabled: true } } : {}),
    success_url: `${config.FRONTEND_URL}${successPath}`,
    cancel_url: `${config.FRONTEND_URL}${cancelPath}`
  });

  await Payment.create({
    type,
    buyerId,
    creatorId: creator._id,
    packId: packId || null,
    amountCents,
    platformFeeCents: feeCents,
    stripeSessionId: session.id
  });
  return session;
};

const createTip = asyncHandler(async (req, res) => {
  const amountCents = Number(req.body.amountCents);
  if (!Number.isInteger(amountCents) || amountCents < MIN_TIP_CENTS || amountCents > MAX_TIP_CENTS) {
    throw new HttpError(400, 'Tips can be from $1 to $500.');
  }
  if (typeof req.body.creator !== 'string') throw new HttpError(400, 'Please choose a creator.');

  const creator = await User.findOne({ username: exactCI(req.body.creator) });
  if (!creator) throw new HttpError(404, 'Creator not found.');
  if (String(creator._id) === req.user.id) throw new HttpError(400, 'You can\'t tip yourself.');
  if (!creator.stripeChargesEnabled || !creator.stripeAccountId) {
    throw new HttpError(400, 'This creator isn\'t set up to receive tips yet.');
  }

  const session = await createCheckout({
    type: 'tip',
    buyerId: req.user.id,
    creator,
    amountCents,
    productName: `Tip for ${creator.username} on FeeloWall`,
    successPath: `/creator/${encodeURIComponent(creator.username)}?tip=thanks`,
    cancelPath: `/creator/${encodeURIComponent(creator.username)}`
  });
  res.status(200).json({ url: session.url });
});

const getEarnings = asyncHandler(async (req, res) => {
  const creatorId = req.user.id;
  const payments = await Payment.find({ creatorId, status: { $in: ['paid', 'refunded'] } })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('packId', 'title')
    .lean();

  const totals = payments.reduce((sum, payment) => {
    if (payment.status !== 'paid') return { ...sum, refundedCents: sum.refundedCents + payment.amountCents };
    return {
      ...sum,
      grossCents: sum.grossCents + payment.amountCents,
      feesCents: sum.feesCents + payment.platformFeeCents,
      netCents: sum.netCents + payment.amountCents - payment.platformFeeCents,
      tips: sum.tips + (payment.type === 'tip' ? 1 : 0),
      packSales: sum.packSales + (payment.type === 'pack' ? 1 : 0)
    };
  }, { grossCents: 0, feesCents: 0, netCents: 0, refundedCents: 0, tips: 0, packSales: 0 });

  res.status(200).json({
    totals,
    // Buyers aren't identified to creators.
    payments: payments.map((payment) => ({
      id: String(payment._id),
      type: payment.type,
      packTitle: payment.packId?.title || null,
      amountCents: payment.amountCents,
      platformFeeCents: payment.platformFeeCents,
      currency: payment.currency,
      status: payment.status,
      date: payment.paidAt || payment.createdAt
    }))
  });
});

// ─── Webhook ─────────────────────────────────────────────────

const markPaid = async (session) => {
  const payment = await Payment.findOneAndUpdate(
    { stripeSessionId: session.id, status: 'pending' },
    { $set: { status: 'paid', paidAt: new Date(), stripePaymentIntentId: session.payment_intent || null } },
    { new: true }
  );
  // Stripe can deliver an event more than once; only the first one gets past the status check.
  if (!payment) return;

  const buyer = payment.buyerId ? await User.findById(payment.buyerId).select('username').lean() : null;
  const dollars = `$${(payment.amountCents / 100).toFixed(2)}`;
  if (payment.type === 'tip') {
    await notify({
      userId: payment.creatorId,
      type: 'tip',
      actorId: payment.buyerId,
      actorName: buyer?.username || '',
      text: `sent you a ${dollars} tip!`,
      link: '/studio?tab=earnings'
    });
  } else {
    const pack = await Pack.findById(payment.packId).select('title').lean();
    await notify({
      userId: payment.creatorId,
      type: 'pack-sale',
      text: `Your pack "${pack?.title || ''}" sold for ${dollars}.`,
      link: '/studio?tab=earnings'
    });
  }
};

const handleStripeEvent = async (event) => {
  const object = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
      // Delayed payment methods complete checkout first, and pay later.
      if (object.payment_status === 'paid') await markPaid(object);
      break;
    case 'checkout.session.async_payment_succeeded':
      await markPaid(object);
      break;
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired':
      await Payment.updateOne({ stripeSessionId: object.id, status: 'pending' }, { $set: { status: 'failed' } });
      break;
    case 'charge.refunded':
      // A full refund withdraws access to a purchased pack. Partial refunds keep it.
      if (object.refunded && object.payment_intent) {
        await Payment.updateOne({ stripePaymentIntentId: object.payment_intent }, { $set: { status: 'refunded' } });
      }
      break;
    case 'account.updated':
      await User.updateOne({ stripeAccountId: object.id }, { $set: { stripeChargesEnabled: !!object.charges_enabled } });
      break;
    default:
      break;
  }
};

/** Mounted before express.json, because the signature check needs the raw request body. */
const stripeWebhook = async (req, res) => {
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ message: 'Invalid webhook signature.' });
  }
  try {
    await handleStripeEvent(event);
    res.status(200).json({ received: true });
  } catch (err) {
    // A 500 makes Stripe retry the event later.
    reportError(err, { source: 'stripeWebhook' });
    res.status(500).json({ message: 'Webhook handling failed.' });
  }
};

module.exports = {
  getConnectStatus,
  startOnboarding,
  refreshConnectStatus,
  createDashboardLink,
  createCheckout,
  createTip,
  getEarnings,
  stripeWebhook
};
