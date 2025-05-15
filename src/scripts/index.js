import "regenerator-runtime";
import "./styles/styles.css";
import "./styles/responsive.css";
import App from "./scripts/pages/app";
import { initNavigationDrawer } from "./scripts/utils/index";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

// Lazy load images implementation
import "lazysizes";
import "lazysizes/plugins/parent-fit/ls.parent-fit";

// Initialize the app when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Initialize the navigation drawer
  initNavigationDrawer();

  const app = new App({
    content: document.querySelector("main"),
  });

  window.addEventListener("hashchange", () => {
    app.renderPage();
  });

  window.addEventListener("load", () => {
    app.renderPage();
  });
});
