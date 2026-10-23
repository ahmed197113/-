// عامل الخدمة: يحفظ الواجهة لتعمل بدون إنترنت، ويعرض آخر بيانات محفوظة
const CACHE = 'mawqii-v1';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/offline.js', '/manifest.webmanifest', '/icon.svg',
  '/vendor/chart/chart.umd.js', '/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css', '/vendor/jsqr/jsQR.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) {
    // الخطوط وبلاطات الخريطة: من الذاكرة إن وجدت
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => r)));
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    // بيانات: من الشبكة أولاً ثم آخر نسخة محفوظة
    if (/\/(print|daily-print)$|\/exports\//.test(url.pathname)) return;
    e.respondWith(fetch(req).then((res) => {
      if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((r) => r || new Response(JSON.stringify({ error: 'لا يوجد اتصال بالإنترنت', offline: true }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  e.respondWith(caches.match(req).then((r) => r || fetch(req).catch(() => caches.match('/index.html'))));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'موقعي', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'موقعي', { body: d.body || '', icon: '/icon.svg', dir: 'rtl', lang: 'ar', data: { link: d.link || '' } }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = '/' + (e.notification.data.link || '');
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => {
    for (const c of cs) if ('focus' in c) { c.navigate(link); return c.focus(); }
    return self.clients.openWindow(link);
  }));
});
