// WorkTrivo Service Worker for Reliable Push & Background Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for message from frontend to display notification via Service Worker
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') return;

  const { title, options } = event.data;
  event.waitUntil(
    self.registration.showNotification(title || 'WorkTrivo', {
      icon: '/siteicon.png',
      badge: '/siteicon.png',
      vibrate: [200, 100, 200],
      tag: options?.tag || 'worktrivo-notification',
      renotify: true,
      requireInteraction: false,
      ...options,
    })
  );
});

// When user clicks the system notification on their phone/browser
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
