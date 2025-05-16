import UrlParser from "../routes/url-parser";
import routes from "../routes/routes";
import { 
  createSkipLinkTemplate, 
  createNotificationButtonTemplate,
  createInstallButtonTemplate,
  showLoading, 
  hideLoading, 
  showResponseMessage 
} from "../utils/template";
import AuthAPI from "../data/authAPI";
import StoryAPI from "../data/storyAPI";
import StoryIdb from "../data/database";
import NotificationHelper from "../utils/notification-helper";
import PWAInstaller from "../utils/pwa-installer";
import NetworkStatus from "../utils/network-status";

class App {
  constructor({ content }) {
    this._content = content;
    this._pageInstances = {};
    this._isInitialized = false;
    this._initializeApp();
  }

  async _initializeApp() {
    try {
      // Initialize network status first
      await this._initializeNetworkStatus();
      
      // Then initialize the app shell
      await this._initialAppShell();
      
      this._isInitialized = true;
    } catch (error) {
      console.error('Error initializing app:', error);
      showResponseMessage('Terjadi kesalahan saat menginisialisasi aplikasi');
    }
  }

  async _initializeNetworkStatus() {
    return new Promise((resolve) => {
      NetworkStatus.init();
      NetworkStatus.registerCallback(async (isOnline) => {
        if (isOnline) {
          showResponseMessage('Koneksi kembali online');
          await this._syncData();
          // Re-render current page when coming back online
          if (this._isInitialized) {
            await this.renderPage();
          }
        } else {
          showResponseMessage('Aplikasi dalam mode offline');
        }
      });
      resolve();
    });
  }

  async _syncData() {
    try {
      if (!AuthAPI.isLoggedIn()) return;
      
      if (!navigator.onLine) {
        console.log('Device is offline, using cached data');
        return;
      }

      showLoading();
      const response = await StoryAPI.getInstance().getAllStories();
      
      if (!response.error && response.data?.stories) {
        console.log('Syncing stories to IndexedDB:', response.data.stories.length);
        await StoryIdb.syncStories(response.data.stories);
        
        // Trigger page re-render after sync only if necessary
        if (this._isInitialized && window.location.hash.includes('/home')) {
          await this.renderPage();
        }
      } else {
        console.warn('Failed to sync stories:', response.message);
      }
    } catch (error) {
      console.error('Error syncing data:', error);
    } finally {
      hideLoading();
    }
  }

  async _initialAppShell() {
    try {
      // Add skip link to body
      document.body.insertAdjacentHTML('afterbegin', createSkipLinkTemplate());
      
      // Add notification button to navigation menu
      const navigationList = document.querySelector('.app-bar__navigation ul');
      if (navigationList) {
        // Insert before logout button
        const logoutItem = navigationList.querySelector('.logout-item');
        if (logoutItem) {
          const notificationItem = document.createElement('li');
          notificationItem.classList.add('notification-item');
          notificationItem.innerHTML = createNotificationButtonTemplate();
          navigationList.insertBefore(notificationItem, logoutItem);
        }
      }
      
      // Setup UI elements
      this._setupLogoutButton();
      this._setupNotificationButton();
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

  async _initializePushNotification() {
    try {
      if (!AuthAPI.isLoggedIn()) {
        console.log('User not logged in, skipping push notification initialization');
        return;
      }

      console.log('Initializing push notification...');
      
      // Request notification permission
      const permissionGranted = await NotificationHelper.requestPermission();
      if (!permissionGranted) {
        console.log('Notification permission not granted');
        return;
      }

      // Register service worker if not already registered
      if ('serviceWorker' in navigator) {
        try {
          // Register new service worker if not already registered
          let registration = await navigator.serviceWorker.getRegistration();
          
          if (!registration) {
            registration = await navigator.serviceWorker.register('/sw.js', {
              scope: '/'
            });
            console.log('Service Worker registered:', registration);
          } else {
            console.log('Using existing service worker registration');
          }

          // Wait for the service worker to be ready
          await navigator.serviceWorker.ready;
          console.log('Service Worker is ready');

          // Check existing subscription
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            console.log('Found existing push subscription');
            
            // Verify subscription with server
            const isSubscribed = await StoryAPI.getInstance().isSubscribed();
            if (isSubscribed) {
              console.log('Subscription verified with server');
              this._updateNotificationButtonState(true);
            } else {
              console.log('Subscription not verified with server, resubscribing...');
              // Try to resubscribe
              const result = await NotificationHelper.toggleNotification();
              if (result.success) {
                this._updateNotificationButtonState(result.subscribed);
              }
            }
          }
        } catch (error) {
          console.error('Service Worker registration failed:', error);
          throw error;
        }
      } else {
        throw new Error('Service Worker not supported');
      }
    } catch (error) {
      console.error('Error initializing push notification:', error);
      showResponseMessage('Gagal menginisialisasi notifikasi: ' + error.message);
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

  async _setupNotificationButton() {
    const notificationButton = document.getElementById('notificationToggle');
    if (!notificationButton) {
      console.log('Notification button not found');
      return;
    }

    try {
      // Check if notification is supported
      if (!NotificationHelper.isSupportedBrowser()) {
        console.log('Browser tidak mendukung notifikasi');
        notificationButton.style.display = 'none';
        return;
      }

      // Check if user is logged in
      if (!AuthAPI.isLoggedIn()) {
        console.log('User not logged in, hiding notification button');
        notificationButton.style.display = 'none';
        return;
      }

      // Show button since we passed initial checks
      notificationButton.style.display = 'flex';
      notificationButton.classList.remove('hidden');

      // Register service worker and check initial state
      const registration = await navigator.serviceWorker.ready;
      console.log('Service Worker ready for notification setup');
      
      // Check current subscription status
      const subscription = await registration.pushManager.getSubscription();
      console.log('Initial subscription status:', subscription ? 'Subscribed' : 'Not subscribed');
      
      // Update button state
      this._updateNotificationButtonState(subscription !== null);

      // Add click handler
      notificationButton.addEventListener('click', async () => {
        console.log('Notification button clicked');
        
        if (!AuthAPI.isLoggedIn()) {
          showResponseMessage('Silakan login terlebih dahulu');
          return;
        }

        try {
          // Disable button while processing
          notificationButton.disabled = true;
          notificationButton.classList.add('loading');
          
          console.log('Toggling notification...');
          const result = await NotificationHelper.toggleNotification();
          console.log('Toggle result:', result);
          
          if (result.success) {
            this._updateNotificationButtonState(result.subscribed);
            console.log('Button state updated:', result.subscribed ? 'Subscribed' : 'Not subscribed');
            
            // Send test notification on successful subscription
            if (result.subscribed) {
              await NotificationHelper.sendTestNotification();
            }
          }
        } catch (error) {
          console.error('Error handling notification toggle:', error);
          showResponseMessage('Gagal mengatur notifikasi');
        } finally {
          // Re-enable button
          notificationButton.disabled = false;
          notificationButton.classList.remove('loading');
        }
      });
    } catch (error) {
      console.error('Error setting up notification button:', error);
      notificationButton.style.display = 'none';
    }
  }

  _updateNotificationButtonState(isSubscribed) {
    const button = document.getElementById('notificationToggle');
    if (!button) {
      console.log('Button not found for state update');
      return;
    }

    console.log('Updating button state:', isSubscribed ? 'Subscribed' : 'Not subscribed');
    
    const statusText = button.querySelector('.notification-status');
    const icon = button.querySelector('i');

    if (isSubscribed) {
      button.classList.add('subscribed');
      statusText.textContent = 'Nonaktifkan Notifikasi';
      icon.className = 'fas fa-bell-slash';
    } else {
      button.classList.remove('subscribed');
      statusText.textContent = 'Aktifkan Notifikasi';
      icon.className = 'fas fa-bell';
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

      // Handle authentication redirects
      if (this._needsAuthentication(url) && !isLoggedIn) {
        window.location.hash = "#/login";
        return;
      }

      if (this._isAuthPage(url) && isLoggedIn) {
        window.location.hash = "#/";
        return;
      }

      // Re-parse URL after potential redirect
      url = UrlParser.parseActiveUrlWithCombiner();
      const pageFactory = routes[url];

      if (!pageFactory) {
        console.error('No route found for URL:', url);
        window.location.hash = "#/";
        return;
      }

      // Get or create page instance
      let page = this._pageInstances[url];
      if (!page) {
        page = typeof pageFactory === "function" ? pageFactory() : pageFactory;
        this._pageInstances[url] = page;
      }

      // Render page content
      this._content.innerHTML = await page.render();
      
      // Wait for next frame to ensure DOM is updated
      await new Promise(resolve => requestAnimationFrame(resolve));
      
      // Run afterRender
      await page.afterRender();

      // Update UI elements
      this._setupLogoutButton();
      this._updateAuthElements();
      this._setupNotificationButton();

      // Handle transitions
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

      // Focus main content
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