import HomePresenter from "./home-presenter";
import StoryAPI from "../../data/storyAPI";
import StoryIdb from "../../data/database";
import {
  createStoryItemTemplate,
  showLoading,
  hideLoading,
  showResponseMessage,
} from "../../utils/template";

class HomePage {
  constructor() {
    console.log('HomePage constructor called');
    this._presenter = null;
    this._boundHashChangeHandler = this._handleHashChange.bind(this);
    this._stories = [];
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
    try {
      // Initialize presenter if not already initialized
      if (!this._presenter) {
        console.log('Creating new HomePresenter');
        this._presenter = new HomePresenter(this);
      }
      
      console.log('Initializing presenter');
      await this._presenter.init();
      this._initSearchListener();
      
      // Add hash change listener
      window.addEventListener('hashchange', this._boundHashChangeHandler);
    } catch (error) {
      console.error('Error in afterRender:', error);
      showResponseMessage('Error initializing page: ' + error.message);
    }
  }

  _handleHashChange(event) {
    const newHash = window.location.hash;
    // If navigating away from home page
    if (!newHash.startsWith('#/') && !newHash.startsWith('#/home')) {
      this.destroy();
    }
  }

  destroy() {
    console.log('HomePage destroy called');
    if (this._presenter) {
      this._presenter.destroy();
      this._presenter = null;
    }
    window.removeEventListener('hashchange', this._boundHashChangeHandler);
  }

  hideOfflineIndicator() {
    const indicator = document.querySelector('#offlineIndicator');
    if (indicator) {
      indicator.classList.remove('show');
    }
  }

  showOfflineIndicator() {
    const indicator = document.querySelector('#offlineIndicator');
    if (indicator) {
      indicator.classList.add('show');
    }
  }

  showEmptyMessage() {
    const container = document.querySelector("#stories");
    if (container) {
      container.innerHTML = '<div class="no-results">Tidak ada cerita yang tersedia</div>';
    }
  }

  setPresenter(presenter) {
    console.log('Setting presenter:', presenter);
    if (this._presenter && this._presenter !== presenter) {
      this._presenter.destroy();
    }
    this._presenter = presenter;
  }

  updateStoryList(stories) {
    console.log('Updating story list with', stories?.length, 'stories');
    if (!stories) {
      console.warn('No stories provided to updateStoryList');
      return;
    }
    this._stories = stories;
    this._renderStories();
  }

  _renderStories() {
    console.log('Rendering stories:', this._stories);
    const container = document.querySelector("#stories");
    if (!container) {
      console.error('Stories container not found!');
      return;
    }

    container.innerHTML = "";

    if (!this._stories || this._stories.length === 0) {
      console.log('No stories to display');
      container.innerHTML = '<div class="no-results">Tidak ada cerita yang ditemukan</div>';
      return;
    }

    console.log('Adding stories to container');
    this._stories.forEach((story) => {
      container.innerHTML += createStoryItemTemplate(story);
    });
    console.log('Stories rendered successfully');
  }

  _initSearchListener() {
    const searchInput = document.querySelector('#searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        if (this._presenter) {
          this._presenter.handleSearch(event.target.value);
        }
      });
    }
  }
}

export default HomePage;