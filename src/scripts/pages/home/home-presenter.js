import StoryAPI from "../../data/storyAPI.js";
import StoryIdb from "../../data/database.js";
import {
  createStoryItemTemplate,
  showLoading,
  hideLoading,
  showResponseMessage,
} from "../../utils/template";
import AuthAPI from "../../data/authAPI.js";
import NetworkStatus from "../../utils/network-status";
import CONFIG from "../../config";
import NotificationHelper from "../../utils/notification-helper.js";

class HomePresenter {
  constructor(view) {
    console.log('HomePresenter constructor called with view:', view);
    this._view = view;
    this._stories = [];
    this._map = null;
    this._markers = [];
    this._isInitialized = false;
    this._refreshInterval = null;
    this._refreshRate = 10000; // Refresh every 10 seconds
    this._isFetching = false;
    this._lastFetchedStoryId = null;

    // Bind event handlers
    this._handleStoryAdded = this._handleStoryAdded.bind(this);
    this._boundVisibilityChange = this._handleVisibilityChange.bind(this);
  }

  async init() {
    console.log('Initializing HomePresenter');
    showLoading();

    try {
      // Initialize listeners
      this._initOnlineListener();
      this._initStoryAddedListener();
      this._initVisibilityListener();
      this._startPeriodicRefresh();

      // Load initial data
      if (NetworkStatus.isOnline()) {
        await this._fetchFreshData();
      } else {
        await this._loadFromIndexedDB();
      }
      
      // Initialize map after data is loaded
      await this._initMap();
      this._isInitialized = true;
    } catch (error) {
      console.error('Error in init:', error);
      showResponseMessage('Gagal memuat cerita: ' + error.message);
    } finally {
      hideLoading();
    }
  }

  _initOnlineListener() {
    console.log('Initializing online listener');
    this._onlineCallback = async (isOnline) => {
      console.log('Network status changed:', isOnline ? 'online' : 'offline');
      if (isOnline) {
        console.log('Device is online, refreshing data...');
        this._view.hideOfflineIndicator();
        await this._fetchFreshData();
      } else {
        console.log('Device is offline, showing indicator');
        this._view.showOfflineIndicator();
        await this._loadFromIndexedDB();
      }
    };
    NetworkStatus.registerCallback(this._onlineCallback);
  }

  _initStoryAddedListener() {
    console.log('Initializing story-added event listener');
    window.removeEventListener('story-added', this._handleStoryAdded);
    window.addEventListener('story-added', this._handleStoryAdded);
    console.log('Story-added event listener registered successfully');
  }

  _initVisibilityListener() {
    document.addEventListener('visibilitychange', this._boundVisibilityChange);
  }

  _handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      console.log('Page became visible, refreshing data...');
      this._fetchFreshData(true);
    }
  }

  _startPeriodicRefresh() {
    console.log('Starting periodic refresh...');
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
    }

    this._refreshInterval = setInterval(async () => {
      if (NetworkStatus.isOnline() && document.visibilityState === 'visible' && !this._isFetching) {
        console.log('Performing periodic refresh...');
        await this._fetchFreshData(true);
      }
    }, this._refreshRate);
  }

  _stopPeriodicRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  }

  async _handleStoryAdded(event) {
    console.log('Story added event received:', event.detail);
    
    try {
      if (!event.detail?.story) {
        throw new Error('Invalid story data received');
      }

      // Add the new story to IndexedDB first
      await StoryIdb.putStory(event.detail.story);
      
      // Get fresh list from IndexedDB
      const stories = await StoryIdb.getAllStories();
      this._stories = stories;
      
      // Update the view
      this._view.updateStoryList(this._stories);
      
      // Update map if initialized
      if (this._map) {
        this._updateMap();
      }

      // Fetch fresh data in the background without blocking
      this._fetchFreshData().catch(error => {
        console.warn('Background data refresh failed:', error);
      });
    } catch (error) {
      console.error('Error handling new story:', error);
      showResponseMessage('Terjadi kesalahan saat memperbarui daftar cerita: ' + (error.message || 'Unknown error'));
    }
  }

  async _fetchFreshData() {
    try {
      if (!StoryAPI) {
        throw new Error('StoryAPI is not initialized');
      }

      console.log('Fetching fresh data...');
      this._isFetching = true;

      const response = await StoryAPI.getAllStories().catch(error => {
        console.error('Error calling getAllStories:', error);
        throw new Error('Failed to fetch stories: ' + (error.message || 'Unknown error'));
      });
      
      console.log('Response from getAllStories:', response);
      
      if (!response.error && response.data?.stories) {
        // Ensure stories are sorted by createdAt before syncing
        const sortedStories = response.data.stories.sort((a, b) => {
          const dateB = new Date(b.createdAt);
          const dateA = new Date(a.createdAt);
          return dateB - dateA;
        });

        // Get current stories from IndexedDB for comparison
        const currentStories = await StoryIdb.getAllStories();
        
        // Find truly new stories (not in IndexedDB and created in last minute)
        const thirtySecondsAgo = new Date(Date.now() - 30000); // 30 seconds ago
        const newStories = sortedStories.filter(newStory => {
          // Check if story is really new (created in last 30 seconds)
          const storyDate = new Date(newStory.createdAt);
          if (storyDate < thirtySecondsAgo) {
            return false; // Skip old stories
          }

          // Check if story exists in current stories
          const exists = currentStories.some(existingStory => 
            existingStory.id === newStory.id
          );

          // Only include stories that don't exist and aren't our own
          return !exists && newStory.id !== this._lastFetchedStoryId;
        });

        console.log('Truly new stories found:', newStories.length);
        
        if (newStories.length > 0) {
          console.log('Sending notifications for new stories:', newStories);
          // Sort new stories by creation date (newest first) and only notify for the latest one
          const latestStory = newStories[0]; // Get only the most recent story
          
          await this._notifyNewStories([latestStory]);
          this._lastFetchedStoryId = latestStory.id;
        }

        // Update stories in IndexedDB
        await StoryIdb.syncStories(sortedStories);
        
        // Update the stories list and view
        this._stories = await StoryIdb.getAllStories();
        if (this._view && typeof this._view.updateStoryList === 'function') {
          this._view.updateStoryList(this._stories);
        } else {
          console.error('View or updateStoryList not properly initialized');
        }
        
        // Update map if needed
        if (this._map) {
          this._updateMap();
        }
      } else {
        throw new Error(response.message || 'Failed to fetch stories');
      }
    } catch (error) {
      console.error('Error fetching fresh data:', error);
      // Try to load from IndexedDB as fallback
      await this._loadFromIndexedDB();
      throw error;
    } finally {
      this._isFetching = false;
    }
  }

  async _notifyNewStories(newStories) {
    try {
      // Cek apakah notifikasi diizinkan
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        console.log('User not subscribed to notifications');
        return;
      }

      // Kirim notifikasi untuk setiap story baru (reverse order agar yang terbaru muncul terakhir)
      for (const story of [...newStories].reverse()) {
        await NotificationHelper.sendNotification({
          title: 'Story Baru dari ' + story.name,
          options: {
            body: story.description.substring(0, 100) + (story.description.length > 100 ? '...' : ''),
            icon: story.photoUrl || '/favicon.png',
            badge: '/favicon.png',
            tag: `new-story-${story.id}`, // Unique tag per story
            renotify: true,
            timestamp: new Date(story.createdAt).getTime(),
            data: {
              url: `/#/detail/${story.id}`,
              storyId: story.id,
              createdAt: story.createdAt,
            },
            vibrate: [100, 50, 100],
            actions: [
              {
                action: 'view',
                title: 'Lihat Story'
              },
              {
                action: 'close',
                title: 'Tutup'
              }
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  async _loadFromIndexedDB() {
    try {
      const stories = await StoryIdb.getAllStories();
      if (stories.length > 0) {
        console.log('Loading stories from IndexedDB:', stories.length);
        this._stories = stories;
        if (this._view && typeof this._view.updateStoryList === 'function') {
          this._view.updateStoryList(this._stories);
        } else {
          console.error('View or updateStoryList not properly initialized');
        }
        
        if (!this._isInitialized) {
          await this._initMap();
          this._isInitialized = true;
        } else {
          this._updateMap();
        }
      } else {
        console.log('No stories found in IndexedDB');
        if (this._view && typeof this._view.showEmptyMessage === 'function') {
          this._view.showEmptyMessage();
        }
      }
    } catch (error) {
      console.error('Error loading from IndexedDB:', error);
      showResponseMessage('Gagal memuat data dari penyimpanan lokal');
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
      this._view.updateStoryList(this._stories);
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

  async _initMap() {
    try {
      const mapContainer = document.querySelector("#storiesMap");
      if (!mapContainer) {
        console.warn('Map container not found, waiting for container...');
        // Wait for the container to be available
        await new Promise(resolve => {
          const observer = new MutationObserver((mutations, obs) => {
            const container = document.querySelector("#storiesMap");
            if (container) {
              obs.disconnect();
              resolve();
            }
          });
          
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        });
      }
      
      // Clean up existing map if any
      if (this._map) {
        this._map.remove();
        this._map = null;
        this._markers = [];
      }

      console.log('Initializing map...');
      
      // Configure default icon
      L.Icon.Default.prototype.options.imagePath = 'https://unpkg.com/leaflet@1.9.4/dist/images/';
      
      this._map = L.map("storiesMap", {
        minZoom: 2,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: true
      }).setView([-2.548926, 118.014863], 5);

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
      
      // Force a resize event to ensure proper rendering
      setTimeout(() => {
        this._map.invalidateSize();
      }, 100);

      console.log('Map initialized successfully');
      this._updateMap();
    } catch (error) {
      console.error('Error initializing map:', error);
      throw error;
    }
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

  destroy() {
    console.log('Cleaning up HomePresenter...');
    
    // Clear refresh interval
    this._stopPeriodicRefresh();
    
    // Remove event listeners
    window.removeEventListener('story-added', this._handleStoryAdded);
    document.removeEventListener('visibilitychange', this._boundVisibilityChange);
    
    // Remove network status callback
    if (this._onlineCallback) {
      NetworkStatus.unregisterCallback(this._onlineCallback);
    }
    
    // Clean up map thoroughly
    if (this._map) {
      // Remove all markers
      this._markers.forEach(marker => {
        marker.remove();
        if (marker.getPopup()) {
          marker.getPopup().remove();
        }
      });
      this._markers = [];

      // Remove all layers
      this._map.eachLayer((layer) => {
        layer.remove();
      });

      // Remove the map
      this._map.remove();
      this._map = null;

      // Clean up any remaining map tiles
      const mapTiles = document.querySelectorAll('.leaflet-tile');
      mapTiles.forEach(tile => tile.remove());

      // Remove any remaining Leaflet-related elements
      const leafletContainers = document.querySelectorAll('.leaflet-container');
      leafletContainers.forEach(container => container.remove());
    }

    // Reset state
    this._stories = [];
    this._isInitialized = false;
    this._isFetching = false;
  }
}

export default HomePresenter;