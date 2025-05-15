import HomePresenter from "./home-presenter";
import StoryAPI from "../../data/storyAPI";
import StoryIdb from "../../data/database";
import {
  createStoryItemTemplate,
  showLoading,
  hideLoading,
  showResponseMessage,
} from "../../utils/index";

class HomePage {
  constructor() {
    this._presenter = null;
  }

  async render() {
    return `
      <section class="content" id="mainContent" tabindex="0">
        <h2 class="content__heading">Semua Cerita</h2>
        
        <div class="search-container">
          <input 
            type="text" 
            id="searchInput" 
            class="search-input" 
            placeholder="Cari cerita..."
            aria-label="Cari cerita"
          >
        </div>

        <div class="map-container">
          <div id="storiesMap" class="stories-map"></div>
        </div>
        
        <div id="stories" class="stories"></div>

        <div id="offlineIndicator" class="offline-indicator">
          Anda sedang offline. Menampilkan data dari penyimpanan lokal.
        </div>
      </section>
    `;
  }

  async afterRender() {
    if (!this._presenter) {
      this._presenter = new HomePresenter(this);
    }
    
    await this._presenter.init();
    this._initSearchListener();
  }

  _initSearchListener() {
    const searchInput = document.querySelector('#searchInput');
    if (!searchInput) return;
    
    let searchTimeout;

    searchInput.addEventListener('input', (event) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const query = event.target.value.trim();
        this._presenter.handleSearch(query);
      }, 300);
    });
  }

  showOfflineIndicator() {
    const indicator = document.querySelector('#offlineIndicator');
    if (indicator) {
      indicator.classList.add('show');
    }
  }

  hideOfflineIndicator() {
    const indicator = document.querySelector('#offlineIndicator');
    if (indicator) {
      indicator.classList.remove('show');
    }
  }
}

export default HomePage;