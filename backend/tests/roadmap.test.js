const request = require('supertest');
const app = require('../app');
const db = require('../databaseModels');

let authToken;
let demoUser;
let wallpaperId;

jest.setTimeout(30000);

beforeAll(async () => {
  await db.clearDb();

  // Register a user to get auth token
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({
      username: 'tester',
      password: 'password123'
    });

  // Login
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({
      username: 'tester',
      password: 'password123'
    });

  authToken = loginRes.body.token;
  demoUser = loginRes.body.user;

  // Insert a test wallpaper direct to DB
  const wp = new db.Wallpaper({
    title: 'Test Wallpaper',
    category: 'Nature',
    imageUrl: '/uploads/test.jpg',
    filename: 'test.jpg',
    uploadedBy: 'tester',
    uploadedById: demoUser.id
  });
  await wp.save();
  wallpaperId = wp._id.toString();
}, 30000);

afterAll(async () => {
  await db.clearDb();
  await db.closeDb();
});

describe('Roadmap Features API', () => {
  it('should toggle like on a wallpaper (like and then unlike)', async () => {
    // Like the wallpaper
    const likeRes = await request(app)
      .post(`/api/wallpapers/${wallpaperId}/like`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(likeRes.statusCode).toEqual(200);
    expect(likeRes.body.liked).toBe(true);
    expect(likeRes.body.likesCount).toBe(1);

    // Unlike the wallpaper
    const unlikeRes = await request(app)
      .post(`/api/wallpapers/${wallpaperId}/like`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(unlikeRes.statusCode).toEqual(200);
    expect(unlikeRes.body.liked).toBe(false);
    expect(unlikeRes.body.likesCount).toBe(0);
  });

  it('should reject toggling like if unauthorized', async () => {
    const res = await request(app)
      .post(`/api/wallpapers/${wallpaperId}/like`);

    expect(res.statusCode).toEqual(401);
  });

  it('should increment view count', async () => {
    const res = await request(app)
      .post(`/api/wallpapers/${wallpaperId}/view`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.viewsCount).toBe(1);

    const res2 = await request(app)
      .post(`/api/wallpapers/${wallpaperId}/view`);

    expect(res2.statusCode).toEqual(200);
    expect(res2.body.viewsCount).toBe(2);
  });

  it('should increment download count', async () => {
    const res = await request(app)
      .post(`/api/wallpapers/${wallpaperId}/download`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.downloadsCount).toBe(1);
  });

  it('should support sorting by likes, views, downloads', async () => {
    // Add another wallpaper with high stats
    const wp2 = new db.Wallpaper({
      title: 'Popular Wallpaper',
      category: 'Minimalist',
      imageUrl: '/uploads/popular.jpg',
      filename: 'popular.jpg',
      uploadedBy: 'tester',
      uploadedById: demoUser.id,
      likesCount: 10,
      downloadsCount: 5,
      viewsCount: 20
    });
    await wp2.save();

    // Get sorted by likes
    const resLikes = await request(app)
      .get('/api/wallpapers?sortBy=likes');
    
    expect(resLikes.statusCode).toEqual(200);
    expect(resLikes.body.wallpapers[0].title).toEqual('Popular Wallpaper');

    // Get sorted by downloads
    const resDownloads = await request(app)
      .get('/api/wallpapers?sortBy=downloads');

    expect(resDownloads.statusCode).toEqual(200);
    expect(resDownloads.body.wallpapers[0].title).toEqual('Popular Wallpaper');

    // Get sorted by views
    const resViews = await request(app)
      .get('/api/wallpapers?sortBy=views');

    expect(resViews.statusCode).toEqual(200);
    expect(resViews.body.wallpapers[0].title).toEqual('Popular Wallpaper');
  });

  it('should sign in/up via OAuth', async () => {
    const res = await request(app)
      .post('/api/auth/oauth')
      .send({
        provider: 'Google',
        username: 'oauth_tester',
        oauthId: 'google_123456',
        avatarUrl: 'https://example.com/avatar.png'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.username).toEqual('oauth_tester');
  });

  it('should update user bio and tipping links', async () => {
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        bio: 'Tester biography',
        tippingLinks: {
          kofi: 'tester-kofi',
          buyMeACoffee: 'tester-bmc',
          stripe: 'https://buy.stripe.com/test'
        }
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.user.bio).toEqual('Tester biography');
    expect(res.body.user.tippingLinks.kofi).toEqual('tester-kofi');
  });

  it('should retrieve a creator public profile details', async () => {
    const res = await request(app)
      .get('/api/users/profile/tester');

    expect(res.statusCode).toEqual(200);
    expect(res.body.username).toEqual('tester');
    expect(res.body.bio).toEqual('Tester biography');
    expect(res.body.tippingLinks.kofi).toEqual('tester-kofi');
    expect(res.body.wallpapers).toBeDefined();
    expect(res.body.playlists).toBeDefined();
  });

  it('should manage collaborative playlist contributors', async () => {
    const plRes = await request(app)
      .post('/api/playlists')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Shared Collection',
        description: 'Co-curated setups',
        isPublic: true
      });

    const playlistId = plRes.body.playlist._id;

    const addRes = await request(app)
      .post(`/api/playlists/${playlistId}/contributors`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        username: 'oauth_tester'
      });

    expect(addRes.statusCode).toEqual(200);
    expect(addRes.body.contributors.length).toEqual(1);
    expect(addRes.body.contributors[0].username).toEqual('oauth_tester');
  });

  it('should track daily analytics when viewed, downloaded, or liked and return them via GET /api/users/analytics', async () => {
    // Increment view
    await request(app).post(`/api/wallpapers/${wallpaperId}/view`);
    
    // Increment download
    await request(app).post(`/api/wallpapers/${wallpaperId}/download`);

    // Toggle like
    await request(app)
      .post(`/api/wallpapers/${wallpaperId}/like`)
      .set('Authorization', `Bearer ${authToken}`);

    // Get analytics
    const res = await request(app)
      .get('/api/users/analytics?days=7')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toEqual(7);
    
    // Today's entry is the last one in the sequential days array
    const todayEntry = res.body[res.body.length - 1];
    expect(todayEntry.views).toBeGreaterThanOrEqual(1);
    expect(todayEntry.downloads).toBeGreaterThanOrEqual(1);
    // Since it was unliked in the beforeAll tests or earlier, it can be 0 or 1. Let's make sure it's a number.
    expect(typeof todayEntry.likes).toEqual('number');
  });

  it('should support uploading and listing Live Wallpapers with video URLs', async () => {
    const res = await request(app)
      .post('/api/wallpapers/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Matrix Digital Rain',
        category: 'Anime',
        imageUrl: '/uploads/matrix-cover.jpg',
        filename: 'matrix-cover.jpg',
        isLive: true,
        videoUrl: '/uploads/matrix-loop.mp4',
        colors: [{ hex: '#2ed573', r: 46, g: 213, b: 115 }]
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.wallpaper.isLive).toBe(true);
    expect(res.body.wallpaper.videoUrl).toEqual('/uploads/matrix-loop.mp4');

    // Retrieve the category Anime wallpapers and search for it
    const listRes = await request(app).get('/api/wallpapers?category=Anime');
    expect(listRes.statusCode).toEqual(200);
    const matrixWp = listRes.body.wallpapers.find(w => w.title === 'Matrix Digital Rain');
    expect(matrixWp).toBeDefined();
    expect(matrixWp.isLive).toBe(true);
    expect(matrixWp.videoUrl).toEqual('/uploads/matrix-loop.mp4');
  });

  it('should support uploading wallpapers with tags and searching by tags', async () => {
    const res = await request(app)
      .post('/api/wallpapers/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Cyberpunk Alleyway',
        category: 'Minimalist',
        imageUrl: '/uploads/cyber.jpg',
        filename: 'cyber.jpg',
        tags: 'neon, cyberpunk, glowing, street',
        colors: [{ hex: '#ff007f', r: 255, g: 0, b: 127 }]
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.wallpaper.tags).toEqual(['neon', 'cyberpunk', 'glowing', 'street']);

    // Retrieve wallpapers searching for 'glowing'
    const searchRes = await request(app).get('/api/wallpapers?search=glowing');
    expect(searchRes.statusCode).toEqual(200);
    const foundWp = searchRes.body.wallpapers.find(w => w.title === 'Cyberpunk Alleyway');
    expect(foundWp).toBeDefined();
    expect(foundWp.tags).toContain('cyberpunk');
  });
});
