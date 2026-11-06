const request = require('supertest');
const app = require('../app');
const db = require('../databaseModels');

let authToken;
let demoUser;
let wallpaperAId;
let wallpaperBId;
let wallpaperCId;

jest.setTimeout(30000);

beforeAll(async () => {
  await db.clearDb();

  // Register a user to get auth token
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'phase8creator',
      password: 'password123'
    });

  // Login
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      username: 'phase8creator',
      password: 'password123'
    });

  authToken = loginRes.body.token;
  demoUser = loginRes.body.user;

  // Insert Wallpaper A (Target)
  const wpA = new db.Wallpaper({
    title: 'Wallpaper A',
    category: 'Nature',
    imageUrl: '/uploads/a.jpg',
    filename: 'a.jpg',
    uploadedBy: 'phase8creator',
    uploadedById: demoUser.id,
    colors: [
      { hex: '#ff0000', r: 255, g: 0, b: 0 },
      { hex: '#00ff00', r: 0, g: 255, b: 0 }
    ],
    tags: ['forest', 'lake'],
    viewsCount: 150, // Enough views for Rising Star view achievement
    downloadsCount: 5, // Not enough downloads for achievement
    likesCount: 12 // Enough likes for Crowd Pleaser achievement
  });
  await wpA.save();
  wallpaperAId = wpA._id.toString();

  // Insert Wallpaper B (Highly Similar to A: same colors, same category, same tags)
  const wpB = new db.Wallpaper({
    title: 'Wallpaper B',
    category: 'Nature',
    imageUrl: '/uploads/b.jpg',
    filename: 'b.jpg',
    uploadedBy: 'phase8creator',
    uploadedById: demoUser.id,
    colors: [
      { hex: '#ff0000', r: 255, g: 0, b: 0 },
      { hex: '#00ff00', r: 0, g: 255, b: 0 }
    ],
    tags: ['forest', 'lake']
  });
  await wpB.save();
  wallpaperBId = wpB._id.toString();

  // Insert Wallpaper C (Not Similar to A: different colors, category and tags)
  const wpC = new db.Wallpaper({
    title: 'Wallpaper C',
    category: 'Anime',
    imageUrl: '/uploads/c.jpg',
    filename: 'c.jpg',
    uploadedBy: 'otheruser',
    uploadedById: new db.mongoose.Types.ObjectId(),
    colors: [
      { hex: '#0000ff', r: 0, g: 0, b: 255 },
      { hex: '#ffffff', r: 255, g: 255, b: 255 }
    ],
    tags: ['cyberpunk', 'neon']
  });
  await wpC.save();
  wallpaperCId = wpC._id.toString();
}, 30000);

afterAll(async () => {
  await db.clearDb();
  await db.closeDb();
});

describe('Phase 8 — Advanced Aesthetics & Personalization API Tests', () => {
  describe('Visual Similarity & Color Distance Recommendation Engine', () => {
    it('should retrieve visually similar wallpapers sorted by similarity score', async () => {
      const res = await request(app)
        .get(`/api/wallpapers/${wallpaperAId}/similar`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // Wallpaper B should be the first similar recommendation (most similar)
      const firstRecommendation = res.body[0];
      expect(firstRecommendation._id).toEqual(wallpaperBId);
      expect(firstRecommendation.title).toEqual('Wallpaper B');
      
      // Wallpaper C, if present, should be ranked lower (after B)
      if (res.body.length > 1) {
        const ids = res.body.map(item => item._id);
        const idxB = ids.indexOf(wallpaperBId);
        const idxC = ids.indexOf(wallpaperCId);
        if (idxC !== -1) {
          expect(idxB).toBeLessThan(idxC);
        }
      }
    });

    it('should return 404 if wallpaper not found for similarity search', async () => {
      const fakeId = new db.mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/wallpapers/${fakeId}/similar`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toEqual('Wallpaper not found.');
    });
  });

  describe('Creator Achievements & Milestone Showcases', () => {
    it('should return correct unlocked status for badges on creator profile', async () => {
      const res = await request(app)
        .get(`/api/users/profile/phase8creator`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.achievements).toBeDefined();
      expect(Array.isArray(res.body.achievements)).toBe(true);

      // Total view count is 150 (since Wallpaper A has 150 views and B has 0)
      // "Rising Star" (target: 100 views) should be unlocked.
      const risingStar = res.body.achievements.find(a => a.id === 'rising_star');
      expect(risingStar).toBeDefined();
      expect(risingStar.unlocked).toBe(true);

      // "Superstar" (target: 1000 views) should be locked.
      const superstar = res.body.achievements.find(a => a.id === 'superstar');
      expect(superstar).toBeDefined();
      expect(superstar.unlocked).toBe(false);

      // Total downloads is 5.
      // "Collector Choice" (target: 10 downloads) should be locked.
      const collectorChoice = res.body.achievements.find(a => a.id === 'collector_choice');
      expect(collectorChoice).toBeDefined();
      expect(collectorChoice.unlocked).toBe(false);

      // Total likes is 12 (Wallpaper A has 12 likes, B has 0).
      // "Crowd Pleaser" (target: 10 likes) should be unlocked.
      const crowdPleaser = res.body.achievements.find(a => a.id === 'crowd_pleaser');
      expect(crowdPleaser).toBeDefined();
      expect(crowdPleaser.unlocked).toBe(true);

      // Total uploads is 2 (Wallpaper A and B).
      // "Newbie" (target: 1 upload) should be unlocked.
      const newbie = res.body.achievements.find(a => a.id === 'newbie');
      expect(newbie).toBeDefined();
      expect(newbie.unlocked).toBe(true);

      // "Pro Contributor" (target: 10 uploads) should be locked.
      const proContributor = res.body.achievements.find(a => a.id === 'pro_contributor');
      expect(proContributor).toBeDefined();
      expect(proContributor.unlocked).toBe(false);
    });
  });
});
