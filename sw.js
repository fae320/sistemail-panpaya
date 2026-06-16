// ══════════════════════════════════════
// SISTEMAIL — Service Worker
// Notificaciones push aunque el navegador esté cerrado
// ══════════════════════════════════════

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(clients.claim()); });

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || '🚨 SisteMail', {
      body: data.body || 'Nuevo reporte crítico',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'sistemail',
      requireInteraction: true,
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const url = e.notification.data?.url || '/';
      for (const client of list) {
        if (client.url.includes('sistemail') && 'focus' in client) {
          client.postMessage({ action: 'irACorreos' });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});