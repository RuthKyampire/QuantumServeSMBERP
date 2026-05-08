const CACHE_NAME = 'quantumserve-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install — cache static shell including Google Fonts CSS
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

// Fetch — cache-first for static, network-first for API, support opaque font responses
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== 'GET') return;
  
  // Skip Supabase API calls (always go network)
  if (url.hostname.includes('supabase.co')) return;
  
  // Skip Anthropic API calls
  if (url.hostname.includes('anthropic.com')) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cache successful responses (including opaque responses like fonts)
        if (response && response.type === 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        }
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback to offline page for navigate requests
        if (request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        // For fonts, return a fallback or just fail gracefully
        if (url.href.includes('fonts.googleapis.com') || url.href.includes('fonts.gstatic.com')) {
          return new Response('/* fallback */', { headers: { 'Content-Type': 'text/css' } });
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
