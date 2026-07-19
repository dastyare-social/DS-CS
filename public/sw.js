self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'New update';
  const options = {
    body: data.body || 'A new update is available',
    icon: data.icon || '/profile-image.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
