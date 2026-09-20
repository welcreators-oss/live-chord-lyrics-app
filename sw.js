// オフラインキャッシュ用Service Worker。
// 更新時はCACHE_NAMEのバージョンを上げること（古いキャッシュは自動破棄される）。
const CACHE_NAME = 'live-chord-cache-v11';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/stage.css',
  './js/common.js',
  './js/db.js',
  './js/images.js',
  './js/songs.js',
  './js/ocr.js',
  './js/pdf-render.js',
  './js/pedal.js',
  './js/chord-editor.js',
  './js/chord-text-parser.js',
  './js/chord-display.js',
  './js/pages/index.js',
  './js/pages/song-edit.js',
  './js/pages/backgrounds.js',
  './js/pages/setlist.js',
  './js/pages/stage.js',
  './js/pages/settings.js',
  './js/pages/backup.js',
  './pages/song-edit.html',
  './pages/backgrounds.html',
  './pages/setlist.html',
  './pages/stage.html',
  './pages/settings.html',
  './pages/backup.html',
  './vendor/jszip.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // 本番中にネットワークへ依存しないよう、キャッシュ優先。無ければネットワーク取得しキャッシュへ追加。
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
