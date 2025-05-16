const PWAInstaller = {
  init() {
    this._deferredPrompt = null;
    this._initListeners();
  },

  _initListeners() {
    // Tangkap event beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Simpan event untuk digunakan nanti
      this._deferredPrompt = e;
      // Update UI untuk menunjukkan tombol install
      this._showInstallPromotion();
    });

    // Tangkap event appinstalled
    window.addEventListener('appinstalled', () => {
      // Log install ke analytics
      console.log('PWA was installed');
      // Sembunyikan prompt instalasi
      this._hideInstallPromotion();
    });
  },

  async promptInstall() {
    if (!this._deferredPrompt) {
      console.log('No installation prompt available');
      return;
    }

    // Tampilkan prompt instalasi
    this._deferredPrompt.prompt();

    // Tunggu user untuk merespons prompt
    const { outcome } = await this._deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, discard it
    this._deferredPrompt = null;
  },

  _showInstallPromotion() {
    // Cari tombol install
    const installButton = document.getElementById('installButton');
    if (installButton) {
      installButton.classList.remove('hidden');
      installButton.addEventListener('click', () => this.promptInstall());
    }
  },

  _hideInstallPromotion() {
    const installButton = document.getElementById('installButton');
    if (installButton) {
      installButton.classList.add('hidden');
    }
  },

  // Cek apakah PWA sudah terinstall
  async isPWAInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    // Untuk iOS
    if (window.navigator.standalone === true) {
      return true;
    }
    return false;
  }
};

export default PWAInstaller; 