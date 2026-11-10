/** Small, dependency-free helpers for handling untrusted text. */

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive exact match, safe to build from user input. */
const exactCI = (value) => new RegExp(`^${escapeRegex(value)}$`, 'i');

/** Case-insensitive "contains" match, safe to build from user input. */
const containsCI = (value) => new RegExp(escapeRegex(value), 'i');

/** Returns the value only if it is a non-empty string, so query objects can't reach Mongo. */
const asString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '');

const normalizeTag = (tag) => String(tag).trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40);

const parseTags = (tags) => {
  let list = [];
  if (Array.isArray(tags)) list = tags.filter((t) => typeof t === 'string');
  else if (typeof tags === 'string') list = tags.split(',');
  return [...new Set(list.map(normalizeTag).filter(Boolean))].slice(0, 30);
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const isHttpUrl = (value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

const isEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

module.exports = { escapeRegex, exactCI, containsCI, asString, normalizeTag, parseTags, escapeHtml, isHttpUrl, isEmail };
