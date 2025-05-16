import CONFIG from "../config";

const NetworkStatus = {
  _callbacks: [],
  _isOnline: navigator.onLine,
  _checkingConnection: false,

  init() {
    window.addEventListener('online', () => {
      console.log('Browser reports online');
      this._checkConnection();
    });
    
    window.addEventListener('offline', () => {
      console.log('Browser reports offline');
      this._updateStatus(false);
    });
    
    // Initial status check
    this._checkConnection();
    
    // Periodic connection check
    setInterval(() => this._checkConnection(), 30000); // Check every 30 seconds
  },

  async _checkConnection() {
    // Prevent multiple simultaneous checks
    if (this._checkingConnection) {
      console.log('Connection check already in progress');
      return;
    }

    this._checkingConnection = true;

    try {
      // First check navigator.onLine
      if (!navigator.onLine) {
        console.log('Browser reports offline');
        this._updateStatus(false);
        return;
      }

      // Then try to fetch a reliable external resource
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const googleResponse = await fetch('https://www.google.com/favicon.ico', {
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log('Internet connection check successful');
      } catch (error) {
        console.log('Internet connection check failed:', error.name);
        this._updateStatus(false);
        return;
      }

      // Finally check the API connection
      console.log('Checking connection to API...');
      const token = localStorage.getItem('token');
      
      if (!token) {
        // If no token, we're still online but not authenticated
        console.log('No auth token found, but connection is available');
        this._updateStatus(true);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${CONFIG.BASE_URL}/stories?size=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        cache: 'no-store',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const isOnline = response.ok;
      console.log('API connection check result:', isOnline ? 'connected' : 'disconnected');
      
      if (isOnline !== this._isOnline) {
        this._updateStatus(isOnline);
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      // If the API check fails but we have internet, we're still technically online
      // This prevents showing offline status when only the API is having issues
      this._updateStatus(navigator.onLine);
    } finally {
      this._checkingConnection = false;
    }
  },

  _updateStatus(isOnline) {
    if (this._isOnline === isOnline) return; // Don't update if status hasn't changed

    console.log('Network status updated:', isOnline ? 'online' : 'offline');
    this._isOnline = isOnline;
    
    const offlineIndicator = document.querySelector('.offline-indicator');
    if (offlineIndicator) {
      if (isOnline) {
        offlineIndicator.classList.remove('show');
      } else {
        offlineIndicator.classList.add('show');
      }
    }

    // Notify all registered callbacks
    this._callbacks.forEach(callback => {
      try {
        callback(isOnline);
      } catch (error) {
        console.error('Error in network status callback:', error);
      }
    });
  },

  registerCallback(callback) {
    if (typeof callback === 'function' && !this._callbacks.includes(callback)) {
      this._callbacks.push(callback);
      // Immediately call with current status
      try {
        callback(this._isOnline);
      } catch (error) {
        console.error('Error in initial network status callback:', error);
      }
    }
  },

  isOnline() {
    return this._isOnline;
  }
};

export default NetworkStatus; 