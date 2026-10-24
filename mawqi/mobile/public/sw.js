// المشاريع — offline worker. The app shell is always fetched fresh when online (so updates arrive by themselves)
// and served from cache when offline. Hashed bundles are cached for good. API calls are never cached here.
const CACHE = 'mawqi-m-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/m/', '/m/manifest.webmanifest']).catch(() => undefined))); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/') || url.pathname.endsWith('/version.json')) return;
  if (url.pathname.includes('/_expo/') || url.pathname.startsWith('/m/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  if (req.mode === 'navigate' || url.pathname.startsWith('/m')) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? '/m/' : req, copy)); }
      return res;
    }).catch(() => caches.match(req.mode === 'navigate' ? '/m/' : req).then((hit) => hit || caches.match('/m/'))));
  }
});
