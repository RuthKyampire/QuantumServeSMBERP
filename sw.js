// sw.js - MULTI-TENANT VERSION (for /worker/ subfolder)
const CACHE_NAME = 'quantumserve-mt-v1';
const OFFLINE_URL = '/offline.html';

// Files to precache - REMOVED root '/' and '/index.html' since app lives in /worker/
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/icons/favicon.ico',
  '/icons/icon-48x48.png',
  '/icons/icon-128x128.png'
];

// On install, clear old caches and precache essentials
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Optional: precache core files
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('Precache failed:', err);
      });
    })
  );
});

// On activate, clean up old caches and claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// NETWORK FIRST with offline fallback
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle navigation requests (page loads)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL).then(cached => {
          return cached || new Response('Offline - Please check your connection', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
    );
    return;
  }
  
  // For static assets (CSS, JS, icons) - cache first, then network
  if (request.url.match(/\.(css|js|png|jpg|jpeg|svg|ico|json)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(request).then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      }).catch(() => {
        return new Response('Asset unavailable offline', { status: 404 });
      })
    );
    return;
  }
  
  // For all other requests (Supabase API calls) - NETWORK ONLY
  event.respondWith(
    fetch(request).catch(() => {
      // For API errors while offline
      if (request.url.includes('/rest/v1/') || request.url.includes('/auth/')) {
        return new Response(JSON.stringify({ error: 'Offline', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('Network error', { status: 503 });
    })
  );
});
