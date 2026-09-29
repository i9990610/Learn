const CACHE = 'fitlog-v9';
const SHELL = ['./', 'index.html', 'styles.css', 'js/core.js', 'js/ai.js', 'js/today.js', 'js/food.js', 'js/train.js', 'js/week.js', 'js/meals.js', 'js/body.js', 'js/health.js', 'js/settings.js', 'js/main.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first for the app's own files so updates land, cache as offline fallback.
// Cross-origin requests (the AI APIs) are never cached.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    // bypass the browser's HTTP cache (GitHub Pages sends max-age=600) so updates arrive immediately
    fetch(new Request(e.request, { cache: 'no-cache' })).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
