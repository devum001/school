// Schoolwell PWA Service Worker
const CACHE_NAME = 'schoolwell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch handler is required by Chrome for PWA installability criteria
self.addEventListener('fetch', (event) => {
  // Let network handle requests directly; can be expanded for offline assets
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
