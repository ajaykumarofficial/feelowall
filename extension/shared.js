/* Settings shared by the new tab and options pages. */
const DEFAULT_SETTINGS = { apiUrl: 'http://localhost:5000', source: 'featured', collectionId: '' };

const loadSettings = () => chrome.storage.sync.get(DEFAULT_SETTINGS);
const saveSettings = (settings) => chrome.storage.sync.set(settings);

const originPattern = (apiUrl) => `${new URL(apiUrl).origin}/*`;

const absoluteImage = (apiUrl, url) => (String(url).startsWith('/uploads') ? `${apiUrl.replace(/\/$/, '')}${url}` : url);
