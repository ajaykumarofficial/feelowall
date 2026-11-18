require('dotenv').config();

module.exports = {
  PORT: process.env.PORT,
  USE_REDIS: process.env.USE_REDIS,
  REDIS_URL: process.env.REDIS_URL,
  MONGODB_URI: process.env.MONGODB_URI,
  JWT_SECRET: process.env.JWT_SECRET,

  // Image storage on Amazon S3 (falls back to local disk when unset)
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  // Optional: serve files from a CDN/custom domain instead of the bucket URL
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL,
  // Folder inside the bucket that all uploads go under
  S3_KEY_PREFIX: process.env.S3_KEY_PREFIX || 'feelowall',

  // Public addresses, used in emails, OAuth redirects, payment returns, and share pages
  FRONTEND_URL: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''),
  API_PUBLIC_URL: (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, ''),

  // OAuth (a provider is offered only when both of its values are set)
  OAUTH: {
    Google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
    GitHub: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET },
    Discord: { clientId: process.env.DISCORD_CLIENT_ID, clientSecret: process.env.DISCORD_CLIENT_SECRET }
  },

  // Email (SMTP_URL example: smtps://user:pass@smtp.example.com)
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM || 'FeeloWall <no-reply@feelowall.local>',

  // Payments
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  PLATFORM_FEE_PERCENT: Number(process.env.PLATFORM_FEE_PERCENT || 0),
  STRIPE_AUTOMATIC_TAX: process.env.STRIPE_AUTOMATIC_TAX === 'true',

  // AI features are off unless a key is set
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  AI_MODEL: process.env.AI_MODEL || 'claude-opus-5-5',

  // Optional: POST redacted server errors to this URL (e.g. a Slack or Discord webhook)
  ERROR_WEBHOOK_URL: process.env.ERROR_WEBHOOK_URL
};
