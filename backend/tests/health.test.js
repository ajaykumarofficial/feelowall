const express = require('express');
const request = require('supertest');
const { createHealthHandler, tokenMatches } = require('../helper/health');

const up = (name, critical = true) => ({ name, critical, run: async () => {} });
const failing = (name, critical = true) => ({
  name,
  critical,
  run: async () => { throw new Error('connect ECONNREFUSED db-internal.example:27017 password=hunter2'); }
});
const hanging = (name, critical = true) => ({ name, critical, run: () => new Promise(() => {}) });

const appWith = (checks, options = {}) => {
  const app = express();
  app.get('/api/health', createHealthHandler({ getChecks: () => checks, timeoutMs: 200, overallTimeoutMs: 400, ...options }));
  return app;
};

afterEach(() => {
  delete process.env.HEALTH_CHECK_TOKEN;
});

describe('GET /api/health', () => {
  it('answers 200 when every dependency is up', async () => {
    const res = await request(appWith([up('database'), up('queue', false)])).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers.etag).toBeUndefined();
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.database).toEqual({ status: 'up', latencyMs: expect.any(Number) });
    expect(res.body.checks.queue.status).toBe('up');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it('answers 503 when a critical dependency fails', async () => {
    const res = await request(appWith([failing('database'), up('queue', false)])).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('down');
    expect(res.body.checks.database.status).toBe('down');
  });

  it('stays 200 but reports degraded when only an optional dependency fails', async () => {
    const res = await request(appWith([up('database'), failing('storage', false)])).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.storage.status).toBe('down');
  });

  it('never puts error details in the body', async () => {
    const res = await request(appWith([failing('database')])).get('/api/health');
    const text = JSON.stringify(res.body);
    for (const leak of ['ECONNREFUSED', 'db-internal', 'hunter2', '27017', 'stack']) expect(text).not.toContain(leak);
  });

  it('answers within the time limit when a dependency hangs', async () => {
    const started = Date.now();
    const res = await request(appWith([hanging('database'), up('queue', false)])).get('/api/health');
    expect(Date.now() - started).toBeLessThan(1000);
    expect(res.status).toBe(503);
    expect(res.body.checks.database.status).toBe('down');
    expect(res.body.checks.queue.status).toBe('up');
  });

  it('runs the checks in parallel', async () => {
    const started = Date.now();
    await request(appWith([hanging('a'), hanging('b'), hanging('c')])).get('/api/health');
    expect(Date.now() - started).toBeLessThan(600);
  });

  it('uses about 2 seconds per check and stays under 3 seconds by default', async () => {
    const app = express();
    app.get('/api/health', createHealthHandler({ getChecks: () => [hanging('database')] }));
    const started = Date.now();
    const res = await request(app).get('/api/health');
    const elapsed = Date.now() - started;
    expect(res.status).toBe(503);
    expect(elapsed).toBeGreaterThanOrEqual(1900);
    expect(elapsed).toBeLessThan(3000);
  });
});

describe('HEAD /api/health', () => {
  it('returns the same status code with no body', async () => {
    const healthy = await request(appWith([up('database')])).head('/api/health');
    expect(healthy.status).toBe(200);
    expect(healthy.headers['cache-control']).toBe('no-store');
    expect(healthy.text).toBeFalsy();

    const unhealthy = await request(appWith([failing('database')])).head('/api/health');
    expect(unhealthy.status).toBe(503);
    expect(unhealthy.text).toBeFalsy();
  });
});

describe('HEALTH_CHECK_TOKEN', () => {
  it('hides per-check details without the right token', async () => {
    process.env.HEALTH_CHECK_TOKEN = 'secret-token';
    const app = appWith([up('database'), failing('storage', false)]);

    for (const headers of [{}, { 'X-Health-Token': 'wrong' }]) {
      const res = await request(app).get('/api/health').set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    }
  });

  it('still reports the true status code without the token', async () => {
    process.env.HEALTH_CHECK_TOKEN = 'secret-token';
    const res = await request(appWith([failing('database')])).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'down' });
  });

  it('shows details with the right token', async () => {
    process.env.HEALTH_CHECK_TOKEN = 'secret-token';
    const res = await request(appWith([up('database')])).get('/api/health').set('X-Health-Token', 'secret-token');
    expect(res.status).toBe(200);
    expect(res.body.checks.database.status).toBe('up');
    expect(res.body.timestamp).toBeDefined();
  });

  it('compares tokens of any length safely', () => {
    expect(tokenMatches('abc', 'abc')).toBe(true);
    expect(tokenMatches('abcd', 'abc')).toBe(false);
    expect(tokenMatches('', 'abc')).toBe(false);
    expect(tokenMatches(undefined, 'abc')).toBe(false);
  });
});

describe('route wiring', () => {
  it('is registered before the rate limiter and the auth routers, with no redirect', () => {
    // Read the source rather than load app.js, which connects to MongoDB.
    const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
    const health = source.indexOf("app.get('/api/health'");
    expect(health).toBeGreaterThan(-1);
    expect(health).toBeLessThan(source.indexOf('app.use(globalLimiter)'));
    expect(health).toBeLessThan(source.indexOf("app.use('/api/auth'"));
  });
});
