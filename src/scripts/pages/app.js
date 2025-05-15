import UrlParser from "../routes/url-parser";
import routes from "../routes/routes";
import { createSkipLinkTemplate, showLoading, hideLoading, showResponseMessage } from "../utils/index";
import AuthAPI from "../data/authAPI";
import NotificationHelper from "../utils/notification-helper";
import PWAInstaller from "../utils/pwa-installer";
import NetworkStatus from "../utils/network-status";

class App {
  constructor({ content }) {
    this._content = content;
    this._initialAppShell();
    
    // Objek untuk menyimpan referensi ke instance halaman
    this._pageInstances = {};
  }

  async _initialAppShell() {
    try {
      // Add skip link to body
      document.body.insertAdjacentHTML('afterbegin', createSkipLinkTemplate());
      
      // Initialize network status
      NetworkStatus.init();
      NetworkStatus.registerCallback((isOnline) => {
        if (isOnline) {
          showResponseMessage('Koneksi kembali online');
          this._syncData();
        } else {
          showResponseMessage('Aplikasi dalam mode offline');
        }
      });
      
      // Setup UI elements
      this._setupLogoutButton();
      this._setupSubscribeButton();
      this._updateAuthElements();
      this._setupSkipLink();
      
      // Initialize PWA installer
      PWAInstaller.init();
      
      // Initialize push notification (non-blocking)
      this._initializePushNotification().catch(console.error);
    } catch (error) {
      console.error('Error in _initialAppShell:', error);
    }
  }

  async _syncData() {
    try {
      if (!AuthAPI.isLoggedIn()) return;
      
      showLoading();
      const response = await StoryAPI.getAllStories();
      if (!response.error) {
        await StoryIdb.putBulkStories(response.data.stories);
      }
    } catch (error) {
      console.error('Error syncing data:', error);
    } finally {
      hideLoading();
    }
  }

  async _initializePushNotification() {
    try {
      if (!AuthAPI.isLoggedIn()) return; // Skip if not logged in

      await NotificationHelper.requestPermission();
      const registration = await NotificationHelper.registerServiceWorker();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Update button state if already subscribed
          const subscribeButton = document.getElementById('subscribeButton');
          if (subscribeButton) {
            subscribeButton.classList.add('subscribed');
            subscribeButton.innerHTML = '<i class="fas fa-bell-slash"></i> Berhenti Notifikasi';
          }
        }
      }
    } catch (error) {
      console.error('Error initializing push notification:', error);
    }
  }

  _setupSkipLink() {
    const skipLink = document.querySelector(".skip-link");
    if (skipLink) { // Tambahkan pengecekan null
      skipLink.addEventListener("click", (event) => {
        event.preventDefault();
        skipLink.blur();
        const mainContent = document.querySelector("#mainContent");
        if (mainContent) {
          mainContent.focus();
          mainContent.scrollIntoView();
        }
      });
    } else {
      console.warn("Skip link element not found");
    }
  }

  async _setupSubscribeButton() {
    const subscribeButton = document.getElementById('subscribeButton');
    if (!subscribeButton) return;

    try {
      // Check initial subscription status
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      console.log('Status notifikasi:', subscription ? 'Aktif' : 'Tidak aktif');
      
      if (subscription) {
        subscribeButton.classList.add('subscribed');
        subscribeButton.innerHTML = '<i class="fas fa-bell-slash"></i> Berhenti Notifikasi';
      }

      subscribeButton.addEventListener('click', async () => {
        try {
          showLoading();
          
          const registration = await NotificationHelper.registerServiceWorker();
          if (!registration) {
            throw new Error('Gagal mendaftarkan service worker');
          }

          const subscription = await registration.pushManager.getSubscription();

          if (subscription) {
            // Unsubscribe
            await NotificationHelper.unsubscribePushNotification(registration);
            subscribeButton.classList.remove('subscribed');
            subscribeButton.innerHTML = '<i class="fas fa-bell"></i> Notifikasi';
            showResponseMessage('Notifikasi berhasil dinonaktifkan');
            console.log('Status notifikasi: Dinonaktifkan');
          } else {
            // Subscribe
            await NotificationHelper.subscribePushNotification(registration);
            subscribeButton.classList.add('subscribed');
            subscribeButton.innerHTML = '<i class="fas fa-bell-slash"></i> Berhenti Notifikasi';
            showResponseMessage('Notifikasi berhasil diaktifkan');
            console.log('Status notifikasi: Diaktifkan');
          }
        } catch (error) {
          console.error('Error handling subscription:', error);
          showResponseMessage(error.message || 'Gagal mengatur notifikasi. Silakan coba lagi.');
        } finally {
          hideLoading();
        }
      });
    } catch (error) {
      console.error('Error setting up subscribe button:', error);
      if (subscribeButton) {
        subscribeButton.style.display = 'none'; // Hide button if setup fails
      }
    }
  }

  _setupLogoutButton() {
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        AuthAPI.logout();
        window.location.hash = '#/login';
        this._updateAuthElements();
      });
    }
  }

  _updateAuthElements() {
    const isLoggedIn = AuthAPI.isLoggedIn();
    const authElements = document.querySelectorAll('[data-auth="required"]');
    
    authElements.forEach(element => {
      if (isLoggedIn) {
        element.classList.remove('hidden');
      } else {
        element.classList.add('hidden');
      }
    });
  }

  // Menentukan rute mana yang memerlukan autentikasi
  _needsAuthentication(url) {
    // Daftar rute yang memerlukan autentikasi
    const protectedRoutes = ['/', '/home', '/add'];
    const baseUrl = url.split('/:')[0]; // Handle parameterized routes
    return protectedRoutes.includes(baseUrl) || baseUrl === '/detail';
  }

  // Menentukan rute mana yang hanya untuk pengguna yang belum login
  _isAuthPage(url) {
    const authPages = ['/login', '/register'];
    return authPages.includes(url);
  }

  async renderPage() {
    console.log('Starting page render');
    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.classList.add("transition-prepare");
    }

    try {
      let url = UrlParser.parseActiveUrlWithCombiner();
      console.log('Current URL:', url);
      const isLoggedIn = AuthAPI.isLoggedIn();
      console.log('Is user logged in:', isLoggedIn);

      // Update auth elements visibility based on current route and login status
      this._updateAuthElements();

      // Jika pengguna belum login dan mencoba mengakses halaman yang dilindungi
      if (this._needsAuthentication(url) && !isLoggedIn) {
        console.log('User not authenticated, redirecting to login');
        // Redirect ke halaman login
        window.location.hash = "#/login";
        return;
      }

      // Jika pengguna sudah login dan mencoba mengakses halaman login/register
      if (this._isAuthPage(url) && isLoggedIn) {
        console.log('Authenticated user trying to access auth page, redirecting to home');
        // Redirect ke halaman home
        window.location.hash = "#/";
        return;
      }

      // Re-parse URL setelah potential redirect
      url = UrlParser.parseActiveUrlWithCombiner();
      const pageFactory = routes[url];
      console.log('Page factory for URL:', pageFactory);

      if (!pageFactory) {
        console.error('No route found for URL:', url);
        window.location.hash = "#/";
        return;
      }

      // Dapatkan instance halaman dari factory atau gunakan instance yang sudah ada
      let page;
      if (!this._pageInstances[url]) {
        // Jika belum ada instance untuk route ini, buat instance baru
        console.log('Creating new page instance for route:', url);
        page = typeof pageFactory === "function" ? pageFactory() : pageFactory;
        this._pageInstances[url] = page;
      } else {
        // Gunakan kembali instance yang sudah ada untuk route ini
        console.log('Reusing existing page instance for route:', url);
        page = this._pageInstances[url];
      }

      try {
        console.log('Rendering page content');
        this._content.innerHTML = await page.render();
        console.log('Running afterRender');
        await page.afterRender();
      } catch (error) {
        console.error('Error rendering page:', error);
        throw error;
      }

      // Re-setup the logout button after page render
      this._setupLogoutButton();
      
      // Update auth elements visibility after page render
      this._updateAuthElements();

      if (document.startViewTransition && mainElement) {
        document.startViewTransition(() => {
          mainElement.classList.remove("transition-prepare");
          mainElement.classList.add("transition-start");
          setTimeout(() => {
            mainElement.classList.remove("transition-start");
          }, 300);
        });
      } else if (mainElement) {
        mainElement.classList.remove("transition-prepare");
      }

      const mainContent = document.querySelector("#mainContent");
      if (mainContent) {
        mainContent.focus();
      }
    } catch (error) {
      console.error("Error rendering page:", error);
      this._content.innerHTML = `
        <div class="error-container">
          <p class="error-message">Terjadi kesalahan saat memuat halaman: ${error.message}</p>
          <button onclick="window.location.hash='#/home'" class="btn btn-primary">Kembali ke Beranda</button>
        </div>
      `;
    }
  }
}

export default App;