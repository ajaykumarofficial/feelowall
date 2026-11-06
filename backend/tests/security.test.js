const request = require('supertest');
const app = require('../app');
const db = require('../databaseModels');

jest.setTimeout(30000);

describe('Security & Sanitization API Tests', () => {
  beforeEach(async () => {
    await db.clearDb();
  });

  afterAll(async () => {
    await db.clearDb();
    await db.closeDb();
  });

  it('should sanitize NoSQL injection vectors in category and search queries', async () => {
    const res = await request(app)
      .get('/api/wallpapers')
      .query({ category: { $ne: 'All' }, search: { $gt: '' } });

    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.wallpapers)).toBe(true);
  });

  it('should load global rate limiter middleware correctly', async () => {
    const res = await request(app).get('/api/wallpapers');
    expect(res.headers).toHaveProperty('ratelimit-limit');
    expect(res.headers).toHaveProperty('ratelimit-remaining');
  });
});
