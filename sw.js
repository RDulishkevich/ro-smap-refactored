self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = { title: 'Полёвка', body: 'Новое сообщение', tag: 'mail', url: '/messages' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) { /* generic notice */ }
  event.waitUntil(self.registration.showNotification(data.title || 'Полёвка', {
    body: data.body || 'Новое сообщение',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'mail',
    data: { url: data.url || '/messages' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/messages';
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      if (client.url && client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client && typeof client.navigate === 'function') {
          try { await client.navigate(url); } catch (_) { /* keep focused */ }
        }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
