const request = require('supertest');
const app = require('../app');
const { recomputeTrending } = require('../helper/trending');
const { publishDueWallpapers, finalizeEndedChallenges, onWallpaperPublished } = require('../helper/publishing');
const { db, createUser, createStaff, createWallpaper, daysFromNow } = require('./helpers');

jest.setTimeout(60000);

beforeEach(async () => {
  await db.clearDb();
});

afterAll(async () => {
  await db.clearDb();
  await db.closeDb();
});

const startOfDay = (daysAgo = 0) => {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - daysAgo);
  return day;
};

describe('Comments', () => {
  it('posts threaded comments and notifies the owner and the person replied to', async () => {
    const owner = await createUser('owner');
    const alice = await createUser('alice');
    const bob = await createUser('bob');
    const wp = await createWallpaper(owner);
    const url = `/api/wallpapers/${wp.id}/comments`;

    const first = await request(app).post(url).set('Authorization', alice.auth).send({ text: 'Lovely' });
    expect(first.statusCode).toBe(201);
    const reply = await request(app).post(url).set('Authorization', bob.auth).send({ text: 'Agreed', parentId: first.body.comment.id });
    expect(reply.statusCode).toBe(201);

    const list = await request(app).get(url);
    expect(list.body.comments).toHaveLength(1);
    expect(list.body.comments[0].replies).toHaveLength(1);
    expect(list.body.total).toBe(2);

    expect(await db.Notification.countDocuments({ userId: owner.id, type: 'comment' })).toBe(1);
    expect(await db.Notification.countDocuments({ userId: alice.id, type: 'reply' })).toBe(1);
  });

  it('keeps threads one level deep', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner);
    const url = `/api/wallpapers/${wp.id}/comments`;
    const top = await request(app).post(url).set('Authorization', owner.auth).send({ text: 'Top' });
    const reply = await request(app).post(url).set('Authorization', owner.auth).send({ text: 'Reply', parentId: top.body.comment.id });
    const deep = await request(app).post(url).set('Authorization', owner.auth).send({ text: 'Deep', parentId: reply.body.comment.id });
    expect(deep.body.comment.parentId).toBe(top.body.comment.id);
  });

  it('validates text', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner);
    const url = `/api/wallpapers/${wp.id}/comments`;
    expect((await request(app).post(url).set('Authorization', owner.auth).send({ text: '   ' })).statusCode).toBe(400);
    expect((await request(app).post(url).set('Authorization', owner.auth).send({ text: 'x'.repeat(1001) })).statusCode).toBe(400);
    expect((await request(app).post(url).set('Authorization', owner.auth).send({ text: { $gt: '' } })).statusCode).toBe(400);
    expect((await request(app).post(url).send({ text: 'anonymous' })).statusCode).toBe(401);
  });

  it('only lets the author, wallpaper owner, or staff delete', async () => {
    const owner = await createUser('owner');
    const author = await createUser('author');
    const stranger = await createUser('stranger');
    const moderator = await createStaff('mod', 'moderator');
    const wp = await createWallpaper(owner);
    const post = async () => (await request(app).post(`/api/wallpapers/${wp.id}/comments`).set('Authorization', author.auth).send({ text: 'Hi' })).body.comment.id;

    const a = await post();
    expect((await request(app).delete(`/api/comments/${a}`).set('Authorization', stranger.auth)).statusCode).toBe(403);
    expect((await request(app).delete(`/api/comments/${a}`).set('Authorization', author.auth)).statusCode).toBe(200);
    expect((await request(app).delete(`/api/comments/${await post()}`).set('Authorization', owner.auth)).statusCode).toBe(200);
    expect((await request(app).delete(`/api/comments/${await post()}`).set('Authorization', moderator.auth)).statusCode).toBe(200);
  });

  it('keeps a placeholder for a removed comment with replies, and drops one without', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner);
    const url = `/api/wallpapers/${wp.id}/comments`;
    const parent = await request(app).post(url).set('Authorization', owner.auth).send({ text: 'Secret text' });
    await request(app).post(url).set('Authorization', owner.auth).send({ text: 'Reply', parentId: parent.body.comment.id });
    const lonely = await request(app).post(url).set('Authorization', owner.auth).send({ text: 'Alone' });

    await request(app).delete(`/api/comments/${parent.body.comment.id}`).set('Authorization', owner.auth);
    await request(app).delete(`/api/comments/${lonely.body.comment.id}`).set('Authorization', owner.auth);

    const list = await request(app).get(url);
    expect(list.body.comments).toHaveLength(1);
    expect(list.body.comments[0].removed).toBe(true);
    expect(list.body.comments[0].text).toBe('');
    expect(JSON.stringify(list.body)).not.toContain('Secret text');
  });

  it('hides comments on wallpapers the viewer cannot see', async () => {
    const owner = await createUser('owner');
    const draft = await createWallpaper(owner, { status: 'draft' });
    expect((await request(app).get(`/api/wallpapers/${draft.id}/comments`)).statusCode).toBe(404);
  });
});

describe('Notifications', () => {
  it('groups repeat likes into one message, and starts a new one after reading', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner, { title: 'Dawn' });
    for (const name of ['ana', 'ben', 'cal']) {
      const fan = await createUser(name);
      await request(app).post(`/api/wallpapers/${wp.id}/like`).set('Authorization', fan.auth);
    }

    const list = await request(app).get('/api/notifications').set('Authorization', owner.auth);
    expect(list.body.notifications).toHaveLength(1);
    expect(list.body.notifications[0].message).toBe('cal and 2 others liked "Dawn"');
    expect(list.body.unreadCount).toBe(1);

    await request(app).post('/api/notifications/read').set('Authorization', owner.auth).send({});
    expect((await request(app).get('/api/notifications/unread-count').set('Authorization', owner.auth)).body.unreadCount).toBe(0);

    const late = await createUser('dee');
    await request(app).post(`/api/wallpapers/${wp.id}/like`).set('Authorization', late.auth);
    const again = await request(app).get('/api/notifications').set('Authorization', owner.auth);
    expect(again.body.notifications).toHaveLength(2);
    expect(again.body.notifications[0].message).toBe('dee liked "Dawn"');
  });

  it('does not notify people about their own actions', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner);
    await request(app).post(`/api/wallpapers/${wp.id}/like`).set('Authorization', owner.auth);
    expect(await db.Notification.countDocuments()).toBe(0);
  });

  it('only shows a user their own notifications, and only they can mark them read', async () => {
    const owner = await createUser('owner');
    const stranger = await createUser('stranger');
    const fan = await createUser('fan');
    const wp = await createWallpaper(owner);
    await request(app).post(`/api/wallpapers/${wp.id}/like`).set('Authorization', fan.auth);

    expect((await request(app).get('/api/notifications').set('Authorization', stranger.auth)).body.notifications).toHaveLength(0);
    const note = await db.Notification.findOne({ userId: owner.id });
    await request(app).post('/api/notifications/read').set('Authorization', stranger.auth).send({ ids: [note.id] });
    expect((await db.Notification.findById(note.id)).read).toBe(false);
  });

  it('notifies on follows, collection invites, and uploads from followed creators', async () => {
    const creator = await createUser('creator');
    const fan = await createUser('fan');
    await request(app).post(`/api/users/follow/${creator.username}`).set('Authorization', fan.auth);
    expect(await db.Notification.countDocuments({ userId: creator.id, type: 'follow' })).toBe(1);

    const playlist = await db.Playlist.create({ name: 'List', creator: creator.username, creatorId: creator.id });
    await request(app).post(`/api/playlists/${playlist.id}/contributors`).set('Authorization', creator.auth).send({ username: 'fan' });
    expect(await db.Notification.countDocuments({ userId: fan.id, type: 'collection-invite' })).toBe(1);

    await request(app).post('/api/wallpapers/upload').set('Authorization', creator.auth)
      .send({ title: 'New', category: 'Nature', imageUrl: '/uploads/n.jpg', filename: 'n.jpg' });
    expect(await db.Notification.countDocuments({ userId: fan.id, type: 'upload' })).toBe(1);
  });
});

describe('Challenges', () => {
  const inPhase = (phase) => ({
    submissions: { submissionsStartAt: daysFromNow(-1), submissionsEndAt: daysFromNow(1), votingEndAt: daysFromNow(2) },
    voting: { submissionsStartAt: daysFromNow(-2), submissionsEndAt: daysFromNow(-1), votingEndAt: daysFromNow(1) },
    ended: { submissionsStartAt: daysFromNow(-3), submissionsEndAt: daysFromNow(-2), votingEndAt: daysFromNow(-1) },
    upcoming: { submissionsStartAt: daysFromNow(1), submissionsEndAt: daysFromNow(2), votingEndAt: daysFromNow(3) }
  }[phase]);

  const makeChallenge = async (phase) => {
    const admin = await createStaff(`admin${Math.random().toString(36).slice(2, 7)}`);
    return db.Challenge.create({ title: 'Neon', createdBy: admin.id, ...inPhase(phase) });
  };

  it('only lets admins create challenges, with dates in order', async () => {
    const admin = await createStaff('boss');
    const user = await createUser('user');
    const body = { title: 'Space', ...inPhase('upcoming') };
    expect((await request(app).post('/api/challenges').set('Authorization', user.auth).send(body)).statusCode).toBe(403);
    expect((await request(app).post('/api/challenges').set('Authorization', admin.auth).send(body)).statusCode).toBe(201);
    const backwards = { title: 'Bad', submissionsStartAt: daysFromNow(3), submissionsEndAt: daysFromNow(2), votingEndAt: daysFromNow(1) };
    expect((await request(app).post('/api/challenges').set('Authorization', admin.auth).send(backwards)).statusCode).toBe(400);
  });

  it('accepts your own published wallpaper, during the submission window only', async () => {
    const owner = await createUser('owner');
    const stranger = await createUser('stranger');
    const wp = await createWallpaper(owner);
    const draft = await createWallpaper(owner, { status: 'draft' });
    const open = await makeChallenge('submissions');
    const url = `/api/challenges/${open.id}/submit`;

    expect((await request(app).post(url).set('Authorization', stranger.auth).send({ wallpaperId: wp.id })).statusCode).toBe(403);
    expect((await request(app).post(url).set('Authorization', owner.auth).send({ wallpaperId: draft.id })).statusCode).toBe(400);
    expect((await request(app).post(url).set('Authorization', owner.auth).send({ wallpaperId: wp.id })).statusCode).toBe(201);
    expect((await request(app).post(url).set('Authorization', owner.auth).send({ wallpaperId: wp.id })).statusCode).toBe(400);

    const closed = await makeChallenge('voting');
    expect((await request(app).post(`/api/challenges/${closed.id}/submit`).set('Authorization', owner.auth).send({ wallpaperId: wp.id })).statusCode).toBe(400);
  });

  it('allows one vote per person, never for yourself, and hides counts until the end', async () => {
    const entrant = await createUser('entrant');
    const voter = await createUser('voter');
    const wp = await createWallpaper(entrant);
    const challenge = await makeChallenge('voting');
    const submission = await db.ChallengeSubmission.create({ challengeId: challenge.id, wallpaperId: wp.id, userId: entrant.id });
    const url = `/api/challenges/${challenge.id}/vote`;

    expect((await request(app).post(url).set('Authorization', entrant.auth).send({ submissionId: submission.id })).statusCode).toBe(400);
    expect((await request(app).post(url).set('Authorization', voter.auth).send({ submissionId: submission.id })).statusCode).toBe(200);
    expect((await request(app).post(url).set('Authorization', voter.auth).send({ submissionId: submission.id })).statusCode).toBe(400);
    expect((await db.ChallengeSubmission.findById(submission.id)).votes).toBe(1);

    const detail = await request(app).get(`/api/challenges/${challenge.id}`).set('Authorization', voter.auth);
    expect(detail.body.submissions[0].votes).toBeNull();
    expect(detail.body.myVoteSubmissionId).toBe(submission.id);
  });

  it('counts simultaneous duplicate votes only once', async () => {
    const entrant = await createUser('entrant');
    const voter = await createUser('voter');
    const wp = await createWallpaper(entrant);
    const challenge = await makeChallenge('voting');
    const submission = await db.ChallengeSubmission.create({ challengeId: challenge.id, wallpaperId: wp.id, userId: entrant.id });
    await db.ChallengeVote.init();

    await Promise.all(Array.from({ length: 5 }, () => request(app)
      .post(`/api/challenges/${challenge.id}/vote`).set('Authorization', voter.auth).send({ submissionId: submission.id })));

    expect(await db.ChallengeVote.countDocuments()).toBe(1);
    expect((await db.ChallengeSubmission.findById(submission.id)).votes).toBe(1);
  });

  it('blocks voting outside the voting window', async () => {
    const entrant = await createUser('entrant');
    const voter = await createUser('voter');
    const wp = await createWallpaper(entrant);
    const challenge = await makeChallenge('submissions');
    const submission = await db.ChallengeSubmission.create({ challengeId: challenge.id, wallpaperId: wp.id, userId: entrant.id });
    const res = await request(app).post(`/api/challenges/${challenge.id}/vote`).set('Authorization', voter.auth).send({ submissionId: submission.id });
    expect(res.statusCode).toBe(400);
  });

  it('picks winners once, awards a badge shown on the profile, and handles ties', async () => {
    const champ = await createUser('champ');
    const tied = await createUser('tied');
    const loser = await createUser('loser');
    const challenge = await makeChallenge('ended');
    const entry = async (owner, votes) => db.ChallengeSubmission.create({
      challengeId: challenge.id, wallpaperId: (await createWallpaper(owner))._id, userId: owner.id, votes
    });
    await entry(champ, 5);
    await entry(tied, 5);
    await entry(loser, 1);

    expect(await finalizeEndedChallenges()).toBe(1);
    expect(await finalizeEndedChallenges()).toBe(0);

    expect((await db.Challenge.findById(challenge.id)).winnerIds).toHaveLength(2);
    expect((await db.User.findById(champ.id)).badges).toHaveLength(1);
    expect((await db.User.findById(tied.id)).badges).toHaveLength(1);
    expect((await db.User.findById(loser.id)).badges).toHaveLength(0);
    expect(await db.Notification.countDocuments({ userId: champ.id, type: 'challenge-win' })).toBe(1);

    const profile = await request(app).get('/api/users/profile/champ');
    expect(profile.body.achievements.some((item) => item.name === 'Challenge Winner' && item.unlocked)).toBe(true);

    const detail = await request(app).get(`/api/challenges/${challenge.id}`);
    expect(detail.body.submissions[0].votes).toBe(5);
    expect(detail.body.submissions.filter((row) => row.isWinner)).toHaveLength(2);
  });

  it('declares no winner if nobody voted', async () => {
    const entrant = await createUser('entrant');
    const challenge = await makeChallenge('ended');
    await db.ChallengeSubmission.create({ challengeId: challenge.id, wallpaperId: (await createWallpaper(entrant))._id, userId: entrant.id });
    await finalizeEndedChallenges();
    expect((await db.Challenge.findById(challenge.id)).winnerIds).toHaveLength(0);
    expect((await db.User.findById(entrant.id)).badges).toHaveLength(0);
  });
});

describe('Verified badge', () => {
  it('can only be granted by an admin, and appears on the profile', async () => {
    const admin = await createStaff('boss');
    const moderator = await createStaff('mod', 'moderator');
    const creator = await createUser('creator');
    const url = `/api/admin/users/${creator.id}/verified`;

    expect((await request(app).put(url).set('Authorization', creator.auth).send({ isVerified: true })).statusCode).toBe(403);
    expect((await request(app).put(url).set('Authorization', moderator.auth).send({ isVerified: true })).statusCode).toBe(403);
    expect((await request(app).put(url).set('Authorization', admin.auth).send({ isVerified: true })).statusCode).toBe(200);
    expect((await request(app).get('/api/users/profile/creator')).body.isVerified).toBe(true);
  });
});

describe('Leaderboards', () => {
  const activity = (wallpaper, owner, daysAgo, stats) => db.DailyAnalytics.create({
    wallpaperId: wallpaper._id, creatorId: owner.id, date: startOfDay(daysAgo), ...stats
  });

  it('ranks by weighted activity within the period and leaves out suspended creators', async () => {
    const top = await createUser('top');
    const second = await createUser('second');
    const old = await createUser('old');
    const banned = await createUser('banned', { status: 'suspended' });
    await activity(await createWallpaper(top), top, 1, { views: 10, downloads: 10, likes: 10 });
    await activity(await createWallpaper(second), second, 1, { views: 50 });
    await activity(await createWallpaper(old), old, 20, { views: 500 });
    await activity(await createWallpaper(banned), banned, 1, { views: 9999 });

    const week = await request(app).get('/api/users/leaderboard').query({ period: 'week' });
    expect(week.body.creators.map((row) => row.username)).toEqual(['top', 'second']);
    expect(week.body.creators[0]).toMatchObject({ rank: 1, score: 90 });

    const month = await request(app).get('/api/users/leaderboard').query({ period: 'month' });
    expect(month.body.creators.map((row) => row.username)).toEqual(['old', 'top', 'second']);
  });
});

describe('Trending', () => {
  it('favors recent activity over a larger old total, and clears stale scores', async () => {
    const owner = await createUser('owner');
    const fresh = await createWallpaper(owner, { title: 'Fresh', likesCount: 1 });
    const old = await createWallpaper(owner, { title: 'Old classic', likesCount: 100 });
    const quiet = await createWallpaper(owner, { title: 'Quiet', trendingScore: 500 });
    await db.DailyAnalytics.create({ wallpaperId: fresh._id, creatorId: owner.id, date: startOfDay(0), views: 20, likes: 2 });
    await db.DailyAnalytics.create({ wallpaperId: old._id, creatorId: owner.id, date: startOfDay(12), views: 100, likes: 10 });

    await recomputeTrending();

    const list = await request(app).get('/api/wallpapers').query({ sortBy: 'trending' });
    expect(list.body.wallpapers.map((wp) => wp.title).slice(0, 2)).toEqual(['Fresh', 'Old classic']);
    expect((await db.Wallpaper.findById(quiet._id)).trendingScore).toBe(0);
    expect((await request(app).get('/api/wallpapers').query({ sortBy: 'likes' })).body.wallpapers[0].title).toBe('Old classic');
  });

  it('does not let net un-likes push a score below zero', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner);
    await db.DailyAnalytics.create({ wallpaperId: wp._id, creatorId: owner.id, date: startOfDay(0), likes: -5 });
    await recomputeTrending();
    expect((await db.Wallpaper.findById(wp._id)).trendingScore).toBe(0);
  });
});

describe('Filters', () => {
  it('filters by resolution, orientation, and aspect ratio', async () => {
    const owner = await createUser('owner');
    await createWallpaper(owner, { title: '4K', width: 3840, height: 2160, aspectRatio: 1.778, orientation: 'landscape' });
    await createWallpaper(owner, { title: 'Ultrawide', width: 3440, height: 1440, aspectRatio: 2.389, orientation: 'landscape' });
    await createWallpaper(owner, { title: 'Phone', width: 1170, height: 2532, aspectRatio: 0.462, orientation: 'portrait' });
    await createWallpaper(owner, { title: 'Unknown size' });

    const titles = async (query) => (await request(app).get('/api/wallpapers').query(query)).body.wallpapers.map((wp) => wp.title).sort();
    expect(await titles({ resolution: '4k' })).toEqual(['4K']);
    expect(await titles({ resolution: '1440p' })).toEqual(['4K', 'Ultrawide']);
    expect(await titles({ orientation: 'portrait' })).toEqual(['Phone']);
    expect(await titles({ aspect: 'ultrawide' })).toEqual(['Ultrawide']);
    expect(await titles({ aspect: 'phone' })).toEqual(['Phone']);
    expect(await titles({ resolution: 'nonsense' })).toHaveLength(4);
  });

  it('caps page size, and has a default', async () => {
    const owner = await createUser('owner');
    await db.Wallpaper.insertMany(Array.from({ length: 30 }, (_, i) => ({
      title: `W${i}`, category: 'Nature', imageUrl: '/uploads/x.jpg', filename: 'x.jpg', uploadedBy: owner.username, uploadedById: owner.id
    })));
    const byDefault = await request(app).get('/api/wallpapers');
    expect(byDefault.body.wallpapers).toHaveLength(24);
    expect(byDefault.body.hasMore).toBe(true);
    expect(byDefault.body.total).toBe(30);
    expect((await request(app).get('/api/wallpapers').query({ limit: 100000 })).body.wallpapers).toHaveLength(30);
  });
});

describe('Tags', () => {
  it('filters by tag, ignoring case, and autocompletes by popularity', async () => {
    const owner = await createUser('owner');
    await createWallpaper(owner, { title: 'A', tags: ['neon', 'city'] });
    await createWallpaper(owner, { title: 'B', tags: ['Neon'] });
    await createWallpaper(owner, { title: 'C', tags: ['nature'] });
    await createWallpaper(owner, { title: 'Hidden', tags: ['neon-secret'], status: 'draft' });

    const tagged = await request(app).get('/api/wallpapers').query({ tag: 'NEON' });
    expect(tagged.body.wallpapers.map((wp) => wp.title).sort()).toEqual(['A', 'B']);

    const suggestions = await request(app).get('/api/wallpapers/tags').query({ q: 'ne' });
    expect(suggestions.body.tags).toEqual([{ tag: 'neon', count: 2 }]);

    const special = await request(app).get('/api/wallpapers/tags').query({ q: '(.*' });
    expect(special.statusCode).toBe(200);
    expect(special.body.tags).toHaveLength(0);
  });
});

describe('For You', () => {
  it('falls back to trending for new users', async () => {
    const owner = await createUser('owner');
    const newcomer = await createUser('newcomer');
    await createWallpaper(owner, { title: 'Low', trendingScore: 1 });
    await createWallpaper(owner, { title: 'High', trendingScore: 9 });
    const res = await request(app).get('/api/wallpapers/for-you').set('Authorization', newcomer.auth);
    expect(res.body.personalized).toBe(false);
    expect(res.body.wallpapers[0].title).toBe('High');
  });

  it('ranks by what the user likes and follows, and leaves out their own and liked work', async () => {
    const artist = await createUser('artist');
    const followed = await createUser('followed');
    const me = await createUser('myself', { following: [followed.id] });
    const colors = [{ hex: '#ff0000', r: 255, g: 0, b: 0 }];
    await createWallpaper(artist, { title: 'Liked', category: 'Space', tags: ['nebula'], colors, likes: [me.id] });
    await createWallpaper(artist, { title: 'Match', category: 'Space', tags: ['nebula'], colors });
    await createWallpaper(followed, { title: 'From followed', category: 'Nature' });
    await createWallpaper(artist, { title: 'Unrelated', category: 'Nature', tags: ['forest'], colors: [{ hex: '#00ff00', r: 0, g: 255, b: 0 }] });
    await createWallpaper(me, { title: 'Mine', category: 'Space', tags: ['nebula'], colors });

    const res = await request(app).get('/api/wallpapers/for-you').set('Authorization', me.auth);
    const titles = res.body.wallpapers.map((wp) => wp.title);
    expect(res.body.personalized).toBe(true);
    expect(titles).not.toContain('Liked');
    expect(titles).not.toContain('Mine');
    expect(titles[titles.length - 1]).toBe('Unrelated');
    expect(titles.indexOf('Match')).toBeLessThan(titles.indexOf('Unrelated'));
  });

  it('requires signing in', async () => {
    expect((await request(app).get('/api/wallpapers/for-you')).statusCode).toBe(401);
  });
});

describe('Share pages, SEO, RSS & embeds', () => {
  it('serves preview tags, escaping titles to prevent script injection', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner, { title: '"><script>alert(1)</script>', altText: '' });
    const res = await request(app).get(`/share/wallpaper/${wp.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('property="og:title"');
    expect(res.text).toContain('property="og:image"');
    expect(res.text).toContain('twitter:card');
    expect(res.text).not.toContain('<script>alert(1)');
    expect(res.text).toContain('&lt;script&gt;');
  });

  it('gives no preview of private or hidden content', async () => {
    const owner = await createUser('owner');
    const hidden = await createWallpaper(owner, { title: 'Hidden title', status: 'hidden' });
    const secret = await db.Playlist.create({ name: 'Private list', isPublic: false, creator: owner.username, creatorId: owner.id });
    const a = await request(app).get(`/share/wallpaper/${hidden.id}`);
    expect(a.statusCode).toBe(404);
    expect(a.text).not.toContain('Hidden title');
    const b = await request(app).get(`/share/playlist/${secret.id}`);
    expect(b.statusCode).toBe(404);
    expect(b.text).not.toContain('Private list');
    expect((await request(app).get('/share/wallpaper/not-an-id')).statusCode).toBe(404);
  });

  it('lists only public content in the sitemap', async () => {
    const owner = await createUser('owner');
    const open = await createWallpaper(owner);
    const draft = await createWallpaper(owner, { status: 'draft' });
    const res = await request(app).get('/sitemap.xml');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain(`/wallpaper/${open.id}`);
    expect(res.text).not.toContain(`/wallpaper/${draft.id}`);
    expect((await request(app).get('/robots.txt')).text).toContain('Sitemap:');
  });

  it('publishes RSS for creators and tags, with public items only', async () => {
    const owner = await createUser('owner');
    await createWallpaper(owner, { title: 'Public <art>', tags: ['neon'] });
    await createWallpaper(owner, { title: 'Draft art', tags: ['neon'], status: 'draft' });

    const creator = await request(app).get('/rss/creator/owner').buffer(true);
    expect(creator.statusCode).toBe(200);
    expect(creator.headers['content-type']).toContain('application/rss+xml');
    expect(creator.text).toContain('Public &lt;art&gt;');
    expect(creator.text).not.toContain('Draft art');

    const tag = await request(app).get('/rss/tag/neon').buffer(true);
    expect(tag.text).toContain('Public &lt;art&gt;');
    expect((await request(app).get('/rss/creator/nobody')).statusCode).toBe(404);
  });

  it('serves embeds that other sites may frame, with scripts blocked', async () => {
    const owner = await createUser('owner');
    const wp = await createWallpaper(owner);
    const res = await request(app).get(`/embed/wallpaper/${wp.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-security-policy']).toContain('frame-ancestors *');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.headers['x-frame-options']).toBeUndefined();

    const secret = await db.Playlist.create({ name: 'Private', isPublic: false, creator: owner.username, creatorId: owner.id });
    expect((await request(app).get(`/embed/playlist/${secret.id}`)).statusCode).toBe(404);
  });
});

describe('Saved searches', () => {
  it('alerts on a new match, not on non-matches, the uploader, or muted alerts', async () => {
    const uploader = await createUser('uploader');
    const watcher = await createUser('watcher');
    const silent = await createUser('silent');
    const auth = (user) => ({ Authorization: user.auth });
    await request(app).post('/api/saved-searches').set(auth(watcher)).send({ search: 'neon', name: 'Neon stuff' });
    await request(app).post('/api/saved-searches').set(auth(uploader)).send({ search: 'neon' });
    await request(app).post('/api/saved-searches').set(auth(silent)).send({ search: 'neon', alertsEnabled: false });

    await onWallpaperPublished(await createWallpaper(uploader, { title: 'Forest', tags: ['green'] }));
    expect(await db.Notification.countDocuments({ type: 'saved-search' })).toBe(0);

    await onWallpaperPublished(await createWallpaper(uploader, { title: 'Neon city' }));
    const notes = await db.Notification.find({ type: 'saved-search' });
    expect(notes).toHaveLength(1);
    expect(String(notes[0].userId)).toBe(watcher.id);
    expect(notes[0].text).toContain('Neon stuff');
  });

  it('matches by tag and category, and treats search text literally', async () => {
    const uploader = await createUser('uploader');
    const watcher = await createUser('watcher');
    await request(app).post('/api/saved-searches').set('Authorization', watcher.auth).send({ tag: 'Space', category: 'Nature' });
    await request(app).post('/api/saved-searches').set('Authorization', watcher.auth).send({ search: '(((' });

    await onWallpaperPublished(await createWallpaper(uploader, { category: 'Anime', tags: ['space'] }));
    expect(await db.Notification.countDocuments()).toBe(0);
    await onWallpaperPublished(await createWallpaper(uploader, { category: 'Nature', tags: ['space'] }));
    expect(await db.Notification.countDocuments()).toBe(1);
  });

  it('requires something to search for, and keeps searches private to their owner', async () => {
    const owner = await createUser('owner');
    const stranger = await createUser('stranger');
    expect((await request(app).post('/api/saved-searches').set('Authorization', owner.auth).send({ category: 'All' })).statusCode).toBe(400);
    const saved = await request(app).post('/api/saved-searches').set('Authorization', owner.auth).send({ search: 'cats' });
    const url = `/api/saved-searches/${saved.body.search._id}`;
    expect((await request(app).delete(url).set('Authorization', stranger.auth)).statusCode).toBe(404);
    expect((await request(app).get('/api/saved-searches').set('Authorization', stranger.auth)).body.searches).toHaveLength(0);
    expect((await request(app).delete(url).set('Authorization', owner.auth)).statusCode).toBe(200);
  });
});

describe('Follow tags & content preferences', () => {
  it('adds followed tags to the feed', async () => {
    const creator = await createUser('creator');
    const me = await createUser('myself');
    await createWallpaper(creator, { title: 'Tagged', tags: ['neon'] });
    await createWallpaper(creator, { title: 'Other', tags: ['forest'] });

    expect((await request(app).get('/api/wallpapers/feed').set('Authorization', me.auth)).body.wallpapers).toHaveLength(0);
    const follow = await request(app).post('/api/users/tags/Neon/follow').set('Authorization', me.auth);
    expect(follow.body.active).toBe(true);
    const feed = await request(app).get('/api/wallpapers/feed').set('Authorization', me.auth);
    expect(feed.body.wallpapers.map((wp) => wp.title)).toEqual(['Tagged']);

    expect((await request(app).post('/api/users/tags/neon/follow').set('Authorization', me.auth)).body.active).toBe(false);
  });

  it('hides mature content by default, for signed-out visitors and everywhere public', async () => {
    const owner = await createUser('owner');
    const adult = await createWallpaper(owner, { title: 'Mature', isMature: true });
    await createWallpaper(owner, { title: 'General' });
    const me = await createUser('myself');

    const titles = async (req) => (await req).body.wallpapers.map((wp) => wp.title);
    expect(await titles(request(app).get('/api/wallpapers'))).toEqual(['General']);
    expect(await titles(request(app).get('/api/wallpapers').set('Authorization', me.auth))).toEqual(['General']);

    expect((await request(app).get(`/share/wallpaper/${adult.id}`)).statusCode).toBe(404);

    await request(app).put('/api/users/preferences').set('Authorization', me.auth).send({ showMature: true });
    expect((await titles(request(app).get('/api/wallpapers').set('Authorization', me.auth))).sort()).toEqual(['General', 'Mature']);
    // A request can't opt itself in without an account preference.
    expect(await titles(request(app).get('/api/wallpapers').query({ showMature: 'true' }))).toEqual(['General']);
  });

  it('applies muted creators and tags, and does not put personalised lists in shared caches', async () => {
    const annoying = await createUser('annoying');
    const fine = await createUser('fine');
    const me = await createUser('myself');
    await createWallpaper(annoying, { title: 'Muted creator' });
    await createWallpaper(fine, { title: 'Muted tag', tags: ['spiders'] });
    await createWallpaper(fine, { title: 'Kept' });

    await request(app).post('/api/users/mute/annoying').set('Authorization', me.auth);
    await request(app).post('/api/users/tags/spiders/mute').set('Authorization', me.auth);

    const mine = await request(app).get('/api/wallpapers').set('Authorization', me.auth);
    expect(mine.body.wallpapers.map((wp) => wp.title)).toEqual(['Kept']);
    expect(mine.headers['cache-control']).toContain('private');

    const anonymous = await request(app).get('/api/wallpapers');
    expect(anonymous.body.wallpapers).toHaveLength(3);
    expect(anonymous.headers['cache-control']).toContain('public');

    const muted = await request(app).get('/api/users/muted').set('Authorization', me.auth);
    expect(muted.body).toEqual({ users: ['annoying'], tags: ['spiders'] });
  });

  it('still serves public pages when a browser sends an expired or bad token', async () => {
    const res = await request(app).get('/api/wallpapers').set('Authorization', 'Bearer expired.or.garbage');
    expect(res.statusCode).toBe(200);
  });
});

describe('Download history', () => {
  it('records signed-in downloads once each, newest first, and can be cleared', async () => {
    const owner = await createUser('owner');
    const me = await createUser('myself');
    const a = await createWallpaper(owner, { title: 'A' });
    const b = await createWallpaper(owner, { title: 'B' });
    const download = (wp) => request(app).post(`/api/wallpapers/${wp.id}/download`).set('Authorization', me.auth);

    await download(a);
    await download(b);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await download(a);

    const history = await request(app).get('/api/users/me/downloads').set('Authorization', me.auth);
    expect(history.body.downloads.map((row) => row.wallpaper.title)).toEqual(['A', 'B']);

    await request(app).delete(`/api/users/me/downloads/${history.body.downloads[0].id}`).set('Authorization', me.auth);
    expect((await request(app).get('/api/users/me/downloads').set('Authorization', me.auth)).body.downloads).toHaveLength(1);
    await request(app).delete('/api/users/me/downloads').set('Authorization', me.auth);
    expect((await request(app).get('/api/users/me/downloads').set('Authorization', me.auth)).body.downloads).toHaveLength(0);
  });

  it('counts anonymous downloads without a history, and keeps history private', async () => {
    const owner = await createUser('owner');
    const stranger = await createUser('stranger');
    const wp = await createWallpaper(owner);
    expect((await request(app).post(`/api/wallpapers/${wp.id}/download`)).statusCode).toBe(200);
    expect(await db.DownloadHistory.countDocuments()).toBe(0);
    await request(app).post(`/api/wallpapers/${wp.id}/download`).set('Authorization', owner.auth);
    expect((await request(app).get('/api/users/me/downloads').set('Authorization', stranger.auth)).body.downloads).toHaveLength(0);
  });
});

describe('Liked wallpapers', () => {
  it('lists only your own likes, keeps working past one page, and hides the likes list', async () => {
    const owner = await createUser('owner');
    const fan = await createUser('fan');
    const other = await createUser('other');
    await db.Wallpaper.insertMany(Array.from({ length: 30 }, (_, i) => ({
      title: `Liked ${i}`, category: 'Nature', imageUrl: '/uploads/x.jpg', filename: 'x.jpg', uploadedBy: owner.username, uploadedById: owner.id, likes: [fan.id]
    })));
    await createWallpaper(owner, { title: 'Hidden like', likes: [fan.id], status: 'hidden' });
    await createWallpaper(owner, { title: 'Not liked', likes: [other.id] });

    const res = await request(app).get('/api/wallpapers/liked').query({ limit: 100 }).set('Authorization', fan.auth);
    expect(res.body.total).toBe(30);
    expect(res.body.wallpapers).toHaveLength(30);
    expect(res.body.wallpapers[0].likes).toBeUndefined();
    expect((await request(app).get('/api/wallpapers/liked')).statusCode).toBe(401);
  });
});

describe('Scheduled publishing helper', () => {
  it('publishes once, even if run twice', async () => {
    const owner = await createUser('owner');
    const fan = await createUser('fan', { following: [owner.id] });
    await createWallpaper(owner, { status: 'scheduled', scheduledAt: daysFromNow(-1) });
    await createWallpaper(owner, { status: 'scheduled', scheduledAt: daysFromNow(1) });

    expect(await publishDueWallpapers()).toBe(1);
    expect(await publishDueWallpapers()).toBe(0);
    expect((await db.Notification.findOne({ userId: fan.id })).count).toBe(1);
  });
});
