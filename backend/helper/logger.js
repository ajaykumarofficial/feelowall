const config = require('../config');

const REDACTIONS = [
  [/(mongodb(\+srv)?:\/\/)[^@\s/]+@/gi, '$1<redacted>@'],
  [/(smtps?:\/\/)[^@\s/]+@/gi, '$1<redacted>@'],
  [/\bBearer\s+[\w.~+/=-]+/gi, 'Bearer <redacted>'],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<redacted-jwt>'],
  [/\b(sk|rk|whsec)_(live|test)?_?[\w]+/gi, '<redacted-key>'],
  [/\bsk-ant-[\w-]+/gi, '<redacted-key>'],
  [/\bfw_[a-f0-9]{16,}/gi, '<redacted-key>'],
  [/("?(?:password|passwordHash|secret|token|authorization|api[_-]?key)"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,}]+)/gi, '$1<redacted>']
];

const redact = (value) => REDACTIONS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value ?? ''));

/** Log a server error with credentials removed, and optionally forward it to a webhook. */
const reportError = (err, context = {}) => {
  const message = redact(err?.stack || err?.message || err);
  const where = context.method ? `${context.method} ${redact(context.path || '')}` : (context.source || 'server');
  if (process.env.NODE_ENV !== 'test') console.error(`[error] ${where}: ${message}`);

  if (config.ERROR_WEBHOOK_URL) {
    fetch(config.ERROR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `FeeloWall error at ${where}: ${redact(err?.message || err).slice(0, 1500)}` })
    }).catch(() => {});
  }
};

module.exports = { redact, reportError };
