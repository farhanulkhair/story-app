import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import CONFIG from './scripts/config';

// Do precaching
precacheAndRoute(self.__WB_MANIFEST);

// Cache the Google Fonts stylesheets with a stale-while-revalidate strategy.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
);

// Cache the underlying font files with a cache-first strategy for 1 year.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365,
        maxEntries: 30,
      }),
    ],
  })
);

// Cache CSS and JavaScript Files
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Cache API responses
registerRoute(
  ({ url }) => url.origin === 'https://story-api.dicoding.dev',
  new NetworkFirst({
    cacheName: 'api-responses',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Cache pages
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [200],
      }),
    ],
  })
);

// Handle push notification
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event.data ? event.data.text() : 'No data');
  
  let notificationData;
  
  try {
    notificationData = event.data ? JSON.parse(event.data.text()) : {
      title: "Story App Notification",
      options: {
        body: "Ada story baru untuk Anda!",
        icon: '/favicon.png',
        badge: '/favicon.png',
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: 1,
          url: self.location.origin
        }
      }
    };
    
    console.log('Notification data parsed:', notificationData);
  } catch (error) {
    console.error('Error parsing notification data:', error);
    notificationData = {
      title: "Story App Notification",
      options: {
        body: event.data ? event.data.text() : "Ada pembaruan baru!"
      }
    };
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData.options)
      .then(() => console.log('Notification shown successfully'))
      .catch(error => console.error('Error showing notification:', error))
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;
  console.log('Opening URL:', urlToOpen);

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
      .then((windowClients) => {
        const matchingClient = windowClients.find((client) => client.url === urlToOpen);
        console.log('Matching client found:', matchingClient ? 'yes' : 'no');
        return matchingClient ? matchingClient.focus() : clients.openWindow(urlToOpen);
      })
      .then(() => console.log('Window focused/opened successfully'))
      .catch(error => console.error('Error handling notification click:', error))
  );
});

// Handle service worker installation
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CONFIG.CACHE_NAME).then((cache) => {
      return cache.addAll([
        './',
        './index.html',
        './app.webmanifest',
        './favicon.png',
        './icons/icon-72x72.png',
        './icons/icon-96x96.png',
        './icons/icon-128x128.png',
        './icons/icon-144x144.png',
        './icons/icon-152x152.png',
        './icons/icon-192x192.png',
        './icons/icon-384x384.png',
        './icons/icon-512x512.png',
      ]);
    })
  );
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old cache versions
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith('StoryApp-'))
            .filter((cacheName) => cacheName !== CONFIG.CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        );
      }),
    ])
  );
}); 