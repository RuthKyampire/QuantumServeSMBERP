const CACHE_NAME = 'quantumserve-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install — cache static shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — purge old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for static, network-first for API
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin API calls (Supabase)
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('anthropic.com')) return;
  if (url.hostname.includes('fonts.googleapis.com')) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Fallback to offline page for navigate requests
        if (request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      });
    })
  );
});
