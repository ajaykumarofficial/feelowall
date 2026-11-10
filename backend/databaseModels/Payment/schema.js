const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  type: { type: String, enum: ['tip', 'pack'], required: true },
  // Null once a buyer deletes their account: payment records are kept for accounting.
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  packId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pack', default: null },
  amountCents: { type: Number, required: true },
  platformFeeCents: { type: Number, default: 0 },
  currency: { type: String, default: 'usd' },
  status: { type: String, enum: ['pending', 'paid', 'refunded', 'failed'], default: 'pending' },
  stripeSessionId: { type: String, required: true, unique: true },
  stripePaymentIntentId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  paidAt: { type: Date, default: null }
});

PaymentSchema.index({ creatorId: 1, status: 1, createdAt: -1 });
PaymentSchema.index({ buyerId: 1, packId: 1, status: 1 });
PaymentSchema.index({ stripePaymentIntentId: 1 });

module.exports = PaymentSchema;
