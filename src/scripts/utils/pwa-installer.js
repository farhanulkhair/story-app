let deferredPrompt;

const PWAInstaller = {
  init() {
    // Prevent the mini-infobar from appearing on mobile
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      deferredPrompt = e;
      this._showInstallPromotion();
    });

    // Handle the install button click
    document.getElementById('installButton')?.addEventListener('click', async () => {
      this._hideInstallPromotion();
      // Show the install prompt
      deferredPrompt.prompt();
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      // We've used the prompt, and can't use it again, discard it
      deferredPrompt = null;
    });

    // Handle the close button click
    document.getElementById('closeInstallPrompt')?.addEventListener('click', () => {
      this._hideInstallPromotion();
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      this._hideInstallPromotion();
      console.log('PWA was installed');
    });
  },

  _showInstallPromotion() {
    const installPrompt = document.getElementById('installPrompt');
    if (installPrompt) {
      installPrompt.classList.remove('hidden');
    }
  },

  _hideInstallPromotion() {
    const installPrompt = document.getElementById('installPrompt');
    if (installPrompt) {
      installPrompt.classList.add('hidden');
    }
  },
};

export default PWAInstaller; 