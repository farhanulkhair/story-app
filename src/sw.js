/* eslint-disable no-restricted-globals */
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

// Specific handler for Leaflet resources
registerRoute(
  ({ url }) => url.origin === 'https://unpkg.com' && url.pathname.includes('leaflet'),
  new StaleWhileRevalidate({
    cacheName: 'leaflet-resources',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
    fetchOptions: {
      mode: 'cors',
      credentials: 'omit'
    }
  })
);

// Cache API responses
registerRoute(
  ({ url }) => url.origin === CONFIG.BASE_URL,
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
    const rawData = event.data?.text();
    if (!rawData) {
      throw new Error('No notification data received');
    }
    
    console.log('Raw notification data:', rawData);
    
    // Parse data dari server
    const serverData = JSON.parse(rawData);
    console.log('Parsed server data:', serverData);

    // Validasi data yang diterima
    if (!serverData || (typeof serverData !== 'object')) {
      throw new Error('Invalid notification data format');
    }

    // Format notifikasi berdasarkan tipe data yang diterima
    if (serverData.type === 'PUSH_NOTIFICATION' && serverData.data) {
      // Format dari client-side notification
      notificationData = {
        title: serverData.data.title,
        options: {
          ...serverData.data.options,
          tag: serverData.data.options.tag || `story-notification-${Date.now()}`,
          renotify: true,
          timestamp: serverData.data.options.timestamp || Date.now(),
          data: {
            ...(serverData.data.options?.data || {}),
            timestamp: serverData.data.options.timestamp || Date.now(),
            source: 'client-push'
          }
        }
      };
    } else {
      // Format dari server push notification
      const storyData = serverData.data || {};
      notificationData = {
        title: storyData.name ? `Story Baru dari ${storyData.name}` : "Story Baru",
        options: {
          body: serverData.message || "Ada story baru ditambahkan",
          tag: `story-notification-${Date.now()}`,
          renotify: true,
          icon: storyData.photoUrl || '/favicon.png',
          badge: '/favicon.png',
          vibrate: [100, 50, 100],
          timestamp: Date.now(),
          data: {
            url: storyData.id ? 
              `${self.location.origin}/#/detail/${storyData.id}` : 
              `${self.location.origin}/#/home`,
            storyId: storyData.id,
            timestamp: Date.now(),
            source: 'server-push'
          },
          actions: [
            {
              action: 'view',
              title: 'Lihat Story'
            },
            {
              action: 'close',
              title: 'Tutup'
            }
          ]
        }
      };
    }
    
    console.log('Final notification data:', notificationData);
  } catch (error) {
    console.error('Error processing notification data:', error);
    // Fallback notification with error details
    notificationData = {
      title: "Story App Notification",
      options: {
        body: "Ada pembaruan di Story App",
        tag: `story-notification-${Date.now()}`,
        renotify: true,
        icon: '/favicon.png',
        badge: '/favicon.png',
        vibrate: [100, 50, 100],
        timestamp: Date.now(),
        data: {
          url: self.location.origin + '/#/home',
          timestamp: Date.now(),
          source: 'error-fallback',
          error: error.message
        },
        actions: [
          {
            action: 'view',
            title: 'Lihat Story'
          }
        ]
      }
    };
  }

  // Handle notification display
  event.waitUntil(
    (async () => {
      try {
        // Get all current notifications
        const notifications = await self.registration.getNotifications();
        
        // Close older notifications with same tag or from same source
        notifications
          .filter(notification => {
            const data = notification.data || {};
            const newData = notificationData.options.data || {};
            
            // Close if same tag or (for stories) same storyId
            return notification.tag === notificationData.options.tag || 
                   (data.storyId && data.storyId === newData.storyId);
          })
          .forEach(notification => notification.close());

        // Show new notification
        await self.registration.showNotification(
          notificationData.title,
          notificationData.options
        );
        
        console.log('Notification shown successfully');
      } catch (error) {
        console.error('Error showing notification:', error);
      }
    })()
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  const targetUrl = data.url || (self.location.origin + '/#/home');

  console.log('Notification clicked:', {
    action,
    data,
    timestamp: data.timestamp,
    source: data.source
  });

  // Close clicked notification
  notification.close();

  // Handle different actions
  if (action === 'close') {
    return; // Just close the notification
  }

  // For view action or default click
  event.waitUntil(
    (async () => {
      try {
        // Get all windows
        const windowClients = await clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });

        // Check for existing tab with the target URL
        const existingClient = windowClients.find(client => 
          client.url === targetUrl || 
          client.url.replace(/#.*$/, '') === targetUrl.replace(/#.*$/, '')
        );

        if (existingClient) {
          // If we found an existing tab, focus it and reload if needed
          await existingClient.focus();
          if (existingClient.url !== targetUrl) {
            return existingClient.navigate(targetUrl);
          }
          return;
        }

        // If no existing tab found, open new one
        await clients.openWindow(targetUrl);
      } catch (error) {
        console.error('Error handling notification click:', error);
        // Fallback to simple window open
        await clients.openWindow(targetUrl);
      }
    })()
  );
});

// Handle message from client
self.addEventListener('message', (event) => {
  console.log('Message received in SW:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
    console.log('Processing push notification request:', event.data);
    
    try {
      const { title, options } = event.data.data || {};
      
      if (!title || !options) {
        throw new Error('Invalid notification data: missing title or options');
      }

      // Validate and enhance notification options
      const enhancedOptions = {
        ...options,
        tag: `story-notification-${Date.now()}`,
        renotify: true,
        timestamp: Date.now(),
        data: {
          ...(options.data || {}),
          timestamp: Date.now(),
          source: 'local-manual',
          url: options.data?.url || (self.location.origin + '/#/home')
        }
      };

      // Ensure required fields
      if (!enhancedOptions.body) {
        enhancedOptions.body = 'Ada pembaruan di Story App';
      }
      if (!enhancedOptions.icon) {
        enhancedOptions.icon = '/favicon.png';
      }
      if (!enhancedOptions.badge) {
        enhancedOptions.badge = '/favicon.png';
      }
      if (!enhancedOptions.actions) {
        enhancedOptions.actions = [
          {
            action: 'view',
            title: 'Lihat Story'
          },
          {
            action: 'close',
            title: 'Tutup'
          }
        ];
      }
      
      event.waitUntil(
        (async () => {
          try {
            // Close existing notifications with similar content
            const existingNotifications = await self.registration.getNotifications();
            existingNotifications
              .filter(notification => 
                notification.data?.source === 'local-manual' &&
                notification.title === title &&
                notification.body === enhancedOptions.body
              )
              .forEach(notification => notification.close());

            // Show new notification
            await self.registration.showNotification(title, enhancedOptions);
            console.log('Manual notification shown successfully');
          } catch (error) {
            console.error('Error showing manual notification:', error);
            throw error; // Re-throw to be caught by the client
          }
        })()
      );
    } catch (error) {
      console.error('Error processing manual notification:', error);
      // You might want to message back to the client about the error
      event.source?.postMessage({
        type: 'NOTIFICATION_ERROR',
        error: error.message
      });
    }
  }
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