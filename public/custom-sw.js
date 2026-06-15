self.addEventListener('fetch', (event) => {
  // Add a simple fetch listener requirement for PWA installability
});

self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: data.tag || 'nox-reminder',
        vibrate: [200, 100, 200],
        data: {
          url: data.url || '/'
        }
      };

      event.waitUntil(
        self.registration.showNotification(data.title || 'Nox', options)
      );
    } catch (e) {
      console.error("Error parsing push data", e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
