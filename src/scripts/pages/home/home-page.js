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
    console.log('HomePage constructor called');
    this._presenter = null;
  }

  async render() {
    console.log('HomePage render called');
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
    console.log('HomePage afterRender called');
    if (!this._presenter) {
      console.log('Creating new HomePresenter');
      this._presenter = new HomePresenter(this);
    }
    
    console.log('Initializing presenter');
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

  setPresenter(presenter) {
    console.log('Setting presenter:', presenter);
    this._presenter = presenter;
  }
}

export default HomePage;