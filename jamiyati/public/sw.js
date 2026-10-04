// Service Worker: يخزّن واجهة التطبيق للعمل دون اتصال، ويستقبل إشعارات Push.
const CACHE = 'jamiyati-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// الشبكة أولاً للصفحة، والذاكرة أولاً للأصول الثابتة
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { caches.open(CACHE).then((c) => c.put('./index.html', r.clone())); return r; }).catch(() => caches.match('./index.html')));
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return r; })),
    );
  }
});

// Web Push من الخادم (Supabase Edge Function)
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'جمعيتي', body: '' };
  e.waitUntil(self.registration.showNotification(data.title || 'جمعيتي', { body: data.body, icon: 'icon.svg', dir: 'rtl', lang: 'ar', data: data.url }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow(e.notification.data || './'))));
});
