// WMVAA AI Grader Pro — Clean Passthrough PWA Service Worker (v2.0.5)
// Tidak mengintersepsi fetch HTML/RSC/redirect agar browser mobile & Android tidak pernah
// terjebak cache usang atau error redirect saat update versi.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
