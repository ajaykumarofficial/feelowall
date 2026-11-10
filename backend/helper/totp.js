const crypto = require('crypto');
const config = require('../config');

const STEP_SECONDS = 30;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const base32Encode = (buffer) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
};

const base32Decode = (text) => {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 value.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(bytes);
};

/** RFC 6238 time-based code for a given 30-second step. */
const generateCode = (secretBase32, step) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1000000).padStart(6, '0');
};

const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

/**
 * Check a code, allowing one step of clock drift either way. Returns the matched
 * step, which callers store so that the same code can't be used twice.
 */
const verifyCode = (secretBase32, code, lastUsedStep = 0, now = Date.now()) => {
  if (!/^\d{6}$/.test(String(code))) return null;
  const expected = Buffer.from(String(code));
  const step = currentStep(now);
  for (const candidate of [step - 1, step, step + 1]) {
    if (candidate <= lastUsedStep) continue;
    if (crypto.timingSafeEqual(Buffer.from(generateCode(secretBase32, candidate)), expected)) return candidate;
  }
  return null;
};

const generateSecret = () => base32Encode(crypto.randomBytes(20));

const otpauthUrl = (username, secretBase32) =>
  `otpauth://totp/${encodeURIComponent(`FeeloWall:${username}`)}?secret=${secretBase32}&issuer=FeeloWall&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;

// Secrets are encrypted at rest with a key derived from JWT_SECRET.
const encryptionKey = () => crypto.createHash('sha256').update(`totp:${config.JWT_SECRET}`).digest();

const encryptSecret = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join('.');
};

const decryptSecret = (stored) => {
  const [iv, tag, encrypted] = stored.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

const generateRecoveryCodes = () => Array.from({ length: 8 }, () => {
  const raw = crypto.randomBytes(5).toString('hex');
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
});

const hashRecoveryCode = (code) => crypto.createHash('sha256').update(String(code).trim().toLowerCase()).digest('hex');

module.exports = {
  base32Encode,
  base32Decode,
  generateCode,
  currentStep,
  verifyCode,
  generateSecret,
  otpauthUrl,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode
};
