const CACHE = 'nabd-v6';
const FILES = ['./', 'index.html', 'styles.css', 'fonts.css', 'fonts/almarai-400-arabic.woff2', 'fonts/almarai-400-latin.woff2', 'fonts/almarai-700-arabic.woff2', 'fonts/almarai-700-latin.woff2', 'fonts/almarai-800-arabic.woff2', 'fonts/almarai-800-latin.woff2', 'data.js', 'data2.js', 'data3.js', 'config.js', 'features.js', 'community.js', 'photos.js', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'images/week-01.webp', 'images/week-02.webp', 'images/week-03.webp', 'images/week-04.webp', 'images/week-05.webp', 'images/week-06.webp', 'images/week-07.webp', 'images/week-08.webp', 'images/week-09.webp', 'images/week-10.webp', 'images/week-11.webp', 'images/week-12.webp', 'images/week-13.webp', 'images/week-14.webp', 'images/week-15.webp', 'images/week-16.webp', 'images/week-17.webp', 'images/week-18.webp', 'images/week-19.webp', 'images/week-20.webp', 'images/week-21.webp', 'images/week-22.webp', 'images/week-23.webp', 'images/week-24.webp', 'images/week-25.webp', 'images/week-26.webp', 'images/week-27.webp', 'images/week-28.webp', 'images/week-29.webp', 'images/week-30.webp', 'images/week-31.webp', 'images/week-32.webp', 'images/week-33.webp', 'images/week-34.webp', 'images/week-35.webp', 'images/week-36.webp', 'images/week-37.webp', 'images/week-38.webp', 'images/week-39.webp'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match('index.html'))));
});
