/* Полёвка — service worker: PWA shell + Web Notifications (Safari / Chrome / installed app). */
const CACHE = 'polevka-shell-v3';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './Logo.png',
  './favicon.png',
  './apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/logo-mark.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Не кэшируем облачные JSON/аудио — только shell и статика приложения.
  if (/\.(json|wav|mp3|ogg|m4a)(\?|$)/i.test(url.pathname)) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok && (req.mode === 'navigate' || /\.(js|css|png|webmanifest|svg|woff2?)(\?|$)/i.test(url.pathname) || url.pathname.endsWith('/'))) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Полёвка', body: 'Новое уведомление', url: './' };
  try {
    if (event.data) {
      const data = event.data.json();
      payload = { ...payload, ...data };
    }
  } catch (_) {
    try {
      payload.body = event.data ? event.data.text() : payload.body;
    } catch (__) {}
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'Полёвка', {
      body: payload.body || '',
      icon: './Logo.png',
      badge: './icons/icon-192.png',
      tag: payload.tag || `polevka-push-${Date.now()}`,
      renotify: true,
      data: { url: payload.url || './', notifId: payload.notifId || null }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  const target = data.url || './';
  const notifId = data.notifId || null;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        try {
          client.postMessage({ type: 'polevka-notif-click', notifId });
        } catch (_) {}
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
