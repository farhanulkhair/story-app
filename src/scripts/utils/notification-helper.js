import AuthAPI from '../data/authAPI';
import StoryAPI from '../data/storyAPI';
import CONFIG from '../config';

const NotificationHelper = {
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.error('Service Worker tidak didukung browser ini.');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker berhasil didaftarkan');
      return registration;
    } catch (error) {
      console.error('Registrasi service worker gagal:', error);
      return null;
    }
  },

  async requestPermission() {
    if (!('Notification' in window)) {
      console.error('Browser tidak mendukung notifikasi');
      return;
    }

    const result = await Notification.requestPermission();
    if (result === 'denied') {
      console.error('Fitur notifikasi tidak diizinkan');
      return;
    }

    if (result === 'default') {
      console.error('Pengguna menutup kotak dialog permintaan izin');
      return;
    }

    console.log('Fitur notifikasi diizinkan');
  },

  async isNotificationReady() {
    if (!('Notification' in window)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return Notification.permission === 'granted' && !!subscription;
    } catch {
      return false;
    }
  },

  async subscribePushNotification(registration) {
    try {
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: this._urlB64ToUint8Array(CONFIG.PUSH_MSG_VAPID_PUBLIC_KEY),
      };

      const subscription = await registration.pushManager.subscribe(subscribeOptions);
      console.log('Berhasil melakukan subscribe');

      // Kirim subscription ke server
      await AuthAPI.subscribePushNotification(subscription);
      console.log('Berhasil mengirim subscription ke server');

      // Kirim test notification
      await this.sendTestNotification();
      
      return subscription;
    } catch (error) {
      console.error('Gagal melakukan subscribe:', error);
      throw error;
    }
  },

  async unsubscribePushNotification(registration) {
    try {
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return;

      // Kirim unsubscribe ke server
      await AuthAPI.unsubscribePushNotification(subscription);
      
      // Hapus subscription di browser
      await subscription.unsubscribe();
      console.log('Berhasil melakukan unsubscribe');
    } catch (error) {
      console.error('Gagal melakukan unsubscribe:', error);
      throw error;
    }
  },

  async isSubscribed(registration) {
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  },

  async sendTestNotification() {
    const registration = await navigator.serviceWorker.ready;
    
    if (Notification.permission === 'granted') {
      await registration.showNotification('Story App Test Notification', {
        body: 'Notifikasi berhasil diaktifkan! Anda akan menerima pemberitahuan ketika ada story baru.',
        icon: '/favicon.png',
        badge: '/favicon.png',
        vibrate: [100, 50, 100],
        data: {
          dateOfArrival: Date.now(),
          primaryKey: 1,
          url: window.location.origin
        }
      });
    }
  },

  // Private methods
  _urlB64ToUint8Array: (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  },
};

export default NotificationHelper;
