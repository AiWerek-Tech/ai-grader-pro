// WMVAA AI Grader Pro — Smart Offline-Fallback PWA Service Worker (v2.0.8)
// Tidak menyimpan cache HTML dashboard/RSC/API agar tidak pernah stale saat update versi,
// namun menyimpan halaman khusus /offline agar browser/PWA tidak pernah menampilkan
// layar error bawaan "ERR_INTERNET_DISCONNECTED".

const OFFLINE_CACHE = 'wmvaa-offline-shell-v1';

function getScopeBase() {
  const scope = (self.registration && self.registration.scope) || self.location.origin + '/';
  return scope.endsWith('/') ? scope : scope + '/';
}

function getOfflineUrl() {
  return getScopeBase() + 'offline';
}

self.addEventListener('install', (event) => {
  const offlineUrl = getOfflineUrl();
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.addAll([offlineUrl]))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== OFFLINE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(OFFLINE_CACHE);
      const cached = await cache.match(getOfflineUrl());
      if (cached) return cached;
      return new Response(
        '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - WMVAA AI Grader Pro</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050314;color:#f8fafc;font-family:sans-serif;text-align:center;padding:24px"><div style="max-width:380px;background:#0e0a2a;border:1px solid #241c4a;border-radius:24px;padding:28px"><h2 style="margin:0 0 8px">Koneksi Internet Terputus</h2><p style="color:#94a3b8;font-size:13px;line-height:1.5">Pastikan Wi-Fi atau Data Seluler HP aktif, lalu muat ulang halaman.</p><button onclick="location.reload()" style="margin-top:16px;width:100%;padding:12px;border-radius:12px;border:0;background:#7c3aed;color:#fff;font-weight:700;cursor:pointer">Coba Sambungkan Lagi</button></div></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })
  );
});
