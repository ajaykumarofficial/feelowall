const request = require('supertest');
const app = require('../app');
const db = require('../databaseModels');
const path = require('path');
const fs = require('fs');
const testFilePath = path.join(__dirname, 'test-avatar.png');
fs.writeFileSync(testFilePath, 'dummy image contents');


jest.setTimeout(30000);

beforeEach(async () => {
  await db.clearDb();
});

afterAll(async () => {
  await db.clearDb();
  await db.closeDb();
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }
});

describe('Authentication API', () => {
  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'password123'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('message', 'User registered successfully.');
    expect(res.body.user).toHaveProperty('username', 'testuser');
  });

  it('should not register a user with an existing username', async () => {
    // Register first user
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'password123'
      });

    // Attempt second registration with same username
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'differentpassword'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('message', 'Username is already taken.');
  });

  it('should login an existing user and return a JWT token', async () => {
    // Register
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'password123'
      });

    // Login
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'password123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('username', 'testuser');
  });

  it('should reject login for wrong credentials', async () => {
    // Register
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        password: 'password123'
      });

    // Login with wrong password
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'wrongpassword'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('message', 'Invalid username or password.');
  });

  it('should upload a profile avatar successfully when authenticated', async () => {
    // Register
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'avatartest',
        password: 'password123'
      });

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'avatartest',
        password: 'password123'
      });

    const token = loginRes.body.token;

    // Upload avatar
    const res = await request(app)
      .put('/api/users/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', testFilePath);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message', 'Avatar updated successfully.');
    expect(res.body).toHaveProperty('avatarUrl');
    expect(res.body.avatarUrl).toContain('/uploads/wallpaper-');

    // Verify in database
    const user = await db.User.findOne({ username: 'avatartest' });
    expect(user.avatarUrl).toEqual(res.body.avatarUrl);
  });
});

describe('Wallpaper API', () => {
  it('should return an empty list of wallpapers initially', async () => {
    const res = await request(app).get('/api/wallpapers');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.wallpapers)).toBe(true);
    expect(res.body.wallpapers.length).toBe(0);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.total).toBe(0);
    expect(res.body.page).toBe(1);
  });

  it('should toggle featured status of a wallpaper and fetch featured list', async () => {
    // 1. Register & Login
    await request(app).post('/api/auth/register').send({ username: 'featuretest', password: 'password123' });
    const loginRes = await request(app).post('/api/auth/login').send({ username: 'featuretest', password: 'password123' });
    const token = loginRes.body.token;
    const userId = loginRes.body.user.id;

    // 2. Create wallpaper directly in DB
    const wallpaper = new db.Wallpaper({
      title: 'Test Wallpaper',
      category: 'Nature',
      imageUrl: '/uploads/test.png',
      filename: 'test.png',
      uploadedBy: 'featuretest',
      uploadedById: userId
    });
    await wallpaper.save();

    // 3. Feature it (without auth -> should fail)
    const failRes = await request(app).put(`/api/wallpapers/${wallpaper.id}/feature`);
    expect(failRes.statusCode).toEqual(401);

    // 4. Feature it (with auth -> should succeed)
    const successRes = await request(app)
      .put(`/api/wallpapers/${wallpaper.id}/feature`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(successRes.statusCode).toEqual(200);
    expect(successRes.body.isFeatured).toBe(true);

    // 5. Get featured list -> should return it
    const listRes = await request(app).get('/api/wallpapers/featured');
    expect(listRes.statusCode).toEqual(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].title).toBe('Test Wallpaper');
  });
});
