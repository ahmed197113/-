// Service Worker: إشعارات التذكير وتشغيل التطبيق كتطبيق مثبت
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const answer = event.action || 'open';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all[0];
    if (client) {
      await client.focus();
      client.postMessage({ type: 'reminder-action', answer });
    } else {
      await self.clients.openWindow('/#/reminder/' + answer);
    }
  })());
});
