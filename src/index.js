import 'regenerator-runtime';
import './styles/styles.css';
import './styles/responsive.css';
import App from './scripts/pages/app';
import { initNavigationDrawer } from './scripts/utils/template';
import swRegister from './scripts/utils/sw-register';
import PWAInstaller from './scripts/utils/pwa-installer';

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize the navigation drawer
  initNavigationDrawer();
  
  const app = new App({
    content: document.querySelector('main'),
  });

  // Initialize PWA installer
  PWAInstaller.init({
    installButton: document.getElementById('installButton'),
    closeInstallPrompt: document.getElementById('closeInstallPrompt'),
    installPrompt: document.getElementById('installPrompt'),
  });

  window.addEventListener('hashchange', () => {
    app.renderPage();
  });

  window.addEventListener('load', () => {
    app.renderPage();
  });

  // Register service worker
  await swRegister();
});