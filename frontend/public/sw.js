const CACHE_NAME = 'feelowall-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/index.css',
  '/manifest.json'
];

// Install Event - cache core static shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - network first with cache fallback for APIs, cache-first for assets & images
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle API Requests (Network First)
  if (url.pathname.includes('/api/')) {
    e.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response and save to cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If offline, attempt to load API response from cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            // Fallback for list requests: return empty array if offline and no cache
            if (url.pathname.includes('/api/wallpapers')) {
              return new Response(JSON.stringify({ wallpapers: [], hasMore: false, offline: true }), {
                headers: { 'Content-Type': 'application/json' }
              });
            }
            return new Response(JSON.stringify({ error: 'Offline, no cached data available.' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Handle Wallpaper Images (Unsplash, Cloudinary, or Local Uploads) - Cache First
  const isImageRequest = 
    request.destination === 'image' || 
    url.hostname.includes('unsplash.com') || 
    url.hostname.includes('cloudinary.com') ||
    url.pathname.includes('/uploads/');

  if (isImageRequest) {
    e.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return networkResponse;
        }).catch(() => {
          // If image fails and offline, return a placeholder or transparent pixel
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200" style="background:#1e1e24;display:flex;align-items:center;justify-content:center;"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#555" font-family="sans-serif">Offline Preview</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        });
      })
    );
    return;
  }

  // General Static Assets - Stale While Revalidate (serve cached, fetch updated in background)
  e.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Suppress network error logging offline
      });

      return cachedResponse || fetchPromise;
    })
  );
});
