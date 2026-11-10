/**
 * Server-rendered pages for things that don't run the React app: link-preview
 * crawlers, search engines, feed readers, and embeds on other sites.
 */
const express = require('express');
const router = express.Router();
const config = require('../../config');
const { Wallpaper, Playlist, User } = require('../../databaseModels');
const { asyncHandler } = require('../../helper/asyncHandler');
const { escapeHtml, exactCI, normalizeTag } = require('../../helper/text');
const { isPublic, publicFilter } = require('../../helper/visibility');
const { absoluteMediaUrl } = require('../../helper/media');

const PUBLIC_LISTABLE = () => ({ ...publicFilter(), isMature: { $ne: true } });
const SITE_NAME = 'FeeloWall';
const DEFAULT_DESCRIPTION = 'HD wallpapers curated by the FeeloWall community.';

const previewPage = ({ title, description, imageUrl, canonical, type = 'website' }) => {
  const tags = [
    ['og:site_name', SITE_NAME],
    ['og:type', type],
    ['og:title', title],
    ['og:description', description],
    ['og:url', canonical],
    ...(imageUrl ? [['og:image', imageUrl]] : [])
  ].map(([property, content]) => `<meta property="${property}" content="${escapeHtml(content)}">`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} | ${SITE_NAME}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
${tags}
<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">` : ''}
<meta http-equiv="refresh" content="0;url=${escapeHtml(canonical)}">
</head>
<body><a href="${escapeHtml(canonical)}">${escapeHtml(title)}</a></body>
</html>`;
};

const sendHtml = (res, html, status = 200) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(status).type('html').send(html);
};

const notFoundPage = (res) => sendHtml(res, previewPage({
  title: 'Not found',
  description: DEFAULT_DESCRIPTION,
  canonical: config.FRONTEND_URL
}), 404);

const safeFind = (promise) => promise.catch((err) => {
  if (err.name === 'CastError') return null;
  throw err;
});

// ─── Share pages ─────────────────────────────────────────────

router.get('/share/wallpaper/:id', asyncHandler(async (req, res) => {
  const wallpaper = await safeFind(Wallpaper.findById(req.params.id).lean());
  if (!wallpaper || !isPublic(wallpaper) || wallpaper.isMature) return notFoundPage(res);
  sendHtml(res, previewPage({
    title: wallpaper.title,
    description: wallpaper.altText || `${wallpaper.category} wallpaper by ${wallpaper.uploadedBy} on ${SITE_NAME}.`,
    imageUrl: absoluteMediaUrl(wallpaper.imageUrl),
    canonical: `${config.FRONTEND_URL}/wallpaper/${wallpaper._id}`,
    type: 'article'
  }));
}));

router.get('/share/creator/:username', asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: exactCI(req.params.username), status: { $ne: 'suspended' } })
    .select('username bio avatarUrl').lean();
  if (!user) return notFoundPage(res);
  sendHtml(res, previewPage({
    title: `${user.username}'s wallpapers`,
    description: user.bio || `Wallpapers by ${user.username} on ${SITE_NAME}.`,
    imageUrl: user.avatarUrl ? absoluteMediaUrl(user.avatarUrl) : '',
    canonical: `${config.FRONTEND_URL}/creator/${encodeURIComponent(user.username)}`,
    type: 'profile'
  }));
}));

router.get('/share/playlist/:id', asyncHandler(async (req, res) => {
  const playlist = await safeFind(Playlist.findById(req.params.id).populate('wallpapers', 'imageUrl status isMature').lean());
  if (!playlist || !playlist.isPublic) return notFoundPage(res);
  const cover = (playlist.wallpapers || []).find((wp) => isPublic(wp) && !wp.isMature);
  sendHtml(res, previewPage({
    title: playlist.name,
    description: playlist.description || `A wallpaper collection by ${playlist.creator} on ${SITE_NAME}.`,
    imageUrl: cover ? absoluteMediaUrl(cover.imageUrl) : '',
    canonical: `${config.FRONTEND_URL}/playlists/${playlist._id}`
  }));
}));

// ─── Search engines ──────────────────────────────────────────

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${config.API_PUBLIC_URL}/sitemap.xml\n`);
});

router.get('/sitemap.xml', asyncHandler(async (req, res) => {
  const [wallpapers, playlists, creators] = await Promise.all([
    Wallpaper.find(PUBLIC_LISTABLE()).select('uploadedAt uploadedBy').sort({ uploadedAt: -1 }).limit(20000).lean(),
    Playlist.find({ isPublic: true }).select('createdAt').sort({ createdAt: -1 }).limit(5000).lean(),
    Wallpaper.distinct('uploadedBy', PUBLIC_LISTABLE())
  ]);

  const urls = [
    { loc: config.FRONTEND_URL },
    ...wallpapers.map((wp) => ({ loc: `${config.FRONTEND_URL}/wallpaper/${wp._id}`, lastmod: wp.uploadedAt })),
    ...playlists.map((pl) => ({ loc: `${config.FRONTEND_URL}/playlists/${pl._id}`, lastmod: pl.createdAt })),
    ...creators.slice(0, 5000).map((name) => ({ loc: `${config.FRONTEND_URL}/creator/${encodeURIComponent(name)}` }))
  ];

  const body = urls.map(({ loc, lastmod }) => `<url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ''}</url>`).join('');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`);
}));

// ─── RSS ─────────────────────────────────────────────────────

const rssFeed = ({ title, link, description, wallpapers }) => {
  const items = wallpapers.map((wp) => {
    const url = `${config.FRONTEND_URL}/wallpaper/${wp._id}`;
    const image = absoluteMediaUrl(wp.imageUrl);
    return `<item><title>${escapeHtml(wp.title)}</title><link>${escapeHtml(url)}</link><guid isPermaLink="true">${escapeHtml(url)}</guid><pubDate>${new Date(wp.uploadedAt).toUTCString()}</pubDate><author>${escapeHtml(wp.uploadedBy)}</author><description>${escapeHtml(`<img src="${escapeHtml(image)}" alt="${escapeHtml(wp.altText || wp.title)}">`)}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeHtml(title)}</title><link>${escapeHtml(link)}</link><description>${escapeHtml(description)}</description>${items}</channel></rss>`;
};

const sendRss = async (res, filter, meta) => {
  const wallpapers = await Wallpaper.find({ ...PUBLIC_LISTABLE(), ...filter }).sort({ uploadedAt: -1 }).limit(50).lean();
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.type('application/rss+xml').send(rssFeed({ ...meta, wallpapers }));
};

router.get('/rss/creator/:username', asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: exactCI(req.params.username), status: { $ne: 'suspended' } }).select('username').lean();
  if (!user) return res.status(404).type('text/plain').send('Creator not found.');
  await sendRss(res, { uploadedById: user._id }, {
    title: `${user.username} on ${SITE_NAME}`,
    link: `${config.FRONTEND_URL}/creator/${encodeURIComponent(user.username)}`,
    description: `New wallpapers by ${user.username}.`
  });
}));

router.get('/rss/tag/:tag', asyncHandler(async (req, res) => {
  const tag = normalizeTag(req.params.tag);
  await sendRss(res, { tags: exactCI(tag) }, {
    title: `#${tag} on ${SITE_NAME}`,
    link: `${config.FRONTEND_URL}/tags/${encodeURIComponent(tag)}`,
    description: `New wallpapers tagged ${tag}.`
  });
}));

// ─── Embeds ──────────────────────────────────────────────────

const embedPage = (title, inner) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} | ${SITE_NAME}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0b0f19;color:#f3f4f6;font:14px system-ui,sans-serif}
a{color:inherit;text-decoration:none}.hero{display:block;width:100%;height:calc(100vh - 44px);object-fit:cover}
.bar{height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 12px}
.bar span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.bar b{color:#22d3ee;flex:none}
.grid{height:calc(100vh - 44px);overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px;padding:4px}
.grid img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}
</style></head><body>${inner}</body></html>`;

const sendEmbed = (res, html, status = 200) => {
  // Embeds are meant to be framed by other sites; nothing else here is.
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src https: http:; style-src 'unsafe-inline'; frame-ancestors *");
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(status).type('html').send(html);
};

router.get('/embed/wallpaper/:id', asyncHandler(async (req, res) => {
  const wallpaper = await safeFind(Wallpaper.findById(req.params.id).lean());
  if (!wallpaper || !isPublic(wallpaper) || wallpaper.isMature) return sendEmbed(res, embedPage('Not found', '<div class="bar"><span>This wallpaper isn\'t available.</span></div>'), 404);
  const url = `${config.FRONTEND_URL}/wallpaper/${wallpaper._id}`;
  sendEmbed(res, embedPage(wallpaper.title, `<a href="${escapeHtml(url)}" target="_blank" rel="noopener"><img class="hero" src="${escapeHtml(absoluteMediaUrl(wallpaper.imageUrl))}" alt="${escapeHtml(wallpaper.altText || wallpaper.title)}"><div class="bar"><span>${escapeHtml(wallpaper.title)} by ${escapeHtml(wallpaper.uploadedBy)}</span><b>${SITE_NAME}</b></div></a>`));
}));

router.get('/embed/playlist/:id', asyncHandler(async (req, res) => {
  const playlist = await safeFind(Playlist.findById(req.params.id)
    .populate({ path: 'wallpapers', match: PUBLIC_LISTABLE(), select: 'title imageUrl altText' }).lean());
  if (!playlist || !playlist.isPublic) return sendEmbed(res, embedPage('Not found', '<div class="bar"><span>This collection isn\'t available.</span></div>'), 404);
  const grid = (playlist.wallpapers || []).slice(0, 60).map((wp) =>
    `<a href="${escapeHtml(`${config.FRONTEND_URL}/wallpaper/${wp._id}`)}" target="_blank" rel="noopener"><img loading="lazy" src="${escapeHtml(absoluteMediaUrl(wp.imageUrl))}" alt="${escapeHtml(wp.altText || wp.title)}"></a>`).join('');
  const url = `${config.FRONTEND_URL}/playlists/${playlist._id}`;
  sendEmbed(res, embedPage(playlist.name, `<div class="grid">${grid}</div><a href="${escapeHtml(url)}" target="_blank" rel="noopener"><div class="bar"><span>${escapeHtml(playlist.name)} by ${escapeHtml(playlist.creator)}</span><b>${SITE_NAME}</b></div></a>`));
}));

module.exports = router;
