/* global loadSettings, absoluteImage */
const CACHE_KEY = 'lastWallpaper';

const showMessage = (text) => {
  const message = document.getElementById('message');
  message.textContent = text;
  message.hidden = false;
};

const fetchWallpapers = async ({ apiUrl, source, collectionId }) => {
  const base = apiUrl.replace(/\/$/, '');
  if (source === 'collection' && collectionId) {
    const response = await fetch(`${base}/api/playlists/${encodeURIComponent(collectionId)}`);
    if (!response.ok) throw new Error('That collection is not available. It must be public.');
    return (await response.json()).wallpapers || [];
  }
  const response = await fetch(`${base}/api/wallpapers/featured`);
  if (!response.ok) throw new Error('Could not reach FeeloWall.');
  return response.json();
};

const show = (wallpaper, settings) => {
  const image = document.getElementById('wallpaper');
  image.src = absoluteImage(settings.apiUrl, wallpaper.imageUrl);
  image.alt = wallpaper.altText || wallpaper.title || '';
  image.hidden = false;

  // Text is only ever set with textContent, so wallpaper titles can't inject markup.
  const credit = document.getElementById('credit');
  credit.textContent = `${wallpaper.title} by ${wallpaper.uploadedBy}`;
  credit.hidden = false;
  if (wallpaper.webUrl) credit.href = wallpaper.webUrl;
};

const startClock = () => {
  const clock = document.getElementById('clock');
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  tick();
  setInterval(tick, 10000);
};

(async () => {
  startClock();
  const settings = await loadSettings();
  // Show the previous wallpaper straight away, so a new tab never sits empty while loading.
  const cached = await chrome.storage.local.get(CACHE_KEY);
  if (cached[CACHE_KEY]) show(cached[CACHE_KEY], settings);

  try {
    const wallpapers = await fetchWallpapers(settings);
    if (!wallpapers.length) {
      if (!cached[CACHE_KEY]) showMessage('No wallpapers to show yet. Choose another source in Settings.');
      return;
    }
    const pick = wallpapers[Math.floor(Math.random() * wallpapers.length)];
    if (!cached[CACHE_KEY]) show(pick, settings);
    // Keep a fresh one ready for the next tab.
    await chrome.storage.local.set({
      [CACHE_KEY]: { imageUrl: pick.imageUrl, title: pick.title, uploadedBy: pick.uploadedBy, altText: pick.altText }
    });
  } catch (err) {
    if (!cached[CACHE_KEY]) showMessage(`${err.message} Check the server address in Settings.`);
  }
})();
