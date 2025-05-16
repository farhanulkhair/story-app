import UrlParser from "../../routes/url-parser";
import { createStoryDetailTemplate } from "../../utils/template";
import StoryDetailPresenter from "./story-detail-presenter";
import L from 'leaflet';

class StoryDetailPage {
  constructor() {
    console.log('StoryDetailPage constructor called');
    this._map = null;
    this._presenter = null;
    this._container = null;
  }

  async render() {
    console.log('StoryDetailPage render called');
    return `
      <section class="content" id="mainContent">
        <div id="storyDetail" class="story-detail-container">
          <div class="loading-container">
            <p>Memuat story...</p>
          </div>
        </div>
      </section>
    `;
  }

  async afterRender() {
    console.log('StoryDetailPage afterRender called');
    this._container = document.querySelector("#storyDetail");
    
    if (!this._container) {
      console.error('Story detail container not found');
      return;
    }
    console.log('Container element found:', this._container);
    
    const url = UrlParser.parseActiveUrlWithoutCombiner();
    console.log('Parsed URL:', url);
    
    if (!url.id) {
      console.error('No story ID found in URL');
      this.displayError('ID story tidak valid');
      return;
    }
    
    this._presenter = new StoryDetailPresenter({
      view: this,
      storyId: url.id,
    });

    try {
      await this._presenter.init();
    } catch (error) {
      console.error('Error initializing presenter:', error);
      this.displayError(error.message || 'Gagal memuat story');
    }
  }

  displayStory(story, isOwner) {
    console.log('StoryDetailPage.displayStory called with:', { story, isOwner });
    if (!this._container) {
      console.error('Container element not found');
      return;
    }
    
    if (!story) {
      console.error('Story data is missing');
      this.displayError('Data story tidak ditemukan');
      return;
    }

    try {
      // Render story content
      this._container.innerHTML = createStoryDetailTemplate(story);
      console.log('Story template rendered');

      // Add delete button if user is the owner
      if (isOwner) {
        console.log('Adding delete button for owner');
        this._addDeleteButton();
      }

      // Initialize map if story has location
      if (story.lat && story.lon) {
        console.log('Initializing map for location:', { lat: story.lat, lon: story.lon });
        this._initMap(story);
      }

      // Add lazy loading for images
      this._initializeLazyLoading();
      console.log('Story detail page fully rendered');
    } catch (error) {
      console.error('Error displaying story:', error);
      this.displayError('Terjadi kesalahan saat menampilkan story');
    }
  }

  _addDeleteButton() {
    const actionContainer = document.createElement('div');
    actionContainer.className = 'story-actions';
    actionContainer.innerHTML = `
      <button class="btn btn-danger" id="deleteStoryBtn">
        <i class="fas fa-trash"></i> Hapus Story
      </button>
    `;
    this._container.appendChild(actionContainer);

    // Add delete event listener
    document.getElementById('deleteStoryBtn')?.addEventListener('click', async () => {
      await this._presenter.deleteStory();
    });
  }

  _initMap(story) {
    // Clean up existing map if any
    if (this._map) {
      this._map.remove();
      this._map = null;
    }

    const mapContainer = document.getElementById('mapDetail');
    if (!mapContainer) return;

    try {
      this._map = L.map('mapDetail').setView([story.lat, story.lon], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(this._map);

      // Add marker for story location
      const marker = L.marker([story.lat, story.lon])
        .addTo(this._map)
        .bindPopup(`<b>${story.name}</b><br>Lokasi story`)
        .openPopup();

      // Force map to update its size
      setTimeout(() => {
        this._map.invalidateSize();
        this._map.setView([story.lat, story.lon], 13);
      }, 100);
    } catch (error) {
      console.error('Error initializing map:', error);
      mapContainer.innerHTML = '<p class="error-message">Gagal memuat peta</p>';
    }
  }

  _initializeLazyLoading() {
    const images = document.querySelectorAll('img.lazyload');
    images.forEach(img => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
      }
    });
  }

  displayError(message) {
    console.log('Displaying error:', message);
    if (!this._container) {
      console.error('Container element not found for error display');
      return;
    }
    
    this._container.innerHTML = `
      <div class="error-container">
        <p class="error-message">${message}</p>
        <a href="#/home" class="btn btn-primary">
          <i class="fas fa-home"></i> Kembali ke Beranda
        </a>
      </div>
    `;
  }

  cleanup() {
    if (this._map) {
      this._map.remove();
      this._map = null;
    }
  }
}

export default StoryDetailPage;
