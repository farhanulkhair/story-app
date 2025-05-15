import 'regenerator-runtime';
import './styles/styles.css';
import './styles/responsive.css';
import App from './scripts/pages/app';
import { initNavigationDrawer } from './scripts/utils/index';

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize the navigation drawer
  initNavigationDrawer();
  
  const app = new App({
    content: document.querySelector('main'),
  });

  window.addEventListener('hashchange', () => {
    app.renderPage();
  });

  window.addEventListener('load', () => {
    app.renderPage();
  });
});