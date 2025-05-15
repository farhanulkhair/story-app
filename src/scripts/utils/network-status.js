const NetworkStatus = {
  _callbacks: [],

  init() {
    window.addEventListener('online', () => this._updateStatus(true));
    window.addEventListener('offline', () => this._updateStatus(false));
    
    // Initial status check
    this._updateStatus(navigator.onLine);
  },

  _updateStatus(isOnline) {
    const statusElement = document.getElementById('network-status');
    if (statusElement) {
      statusElement.textContent = isOnline ? 'Online' : 'Offline';
      statusElement.className = isOnline ? 'online' : 'offline';
    }

    // Notify all registered callbacks
    this._callbacks.forEach(callback => callback(isOnline));
  },

  registerCallback(callback) {
    this._callbacks.push(callback);
  },

  isOnline() {
    return navigator.onLine;
  }
};

export default NetworkStatus; 