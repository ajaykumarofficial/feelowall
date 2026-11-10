const Stripe = require('stripe');
const config = require('../config');
const { HttpError } = require('./asyncHandler');

let client = null;

/** Tests inject a fake client here, so no test can reach the real Stripe API. */
const setStripeClient = (fake) => {
  client = fake;
};

const isStripeConfigured = () => !!client || !!config.STRIPE_SECRET_KEY;

const getStripe = () => {
  if (client) return client;
  if (!config.STRIPE_SECRET_KEY) throw new HttpError(503, 'Payments are not set up on this server yet.', 'PAYMENTS_UNAVAILABLE');
  client = new Stripe(config.STRIPE_SECRET_KEY);
  return client;
};

const platformFee = (amountCents) => Math.round(amountCents * Math.min(Math.max(config.PLATFORM_FEE_PERCENT, 0), 100) / 100);

module.exports = { getStripe, setStripeClient, isStripeConfigured, platformFee };
