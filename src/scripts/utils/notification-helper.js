import AuthAPI from '../data/authAPI';
import storyAPI from '../data/storyAPI';
import CONFIG from '../config';
import { showResponseMessage } from './template';

const NotificationHelper = {
  async init() {
    if (!this.isSupportedBrowser()) {
      console.log('Notification not supported in this browser');
      return false;
    }
    return true;
  },

  isSupportedBrowser() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  },

  async requestPermission() {
    if (!this.isSupportedBrowser()) {
      return false;
    }

    const result = await Notification.requestPermission();
    if (result === 'denied') {
      console.log('Notification permission denied');
      return false;
    }
    if (result === 'default') {
      console.log('Notification permission dismissed');
      return false;
    }
    return true;
  },

  async toggleNotification() {
    try {
      console.log('Starting notification toggle...');
      
      // Cek apakah browser mendukung
      if (!this.isSupportedBrowser()) {
        console.log('Browser tidak mendukung notifikasi');
        showResponseMessage('Browser tidak mendukung notifikasi');
        return { success: false, message: 'Browser tidak mendukung notifikasi' };
      }

      // Cek status permission saat ini
      if (Notification.permission === 'denied') {
        console.log('Notifikasi telah diblokir oleh browser');
        showResponseMessage('Notifikasi telah diblokir oleh browser. Harap izinkan notifikasi di pengaturan browser.');
        return { success: false, message: 'Notifikasi telah diblokir oleh browser' };
      }

      // Dapatkan service worker registration
      const registration = await navigator.serviceWorker.ready;
      console.log('Service Worker ready for notification toggle');
      
      // Cek status subscription
      const subscription = await registration.pushManager.getSubscription();
      const isCurrentlySubscribed = await storyAPI.isSubscribed();
      console.log('Current subscription status:', isCurrentlySubscribed ? 'Subscribed' : 'Not subscribed');
      
      if (isCurrentlySubscribed && subscription) {
        // Unsubscribe jika sudah subscribe
        try {
          console.log('Attempting to unsubscribe...');
          
          // Unsubscribe dari server terlebih dahulu
          const unsubResult = await storyAPI.unsubscribePushNotification(subscription);
          console.log('Server unsubscribe result:', unsubResult);
          
          if (!unsubResult.error) {
            // Kemudian unsubscribe di browser
            await subscription.unsubscribe();
            console.log('Successfully unsubscribed from browser');
            
            showResponseMessage('Notifikasi berhasil dinonaktifkan');
            return { success: true, subscribed: false };
          } else {
            throw new Error(unsubResult.message);
          }
        } catch (error) {
          console.error('Failed to unsubscribe:', error);
          showResponseMessage('Gagal menonaktifkan notifikasi');
          return { success: false, message: 'Gagal menonaktifkan notifikasi' };
        }
      }

      // Subscribe jika belum subscribe
      try {
        console.log('Attempting to subscribe...');
        
        // Minta izin jika belum ada
        if (Notification.permission === 'default') {
          console.log('Requesting notification permission...');
          const permission = await Notification.requestPermission();
          console.log('Permission result:', permission);
          
          if (permission !== 'granted') {
            showResponseMessage('Izin notifikasi ditolak');
            return { success: false, message: 'Izin notifikasi ditolak' };
          }
        }

        // Pastikan VAPID key valid
        const applicationServerKey = this.urlBase64ToUint8Array(CONFIG.PUSH_MSG_VAPID_PUBLIC_KEY);
        console.log('Application Server Key:', applicationServerKey);

        // Subscribe ke push manager
        console.log('Subscribing to push manager...');
        const pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
        console.log('Push subscription created:', pushSubscription);
        
        // Kirim subscription ke server
        const subResult = await storyAPI.subscribePushNotification(pushSubscription);
        console.log('Server subscription result:', subResult);
        
        if (!subResult.error) {
          showResponseMessage('Notifikasi berhasil diaktifkan');
          
          // Send test notification after successful subscription
          await this.sendTestNotification();
          
          return { success: true, subscribed: true };
        } else {
          // Jika gagal di server, unsubscribe dari browser
          await pushSubscription.unsubscribe();
          throw new Error(subResult.message);
        }
      } catch (error) {
        console.error('Failed to subscribe:', error);
        showResponseMessage('Gagal mengaktifkan notifikasi: ' + error.message);
        return { success: false, message: 'Gagal mengaktifkan notifikasi: ' + error.message };
      }
    } catch (error) {
      console.error('Error in toggleNotification:', error);
      showResponseMessage('Terjadi kesalahan saat mengatur notifikasi');
      return { success: false, message: 'Terjadi kesalahan saat mengatur notifikasi' };
    }
  },

  async registerServiceWorker() {
    if (!this.isSupportedBrowser()) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully');
      return registration;
    } catch (error) {
      console.error('Registrasi service worker gagal:', error);
      return null;
    }
  },

  async sendTestNotification() {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (Notification.permission === 'granted') {
        await registration.showNotification('Story App Notification', {
          body: 'Notifikasi berhasil diaktifkan! Anda akan menerima pemberitahuan ketika ada story baru.',
          icon: '/favicon.png',
          badge: '/favicon.png',
          vibrate: [100, 50, 100],
          data: {
            dateOfArrival: Date.now(),
            url: window.location.origin
          }
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  },

  // Send notification for new stories
  async sendNotification({ title, options }) {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (!registration.pushManager) {
        console.log('PushManager not available');
        return;
      }

      // Check if user is subscribed
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        console.log('User not subscribed to notifications');
        return;
      }

      if (Notification.permission !== 'granted') {
        console.log('Notification permission not granted');
        return;
      }

      // Send message to service worker
      registration.active.postMessage({
        type: 'PUSH_NOTIFICATION',
        data: {
          title,
          options: {
            ...options,
            icon: options.icon || '/favicon.png',
            badge: options.badge || '/favicon.png',
            vibrate: options.vibrate || [100, 50, 100],
            data: {
              ...(options.data || {}),
              timestamp: Date.now()
            }
          }
        }
      });

      console.log('Notification message sent to SW:', { title, options });
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  },

  // Mengubah VAPID key dari base64 ke Uint8Array
  urlBase64ToUint8Array(base64String) {
    try {
      if (!base64String) {
        throw new Error('VAPID key is missing');
      }
      
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    } catch (error) {
      console.error('Error converting VAPID key:', error);
      throw new Error('Invalid VAPID key format');
    }
  },
};

export default NotificationHelper;
