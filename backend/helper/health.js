const crypto = require('crypto');
const mongoose = require('mongoose');
const { HeadBucketCommand } = require('@aws-sdk/client-s3');
const config = require('../config');
const { redact } = require('./logger');

/**
 * GET/HEAD /api/health, for the external uptime monitor.
 *
 * The status code is what the monitor reads: 200 when every critical dependency
 * answers, 503 when one doesn't. Optional dependencies can show "down" in the
 * body without changing the status code.
 *
 * Each check gets its own timeout and they all run at once, so a hung
 * dependency costs at most CHECK_TIMEOUT_MS, well inside the monitor's limit.
 * The overall deadline is a second guard in case a check ignores its timeout.
 */

const CHECK_TIMEOUT_MS = 2000;
const OVERALL_TIMEOUT_MS = 2800;

class CheckTimeout extends Error {
  constructor(ms) {
    super(`timed out after ${ms}ms`);
    this.name = 'CheckTimeout';
  }
}

/** Resolve with fn's result, or reject after ms. fn gets an AbortSignal it may pass on. */
const withTimeout = (fn, ms) => {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new CheckTimeout(ms));
    }, ms);
  });
  return Promise.race([Promise.resolve().then(() => fn(controller.signal)), timeout])
    .finally(() => clearTimeout(timer));
};

// ---- The checks this app actually has ----

/** MongoDB holds every account and wallpaper: nothing works without it. */
const mongoCheck = {
  name: 'database',
  critical: true,
  run: async () => {
    // When the driver isn't connected, a ping would wait for server selection (30s). Fail fast instead.
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) throw new Error('not connected');
    await mongoose.connection.db.admin().command({ ping: 1 });
  }
};

/** Redis backs the image queue only when USE_REDIS=true; the app falls back to an in-memory queue. */
const redisCheck = () => {
  const { redisConnection } = require('./queue');
  if (!redisConnection) return null;
  return {
    name: 'queue',
    critical: false,
    run: async () => {
      // ioredis queues commands while disconnected, so don't add one; report the state instead.
      if (redisConnection.status !== 'ready') throw new Error(`redis status ${redisConnection.status}`);
      await redisConnection.ping();
    }
  };
};

/** S3 holds uploaded images when configured. Browsing still works without it; uploads don't. */
const s3Check = () => {
  const storage = require('./storage');
  if (!storage.isConfigured()) return null;
  return {
    name: 'storage',
    critical: false,
    run: async (signal) => {
      // HeadBucket is the cheapest S3 call. It needs s3:ListBucket on the bucket.
      await storage.getClient().send(new HeadBucketCommand({ Bucket: config.AWS_S3_BUCKET }), { abortSignal: signal });
    }
  };
};

/** The checks that apply to this deployment. Unconfigured optional services are left out. */
const defaultChecks = () => [mongoCheck, redisCheck(), s3Check()].filter(Boolean);

// ---- Token ----

/** Constant-time comparison. Hashing first makes both sides the same length. */
const tokenMatches = (given, expected) => {
  if (typeof given !== 'string' || !given) return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
};

// ---- Handler ----

/** Send JSON without an ETag, so a conditional request can never turn the answer into a 304. */
const send = (res, code, body) => {
  res.status(code);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const lastStatus = new Map();

/** Log failures server-side (details never go in the response), once per change of state. */
const logResult = (name, status, err) => {
  if (lastStatus.get(name) === status) return;
  lastStatus.set(name, status);
  if (process.env.NODE_ENV === 'test') return;
  if (status === 'down') console.warn(`[health] ${name} is down: ${redact(err?.message || err)}`);
  else console.log(`[health] ${name} is up`);
};

const runCheck = async (check, timeoutMs) => {
  const started = Date.now();
  try {
    await withTimeout(check.run, timeoutMs);
    logResult(check.name, 'up');
    return { status: 'up', latencyMs: Date.now() - started };
  } catch (err) {
    logResult(check.name, 'down', err);
    return { status: 'down', latencyMs: Date.now() - started };
  }
};

/**
 * Build the Express handler.
 * @param {object} [options]
 * @param {() => Array<{name, critical, run}>} [options.getChecks]
 * @param {number} [options.timeoutMs]        per-check timeout
 * @param {number} [options.overallTimeoutMs] deadline for the whole response
 */
const createHealthHandler = ({
  getChecks = defaultChecks,
  timeoutMs = CHECK_TIMEOUT_MS,
  overallTimeoutMs = OVERALL_TIMEOUT_MS
} = {}) => async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  let checks;
  try {
    checks = getChecks();
  } catch (err) {
    logResult('setup', 'down', err);
    checks = [];
  }

  const started = Date.now();
  const results = await Promise.all(checks.map((check) => (
    // A check that somehow outlives its own timeout is still cut off at the overall deadline.
    withTimeout(() => runCheck(check, timeoutMs), Math.max(0, overallTimeoutMs - (Date.now() - started)))
      .catch(() => ({ status: 'down', latencyMs: Date.now() - started }))
  )));

  const criticalDown = checks.length === 0 || checks.some((c, i) => c.critical && results[i].status === 'down');
  const anyDown = results.some((r) => r.status === 'down');
  const status = criticalDown ? 'down' : (anyDown ? 'degraded' : 'ok');
  const code = criticalDown ? 503 : 200;

  const expected = process.env.HEALTH_CHECK_TOKEN;
  const showDetails = !expected || tokenMatches(req.get('X-Health-Token'), expected);

  if (!showDetails) {
    return send(res, code, { status: status === 'down' ? 'down' : 'ok' });
  }

  send(res, code, {
    status,
    checks: Object.fromEntries(checks.map((c, i) => [c.name, results[i]])),
    timestamp: new Date().toISOString()
  });
};

module.exports = { createHealthHandler, defaultChecks, tokenMatches, withTimeout, CHECK_TIMEOUT_MS };
