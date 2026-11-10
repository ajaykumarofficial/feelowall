/* global loadSettings, saveSettings, originPattern */
const form = document.getElementById('form');
const apiUrl = document.getElementById('apiUrl');
const source = document.getElementById('source');
const collectionId = document.getElementById('collectionId');
const collectionField = document.getElementById('collectionField');
const status = document.getElementById('status');

const syncSource = () => {
  const isCollection = source.value === 'collection';
  collectionField.hidden = !isCollection;
  collectionId.required = isCollection;
};

source.addEventListener('change', syncSource);

loadSettings().then((settings) => {
  apiUrl.value = settings.apiUrl;
  source.value = settings.source;
  collectionId.value = settings.collectionId;
  syncSource();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = '';
  try {
    // The extension only gets access to the one server the user names, and only when they ask.
    const granted = await chrome.permissions.request({ origins: [originPattern(apiUrl.value)] });
    if (!granted) {
      status.textContent = 'The extension needs permission to reach that address.';
      return;
    }
    await chrome.storage.local.remove('lastWallpaper');
    await saveSettings({ apiUrl: apiUrl.value, source: source.value, collectionId: collectionId.value.trim() });
    status.textContent = 'Saved. Open a new tab to see it.';
  } catch (err) {
    status.textContent = `Could not save: ${err.message}`;
  }
});
