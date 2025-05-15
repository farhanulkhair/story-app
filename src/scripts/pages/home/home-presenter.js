import StoryAPI from "../../data/storyAPI";
import StoryIdb from "../../data/database";
import {
  createStoryItemTemplate,
  showLoading,
  hideLoading,
  showResponseMessage,
} from "../../utils/index";

class HomePresenter {
  constructor(view) {
    console.log('HomePresenter constructor called with view:', view);
    this._view = view;
    this._stories = [];
    this._map = null;
    this._markers = [];
    this._isOnline = navigator.onLine;
    this._isInitialized = false;

    // Gunakan bind untuk memastikan konteks 'this' tetap terjaga
    this._boundStoryAddedHandler = this._handleStoryAdded.bind(this);
    this._initOnlineListener();
    this._initStoryAddedListener();
  }

  _initOnlineListener() {
    console.log('Initializing online listener');
    window.addEventListener('online', () => {
      console.log('Device went online');
      this._isOnline = true;
      this._view.hideOfflineIndicator();
      this.init(); // Refresh data when going online
    });

    window.addEventListener('offline', () => {
      console.log('Device went offline');
      this._isOnline = false;
      this._view.showOfflineIndicator();
    });
  }

  _initStoryAddedListener() {
    // Penting: Hapus event listener lama sebelum menambahkan yang baru
    window.removeEventListener('story-added', this._boundStoryAddedHandler);
    // Tambahkan event listener baru
    window.addEventListener('story-added', this._boundStoryAddedHandler);
    console.log('Story-added event listener initialized');
  }

  async _handleStoryAdded(event) {
    console.log('Story added event received:', event.detail);
    
    try {
      if (event.detail?.story) {
        const newStory = event.detail.story;
        
        // Update IndexedDB dengan story baru
        await StoryIdb.putStory(newStory);
        
        // Update list stories di memory dengan story baru
        this._stories = [newStory, ...this._stories];
        
        // Render ulang daftar stories
        this._renderStories();
        
        // Update marker di peta
        if (this._map) {
          this._updateMap();
        }
        
        console.log('Story list updated with new story');
      }
    } catch (error) {
      console.error('Error handling new story:', error);
    }
  }

  async init() {
    if (!this._isInitialized) {
      showLoading();
    }

    try {
      let result;
      
      if (this._isOnline) {
        // Ambil data dari API terlebih dahulu
        result = await StoryAPI.getAllStories();
        console.log('API Response:', result);
        
        if (!result.error) {
          // Simpan ke IndexedDB untuk akses offline
          await StoryIdb.putBulkStories(result.data.stories);
          console.log('Stories saved to IndexedDB:', result.data.stories.length, 'stories');
        }
      } else {
        // Jika offline, ambil dari IndexedDB
        const stories = await StoryIdb.getAllStories();
        result = {
          error: false,
          data: { stories },
        };
        console.log('Stories retrieved from IndexedDB:', stories.length, 'stories');
      }

      if (result.error) {
        this._showError(result.message);
      } else {
        this._stories = result.data.stories;
        console.log('Stories to render:', this._stories);
        this._renderStories();
        
        if (!this._isInitialized) {
          this._initMap();
          this._isInitialized = true;
        } else {
          this._updateMap();
        }
      }
    } catch (error) {
      console.error('Error in init:', error);
      this._showError("Gagal memuat cerita: " + error.message);
      
      // Jika error, coba ambil dari IndexedDB sebagai fallback
      try {
        const stories = await StoryIdb.getAllStories();
        if (stories.length > 0) {
          this._stories = stories;
          this._renderStories();
          if (!this._isInitialized) {
            this._initMap();
            this._isInitialized = true;
          } else {
            this._updateMap();
          }
          this._view.showOfflineIndicator();
          console.log('Using cached stories from IndexedDB:', stories.length, 'stories');
        }
      } catch (dbError) {
        console.error('Error getting stories from IndexedDB:', dbError);
      }
    } finally {
      hideLoading();
    }
  }

  async handleSearch(query) {
    showLoading();
    try {
      let stories;
      if (query) {
        stories = await StoryIdb.searchStories(query);
      } else {
        stories = await StoryIdb.getAllStories();
      }

      this._stories = stories;
      this._renderStories();
      this._updateMap();
    } catch (error) {
      this._showError("Gagal mencari cerita: " + error.message);
    } finally {
      hideLoading();
    }
  }

  _showError(message) {
    showResponseMessage(message);
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

  _initMap() {
    const mapContainer = document.querySelector("#storiesMap");
    if (!mapContainer) return;
    
    if (!this._map) {
      this._map = L.map("storiesMap").setView([-2.548926, 118.014863], 5);

      const baseLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        }
      ).addTo(this._map);

      const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
          maxZoom: 18,
        }
      );

      const topoLayer = L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        {
          attribution:
            'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a>',
          maxZoom: 17,
        }
      );

      const baseLayers = {
        "Peta Jalan": baseLayer,
        Satelit: satelliteLayer,
        Topografi: topoLayer,
      };

      L.control.layers(baseLayers).addTo(this._map);
    }

    this._updateMap();
  }

  _updateMap() {
    if (!this._map) return;
    
    // Clear existing markers
    if (this._markers.length > 0) {
      this._markers.forEach(marker => marker.remove());
      this._markers = [];
    }

    // Add new markers
    this._stories.forEach((story) => {
      if (story.lat && story.lon) {
        const marker = L.marker([story.lat, story.lon]).addTo(this._map);
        marker.bindPopup(`
          <div class="marker-popup">
            <h3>${story.name}</h3>
            <img src="${story.photoUrl}" alt="Foto oleh ${story.name}" style="width: 100px;">
            <p>${story.description.substring(0, 100)}${
          story.description.length > 100 ? "..." : ""
        }</p>
            <a href="#/detail/${story.id}">Lihat Detail</a>
          </div>
        `);
        this._markers.push(marker);
      }
    });

    // Fit bounds if there are markers
    if (this._markers.length > 0) {
      const group = L.featureGroup(this._markers);
      this._map.fitBounds(group.getBounds());
    }
  }
}

export default HomePresenter;