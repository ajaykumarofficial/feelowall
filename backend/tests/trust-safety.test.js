const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const app = require('../app');
const config = require('../config');
const totp = require('../helper/totp');
const { testOutbox } = require('../helper/mailer');
const { hashPassword } = require('../helper/bcrypt');
const { computeDHash, hammingDistance } = require('../helper/perceptualHash');
const { processImageJob } = require('../helper/worker');
const { redact } = require('../helper/logger');
const { backup } = require('../scripts/db-backup');
const { restore } = require('../scripts/db-restore');
const { db, createUser, createStaff, createWallpaper, createImageFile, trackFile, cleanupFiles } = require('./helpers');

jest.setTimeout(60000);

const tokenFrom = (mail) => /token=([a-f0-9]+)/.exec(mail.text)[1];

beforeEach(async () => {
  await db.clearDb();
  testOutbox.length = 0;
});

afterAll(async () => {
  cleanupFiles();
  await db.clearDb();
  await db.closeDb();
});

describe('Verified OAuth', () => {
  const fetchSpy = () => jest.spyOn(global, 'fetch');

  const mockGitHub = (profile, emails = []) => {
    fetchSpy().mockImplementation(async (url) => {
      const json = (body, ok = true) => ({ ok, json: async () => body });
      if (String(url).includes('login/oauth/access_token')) return json({ access_token: 'provider-token' });
      if (String(url).endsWith('/user')) return json(profile);
      if (String(url).endsWith('/user/emails')) return json(emails);
      throw new Error(`Unexpected request to ${url}`);
    });
  };

  const beginFlow = async () => {
    const res = await request(app).get('/api/auth/oauth/github/start');
    expect(res.statusCode).toBe(200);
    return res.body.state;
  };

  beforeEach(() => {
    config.OAUTH.GitHub = { clientId: 'id', clientSecret: 'secret' };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    config.OAUTH.GitHub = { clientId: undefined, clientSecret: undefined };
  });

  it('no longer accepts the forged client-supplied identity that allowed account takeover', async () => {
    await createUser('victim');
    const res = await request(app)
      .post('/api/auth/oauth')
      .send({ provider: 'GitHub', username: 'victim', oauthId: 'anything' });
    expect(res.statusCode).toBe(404);
    expect(res.body.token).toBeUndefined();
  });

  it('ignores identity fields sent by the browser, using only what the provider returns', async () => {
    await createUser('victim');
    mockGitHub({ id: 42, login: 'real-github-user', avatar_url: '' });
    const state = await beginFlow();

    const res = await request(app)
      .post('/api/auth/oauth/github/callback')
      .send({ code: 'abc', state, username: 'victim', oauthId: 'victim-id' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.username).toBe('real-github-user');
  });

  it('never links to an existing account that merely has the same username', async () => {
    const victim = await createUser('samename');
    mockGitHub({ id: 7, login: 'samename', avatar_url: '' });
    const state = await beginFlow();

    const res = await request(app).post('/api/auth/oauth/github/callback').send({ code: 'abc', state });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.id).not.toBe(victim.id);
    expect(res.body.user.username).not.toBe('samename');
    const untouched = await db.User.findById(victim.id);
    expect(untouched.oauthId).toBeNull();
  });

  it('never links to an existing account that merely has the same email', async () => {
    const victim = await createUser('emailowner', { email: 'shared@example.com', emailVerified: true });
    mockGitHub({ id: 8, login: 'other', avatar_url: '' }, [{ email: 'shared@example.com', primary: true, verified: true }]);
    const state = await beginFlow();

    const res = await request(app).post('/api/auth/oauth/github/callback').send({ code: 'abc', state });

    expect(res.body.user.id).not.toBe(victim.id);
    expect(res.body.user.email).toBe('');
  });

  it('returns the same account when the same provider identity signs in again', async () => {
    mockGitHub({ id: 99, login: 'returning', avatar_url: '' });
    const first = await request(app).post('/api/auth/oauth/github/callback').send({ code: 'a', state: await beginFlow() });
    const second = await request(app).post('/api/auth/oauth/github/callback').send({ code: 'b', state: await beginFlow() });
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it('rejects a forged state, or a state from another provider', async () => {
    config.OAUTH.Discord = { clientId: 'id', clientSecret: 'secret' };
    mockGitHub({ id: 1, login: 'x' });

    const forged = await request(app).post('/api/auth/oauth/github/callback').send({ code: 'a', state: 'not-a-real-state' });
    expect(forged.statusCode).toBe(400);

    const discordStart = await request(app).get('/api/auth/oauth/discord/start');
    const crossed = await request(app).post('/api/auth/oauth/github/callback').send({ code: 'a', state: discordStart.body.state });
    expect(crossed.statusCode).toBe(400);
    config.OAUTH.Discord = { clientId: undefined, clientSecret: undefined };
  });

  it('rejects a failed code exchange', async () => {
    fetchSpy().mockImplementation(async () => ({ ok: false, json: async () => ({}) }));
    const res = await request(app).post('/api/auth/oauth/github/callback').send({ code: 'bad', state: await beginFlow() });
    expect(res.statusCode).toBe(401);
    expect(await db.User.countDocuments()).toBe(0);
  });

  it('cannot use an OAuth state token as a login token', async () => {
    const state = await beginFlow();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${state}`);
    expect(res.statusCode).toBe(403);
  });

  it('only offers providers that are configured', async () => {
    const res = await request(app).get('/api/auth/oauth/providers');
    expect(res.body.providers).toEqual(['GitHub']);
    expect((await request(app).get('/api/auth/oauth/google/start')).statusCode).toBe(404);
  });
});

describe('Injection through usernames', () => {
  it('treats regex characters in a username as text', async () => {
    await createUser('realuser');
    const res = await request(app).post('/api/auth/login').send({ username: '.*', password: 'whatever' });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid username or password.');
  });

  it('rejects non-string login values', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: { $ne: null }, password: { $ne: null } });
    expect(res.statusCode).toBe(400);
  });

  it('does not crash on search text that is an invalid regex', async () => {
    const res = await request(app).get('/api/wallpapers').query({ search: '(((' });
    expect(res.statusCode).toBe(200);
  });
});

describe('Roles', () => {
  it('stops owners from featuring their own uploads', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner);
    const res = await request(app).put(`/api/wallpapers/${wp.id}/feature`).set('Authorization', owner.auth);
    expect(res.statusCode).toBe(403);
    expect((await db.Wallpaper.findById(wp.id)).isFeatured).toBe(false);
  });

  it('lets admins feature, but not moderators', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner);
    const moderator = await createStaff('mod', 'moderator');
    const admin = await createStaff('boss');
    expect((await request(app).put(`/api/wallpapers/${wp.id}/feature`).set('Authorization', moderator.auth)).statusCode).toBe(403);
    expect((await request(app).put(`/api/wallpapers/${wp.id}/feature`).set('Authorization', admin.auth)).statusCode).toBe(200);
  });

  it('requires staff to have two-factor turned on', async () => {
    const admin = await createUser('no2fa', { role: 'admin' });
    const res = await request(app).get('/api/admin/stats').set('Authorization', admin.auth);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('TWO_FACTOR_REQUIRED');
  });

  it('cannot be escalated through the profile endpoint', async () => {
    const user = await createUser('climber');
    await request(app).put('/api/users/profile').set('Authorization', user.auth).send({ bio: 'hi', role: 'admin' });
    expect((await db.User.findById(user.id)).role).toBe('user');
  });

  it('only lets admins change roles, and not their own', async () => {
    const moderator = await createStaff('mod', 'moderator');
    const admin = await createStaff('boss');
    const user = await createUser('regular');
    const url = `/api/admin/users/${user.id}/role`;
    expect((await request(app).put(url).set('Authorization', moderator.auth).send({ role: 'admin' })).statusCode).toBe(403);
    expect((await request(app).put(url).set('Authorization', admin.auth).send({ role: 'moderator' })).statusCode).toBe(200);
    expect((await request(app).put(`/api/admin/users/${admin.id}/role`).set('Authorization', admin.auth).send({ role: 'user' })).statusCode).toBe(400);
  });
});

describe('Email & account recovery', () => {
  const register = (username, email) => request(app).post('/api/auth/register').send({ username, password: 'password123', email });

  it('verifies an email with a single-use link', async () => {
    await register('mailuser', 'Mail@Example.com');
    expect(testOutbox).toHaveLength(1);
    expect(testOutbox[0].to).toBe('mail@example.com');
    const token = tokenFrom(testOutbox[0]);

    expect((await request(app).post('/api/auth/verify-email').send({ token })).statusCode).toBe(200);
    expect((await db.User.findOne({ username: 'mailuser' })).emailVerified).toBe(true);
    expect((await request(app).post('/api/auth/verify-email').send({ token })).statusCode).toBe(400);
  });

  it('stores only a hash of account tokens', async () => {
    await register('mailuser', 'mail@example.com');
    const token = tokenFrom(testOutbox[0]);
    const stored = await db.AuthToken.findOne();
    expect(stored.tokenHash).not.toBe(token);
  });

  it('resets a password once, and signs out existing sessions', async () => {
    const user = await createUser('forgetful', { email: 'f@example.com', emailVerified: true, passwordHash: await hashPassword('oldpassword') });

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'f@example.com' });
    expect(forgot.statusCode).toBe(200);
    const token = tokenFrom(testOutbox[0]);

    expect((await request(app).get('/api/auth/me').set('Authorization', user.auth)).statusCode).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'newpassword' })).statusCode).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Authorization', user.auth)).statusCode).toBe(401);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'another1' })).statusCode).toBe(400);

    expect((await request(app).post('/api/auth/login').send({ username: 'forgetful', password: 'oldpassword' })).statusCode).toBe(400);
    expect((await request(app).post('/api/auth/login').send({ username: 'forgetful', password: 'newpassword' })).statusCode).toBe(200);
  });

  it('rejects expired reset tokens', async () => {
    await createUser('forgetful', { email: 'f@example.com', emailVerified: true });
    await request(app).post('/api/auth/forgot-password').send({ email: 'f@example.com' });
    await db.AuthToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await request(app).post('/api/auth/reset-password').send({ token: tokenFrom(testOutbox[0]), password: 'newpassword' });
    expect(res.statusCode).toBe(400);
  });

  it('answers the same whether or not an email is registered', async () => {
    await createUser('exists', { email: 'real@example.com', emailVerified: true });
    const known = await request(app).post('/api/auth/forgot-password').send({ email: 'real@example.com' });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(unknown.statusCode).toBe(known.statusCode);
    expect(unknown.body).toEqual(known.body);
    expect(testOutbox).toHaveLength(1);
  });

  it('does not send resets to unverified addresses, which anyone could have typed', async () => {
    await createUser('unverified', { email: 'typed@example.com', emailVerified: false });
    await request(app).post('/api/auth/forgot-password').send({ email: 'typed@example.com' });
    expect(testOutbox).toHaveLength(0);
  });

  it('requires the current password to change the recovery email', async () => {
    const user = await createUser('changer', { passwordHash: await hashPassword('rightpassword') });
    const wrong = await request(app).put('/api/auth/email').set('Authorization', user.auth).send({ email: 'evil@example.com', password: 'wrong' });
    expect(wrong.statusCode).toBe(400);
    const right = await request(app).put('/api/auth/email').set('Authorization', user.auth).send({ email: 'me@example.com', password: 'rightpassword' });
    expect(right.statusCode).toBe(200);
    expect(right.body.user.emailVerified).toBe(false);
  });

  it('refuses a duplicate email', async () => {
    await register('first', 'dup@example.com');
    expect((await register('second', 'DUP@example.com')).statusCode).toBe(400);
  });
});

describe('Two-factor authentication', () => {
  const setupUser = async () => {
    const user = await createUser('secure', { passwordHash: await hashPassword('password123') });
    const setup = await request(app).post('/api/auth/2fa/setup').set('Authorization', user.auth);
    const { secret } = setup.body;
    const code = totp.generateCode(secret, totp.currentStep());
    const enabled = await request(app).post('/api/auth/2fa/enable').set('Authorization', user.auth).send({ code });
    expect(enabled.statusCode).toBe(200);
    return { user, secret, recoveryCodes: enabled.body.recoveryCodes };
  };

  it('generates the published RFC 6238 test vector', () => {
    const secret = totp.base32Encode(Buffer.from('12345678901234567890'));
    // RFC 6238 test time 59s (step 1) gives 94287082; the app uses the last 6 digits.
    expect(totp.generateCode(secret, 1)).toBe('287082');
  });

  it('encrypts the secret at rest and hashes recovery codes', async () => {
    const { user, secret, recoveryCodes } = await setupUser();
    const stored = await db.User.findById(user.id);
    expect(stored.twoFactor.secret).not.toContain(secret);
    expect(stored.twoFactor.recoveryCodes).not.toContain(recoveryCodes[0]);
  });

  it('does not issue a login token until the code is confirmed', async () => {
    const { secret } = await setupUser();
    const login = await request(app).post('/api/auth/login').send({ username: 'secure', password: 'password123' });
    expect(login.body.twoFactorRequired).toBe(true);
    expect(login.body.token).toBeUndefined();

    // The challenge isn't itself a login token
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.challenge}`)).statusCode).toBe(403);

    const wrong = await request(app).post('/api/auth/2fa/verify').send({ challenge: login.body.challenge, code: '000000' });
    expect(wrong.statusCode).toBe(400);

    // Use the next step, because enabling already consumed the current one
    const code = totp.generateCode(secret, totp.currentStep() + 1);
    const right = await request(app).post('/api/auth/2fa/verify').send({ challenge: login.body.challenge, code });
    expect(right.statusCode).toBe(200);
    expect(right.body.token).toBeDefined();
  });

  it('refuses to accept the same code twice', async () => {
    const { secret } = await setupUser();
    const code = totp.generateCode(secret, totp.currentStep() + 1);
    const login = await request(app).post('/api/auth/login').send({ username: 'secure', password: 'password123' });
    expect((await request(app).post('/api/auth/2fa/verify').send({ challenge: login.body.challenge, code })).statusCode).toBe(200);
    expect((await request(app).post('/api/auth/2fa/verify').send({ challenge: login.body.challenge, code })).statusCode).toBe(400);
  });

  it('accepts a recovery code once', async () => {
    const { recoveryCodes } = await setupUser();
    const login = await request(app).post('/api/auth/login').send({ username: 'secure', password: 'password123' });
    const code = recoveryCodes[0];
    expect((await request(app).post('/api/auth/2fa/verify').send({ challenge: login.body.challenge, code })).statusCode).toBe(200);
    expect((await request(app).post('/api/auth/2fa/verify').send({ challenge: login.body.challenge, code })).statusCode).toBe(400);
  });

  it('does not let staff turn it off', async () => {
    const { user, recoveryCodes } = await setupUser();
    await db.User.updateOne({ _id: user.id }, { $set: { role: 'moderator' } });
    const res = await request(app).post('/api/auth/2fa/disable').set('Authorization', user.auth).send({ code: recoveryCodes[0] });
    expect(res.statusCode).toBe(403);
  });
});

describe('Reporting & moderation', () => {
  it('lets a user report once, and hides reported content when a moderator decides to', async () => {
    const owner = await createUser('owner');
    const reporter = await createUser('reporter');
    const moderator = await createStaff('mod', 'moderator');
    const wp = await createWallpaper(owner);
    const body = { targetType: 'wallpaper', targetId: wp.id, reason: 'copyright', details: 'Mine' };

    expect((await request(app).post('/api/reports').set('Authorization', reporter.auth).send(body)).statusCode).toBe(201);
    expect((await request(app).post('/api/reports').set('Authorization', reporter.auth).send(body)).statusCode).toBe(200);
    expect(await db.Report.countDocuments()).toBe(1);

    const queue = await request(app).get('/api/admin/reports').set('Authorization', moderator.auth);
    expect(queue.body.reports).toHaveLength(1);
    expect(queue.body.reports[0].target.label).toBe(wp.title);

    const handled = await request(app)
      .put(`/api/admin/reports/${queue.body.reports[0].id}`)
      .set('Authorization', moderator.auth)
      .send({ action: 'hide' });
    expect(handled.statusCode).toBe(200);

    const list = await request(app).get('/api/wallpapers');
    expect(list.body.wallpapers).toHaveLength(0);
    expect((await request(app).get(`/api/wallpapers/${wp.id}`)).statusCode).toBe(404);
    // The owner can still see it, and has been told
    expect((await request(app).get(`/api/wallpapers/${wp.id}`).set('Authorization', owner.auth)).statusCode).toBe(200);
    expect(await db.Notification.countDocuments({ userId: owner.id, type: 'moderation' })).toBe(1);
  });

  it('keeps hidden wallpapers out of every public listing', async () => {
    const owner = await createUser('owner');
    const follower = await createUser('follower', { following: [owner.id] });
    const hidden = await createWallpaper(owner, { status: 'hidden', isFeatured: true, tags: ['x'] });
    await createWallpaper(owner, { title: 'Visible', tags: ['x'] });

    const ids = (res) => (res.body.wallpapers || res.body).map((item) => String(item._id));
    expect(ids(await request(app).get('/api/wallpapers'))).not.toContain(hidden.id);
    expect(ids(await request(app).get('/api/wallpapers/featured'))).not.toContain(hidden.id);
    expect(ids(await request(app).get('/api/wallpapers/feed').set('Authorization', follower.auth))).not.toContain(hidden.id);
    expect((await request(app).get(`/api/users/profile/${owner.username}`)).body.wallpapers.map((w) => String(w._id))).not.toContain(hidden.id);
  });

  it('treats old records without a status as published', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner);
    await db.Wallpaper.collection.updateOne({ _id: wp._id }, { $unset: { status: '' } });
    const list = await request(app).get('/api/wallpapers');
    expect(list.body.wallpapers).toHaveLength(1);
  });

  it('blocks regular users from the moderation tools', async () => {
    const user = await createUser('regular');
    expect((await request(app).get('/api/admin/reports').set('Authorization', user.auth)).statusCode).toBe(403);
  });

  it('suspends immediately, including sessions already signed in', async () => {
    const target = await createUser('baduser', { passwordHash: await hashPassword('password123') });
    const moderator = await createStaff('mod', 'moderator');
    expect((await request(app).get('/api/auth/me').set('Authorization', target.auth)).statusCode).toBe(200);

    const res = await request(app).put(`/api/admin/users/${target.id}/status`).set('Authorization', moderator.auth).send({ suspended: true });
    expect(res.statusCode).toBe(200);

    expect((await request(app).get('/api/auth/me').set('Authorization', target.auth)).statusCode).toBe(403);
    expect((await request(app).post('/api/auth/login').send({ username: 'baduser', password: 'password123' })).statusCode).toBe(403);
  });

  it('does not let a moderator suspend another staff member', async () => {
    const moderator = await createStaff('mod', 'moderator');
    const admin = await createStaff('boss');
    const res = await request(app).put(`/api/admin/users/${admin.id}/status`).set('Authorization', moderator.auth).send({ suspended: true });
    expect(res.statusCode).toBe(403);
  });
});

describe('Licensing & attribution', () => {
  const upload = (user, fields) => request(app).post('/api/wallpapers/upload').set('Authorization', user.auth).send({
    title: 'Art', category: 'Nature', imageUrl: '/uploads/a.jpg', filename: 'a.jpg', ...fields
  });

  it('saves a license and source link, defaulting to the most restrictive common option', async () => {
    const user = await createUser('artist');
    const res = await upload(user, { license: 'cc-by', sourceUrl: 'https://example.com/art' });
    expect(res.body.wallpaper.license).toBe('cc-by');
    expect(res.body.wallpaper.sourceUrl).toBe('https://example.com/art');
    expect((await upload(user, {})).body.wallpaper.license).toBe('personal-use');
  });

  it('rejects an unknown license or a script link as the source', async () => {
    const user = await createUser('artist');
    expect((await upload(user, { license: 'free-for-all' })).statusCode).toBe(400);
    expect((await upload(user, { sourceUrl: 'javascript:alert(1)' })).statusCode).toBe(400);
  });
});

describe('Upload URL validation', () => {
  const attempt = (user, fields) => request(app).post('/api/wallpapers/upload').set('Authorization', user.auth).send({
    title: 'Art', category: 'Nature', imageUrl: '/uploads/a.jpg', filename: 'a.jpg', ...fields
  });

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://localhost:27017/',
    'https://evil.example.com/x.jpg',
    'https://res.cloudinary.com.evil.com/x.jpg',
    'file:///etc/passwd',
    '/uploads/../../.env'
  ])('refuses to accept %s as an image', async (imageUrl) => {
    const user = await createUser('attacker');
    const res = await attempt(user, { imageUrl, filename: 'a.jpg' });
    expect(res.statusCode).toBe(400);
    expect(await db.Wallpaper.countDocuments()).toBe(0);
  });

  it('accepts only this project\'s own Cloudinary account', async () => {
    const user = await createUser('artist');
    const original = config.CLOUDINARY_CLOUD_NAME;
    config.CLOUDINARY_CLOUD_NAME = 'mycloud';
    // This test is about validation; the worker must not try to download from the internet.
    const queue = jest.spyOn(require('../helper/queue'), 'enqueueImageProcess').mockResolvedValue();
    try {
      expect((await attempt(user, { imageUrl: 'https://res.cloudinary.com/othercloud/image/upload/x.jpg', filename: 'x' })).statusCode).toBe(400);
      expect((await attempt(user, { imageUrl: 'https://res.cloudinary.com/mycloud/image/upload/x.jpg', filename: 'folder/x' })).statusCode).toBe(201);
    } finally {
      config.CLOUDINARY_CLOUD_NAME = original;
      queue.mockRestore();
    }
  });

  it('refuses a filename that points outside the uploads folder', async () => {
    const user = await createUser('attacker');
    for (const filename of ['../app.js', '..\\app.js', 'sub/app.js']) {
      expect((await attempt(user, { filename })).statusCode).toBe(400);
    }
  });

  it('deleting an old record with a malicious filename stays inside the uploads folder', async () => {
    const owner = await createUser('owner');
    const outside = path.join(__dirname, '..', 'do-not-delete.tmp');
    fs.writeFileSync(outside, 'keep me');
    trackFile(outside);
    const wp = await createWallpaper(owner, { filename: '../do-not-delete.tmp' });

    const res = await request(app).delete(`/api/wallpapers/${wp.id}`).set('Authorization', owner.auth);
    expect(res.statusCode).toBe(200);
    expect(fs.existsSync(outside)).toBe(true);
  });
});

describe('Duplicate detection & image analysis', () => {
  it('gives near-identical images close hashes and different images distant ones', async () => {
    const a = await createImageFile('hash-a.png', { seed: 3, format: 'png' });
    const resized = await createImageFile('hash-a-resized.png', { seed: 3, format: 'png', width: 640, height: 360 });
    const other = await createImageFile('hash-b.png', { seed: 11, format: 'png' });
    const hashA = await computeDHash(a.filePath);
    expect(hammingDistance(hashA, await computeDHash(resized.filePath))).toBeLessThanOrEqual(5);
    expect(hammingDistance(hashA, await computeDHash(other.filePath))).toBeGreaterThan(5);
  });

  const processUpload = async (owner, name, options) => {
    const image = await createImageFile(name, options);
    const wp = await createWallpaper(owner, { imageUrl: image.url, filename: image.filename });
    trackFile(image.filePath.replace(/\.\w+$/, '.webp'));
    await processImageJob({ wpId: wp._id, filePath: image.filePath, imageUrl: image.url, isCloudinary: false, originalFilename: image.filename });
    return db.Wallpaper.findById(wp.id);
  };

  it('records dimensions and flags a repost for review without removing it', async () => {
    const owner = await createUser('original');
    const reposter = await createUser('reposter');

    const first = await processUpload(owner, 'dup-first.jpg', { seed: 5, width: 640, height: 360 });
    expect(first.width).toBe(640);
    expect(first.height).toBe(360);
    expect(first.orientation).toBe('landscape');
    expect(first.perceptualHash).toMatch(/^[0-9a-f]{16}$/);
    expect(first.duplicateOf).toBeNull();

    const second = await processUpload(reposter, 'dup-second.jpg', { seed: 5, width: 320, height: 180 });
    expect(String(second.duplicateOf)).toBe(first.id);
    expect(second.status).toBe('published');
    const report = await db.Report.findOne({ targetId: second._id });
    expect(report.reason).toBe('duplicate');
    expect(report.reporterId).toBeNull();

    const third = await processUpload(owner, 'dup-third.jpg', { seed: 13 });
    expect(third.duplicateOf).toBeNull();
  });
});

describe('Safe test and seed commands', () => {
  it('refuses to clear a database whose name does not end in _test', async () => {
    const realName = db.mongoose.connection.name;
    const descriptor = Object.getOwnPropertyDescriptor(db.mongoose.connection, 'name');
    db.mongoose.connection.name = 'AeroWall';
    const owner = await createUser('survivor');
    try {
      await expect(db.clearDb()).rejects.toThrow('clearDb refused');
      expect(await db.User.exists({ _id: owner.id })).toBeTruthy();
    } finally {
      if (descriptor) Object.defineProperty(db.mongoose.connection, 'name', descriptor);
      else db.mongoose.connection.name = realName;
    }
  });

  it('recognises test database names', () => {
    expect(db.isTestDatabaseName('feelowall_test')).toBe(true);
    expect(db.isTestDatabaseName('AeroWall')).toBe(false);
    expect(db.isTestDatabaseName('test')).toBe(false);
    expect(db.isTestDatabaseName('_testing')).toBe(false);
  });
});

describe('Backup & restore', () => {
  it('round-trips data with IDs and dates intact, and refuses to overwrite', async () => {
    const owner = await createUser('backupuser');
    const wp = await createWallpaper(owner, { tags: ['a'] });
    const folderRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'feelowall-backup-'));

    const { folder, manifest } = await backup(folderRoot);
    expect(manifest.collections.users).toBe(1);
    expect(manifest.collections.wallpapers).toBe(1);

    await expect(restore(folder)).rejects.toThrow('isn\'t empty');
    expect(await db.User.countDocuments()).toBe(1);

    await db.clearDb();
    await restore(folder);

    const restored = await db.Wallpaper.findById(wp.id);
    expect(restored.title).toBe(wp.title);
    expect(String(restored.uploadedById)).toBe(owner.id);
    expect(restored.uploadedAt).toBeInstanceOf(Date);
    expect((await request(app).get('/api/wallpapers')).body.wallpapers).toHaveLength(1);

    fs.rmSync(folderRoot, { recursive: true, force: true });
  });
});

describe('Health & errors', () => {
  it('reports health', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.database).toBe('up');
    expect(res.body.queue).toBe('in-memory');
  });

  it('removes credentials from logged text', () => {
    const text = 'failed mongodb+srv://user:hunter2@host/db with Bearer abc.def.ghi password: "s3cret" sk_live_abc123';
    const clean = redact(text);
    for (const secret of ['hunter2', 'abc.def.ghi', 's3cret', 'sk_live_abc123']) expect(clean).not.toContain(secret);
  });

  it('answers a malformed ID with 404 rather than an error', async () => {
    const owner = await createUser('owner');
    const res = await request(app).put('/api/wallpapers/not-an-id/publish').set('Authorization', owner.auth).send({ status: 'draft' });
    expect(res.statusCode).toBe(404);
  });
});

describe('Account deletion & export', () => {
  const makeAccount = async () => createUser('leaver', { passwordHash: await hashPassword('password123') });

  it('exports the user\'s data without secrets', async () => {
    const user = await makeAccount();
    await createWallpaper(user);
    const res = await request(app).get('/api/users/me/export').set('Authorization', user.auth);
    expect(res.statusCode).toBe(200);
    expect(res.body.account.username).toBe('leaver');
    expect(res.body.wallpapers).toHaveLength(1);
    const raw = JSON.stringify(res.body);
    for (const field of ['passwordHash', 'twoFactor', 'tokenVersion']) expect(raw).not.toContain(field);
  });

  it('requires the password', async () => {
    const user = await makeAccount();
    const res = await request(app).delete('/api/users/me').set('Authorization', user.auth).send({ password: 'wrong' });
    expect(res.statusCode).toBe(400);
    expect(await db.User.exists({ _id: user.id })).toBeTruthy();
  });

  it('removes the account and uploads, anonymises comments, and keeps payment records', async () => {
    const user = await makeAccount();
    const other = await createUser('other', { following: [user.id] });
    const mine = await createWallpaper(user);
    const theirs = await createWallpaper(other, { likes: [user.id], likesCount: 1 });
    const comment = await db.Comment.create({ wallpaperId: theirs._id, authorId: user.id, authorName: 'leaver', text: 'Nice' });
    const payment = await db.Payment.create({ type: 'tip', buyerId: user.id, creatorId: other.id, amountCents: 500, status: 'paid', stripeSessionId: 'cs_1' });

    const res = await request(app).delete('/api/users/me').set('Authorization', user.auth).send({ password: 'password123' });
    expect(res.statusCode).toBe(200);

    expect(await db.User.exists({ _id: user.id })).toBeNull();
    expect(await db.Wallpaper.exists({ _id: mine._id })).toBeNull();
    const liked = await db.Wallpaper.findById(theirs._id);
    expect(liked.likes).toHaveLength(0);
    expect(liked.likesCount).toBe(0);
    const anonymised = await db.Comment.findById(comment._id);
    expect(anonymised.text).toBe('[deleted]');
    expect(anonymised.authorId).toBeNull();
    expect((await db.User.findById(other.id)).following).toHaveLength(0);
    const kept = await db.Payment.findById(payment._id);
    expect(kept.buyerId).toBeNull();
    expect(kept.amountCents).toBe(500);

    // The old session stops working straight away
    expect((await request(app).get('/api/auth/me').set('Authorization', user.auth)).statusCode).toBe(401);
  });

  it('keeps wallpapers from packs people have bought', async () => {
    const seller = await makeAccount();
    const buyer = await createUser('buyer');
    const sold = await createWallpaper(seller, { status: 'pack-only' });
    const pack = await db.Pack.create({ title: 'P', creatorId: seller.id, creatorName: 'leaver', priceCents: 500, wallpapers: [sold._id], status: 'published' });
    await db.Payment.create({ type: 'pack', packId: pack._id, buyerId: buyer.id, creatorId: seller.id, amountCents: 500, status: 'paid', stripeSessionId: 'cs_2' });

    await request(app).delete('/api/users/me').set('Authorization', seller.auth).send({ password: 'password123' });

    expect(await db.Wallpaper.exists({ _id: sold._id })).toBeTruthy();
    expect((await db.Pack.findById(pack._id)).status).toBe('archived');
  });

  it('will not delete the only admin', async () => {
    const admin = await createStaff('onlyadmin');
    await db.User.updateOne({ _id: admin.id }, { $set: { passwordHash: await hashPassword('password123'), 'twoFactor.enabled': false } });
    const res = await request(app).delete('/api/users/me').set('Authorization', admin.auth).send({ password: 'password123' });
    expect(res.statusCode).toBe(400);
  });
});
