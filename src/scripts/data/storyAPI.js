import CONFIG from "../config.js";
import AuthAPI from "../data/authAPI.js";
import StoryIdb from './database';

class StoryAPI {
  constructor() {
    this.baseUrl = CONFIG.BASE_URL;
  }

  // Generic GET request
  async #get(endpoint) {
    try {
      const token = AuthAPI.getToken();
      if (!token) {
        return { error: true, message: "Not authenticated" };
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const responseJson = await response.json();

      if (responseJson.error) {
        return { error: true, message: responseJson.message };
      }
      return { error: false, data: responseJson };
    } catch (error) {
      return { error: true, message: "Network Error" };
    }
  }

  // Generic POST request
  async #post(endpoint, body, isFormData = false) {
    try {
      const token = AuthAPI.getToken();
      if (!token) {
        return { error: true, message: "Not authenticated" };
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      if (!isFormData) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: isFormData ? body : JSON.stringify(body),
      });
      const responseJson = await response.json();

      if (responseJson.error) {
        return { error: true, message: responseJson.message };
      }
      return { error: false, data: responseJson };
    } catch (error) {
      return { error: true, message: "Network Error" };
    }
  }

  // Generic DELETE request
  async #delete(endpoint) {
    try {
      const token = AuthAPI.getToken();
      if (!token) {
        return { error: true, message: "Not authenticated" };
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const responseJson = await response.json();

      if (responseJson.error) {
        return { error: true, message: responseJson.message };
      }
      return { error: false, data: responseJson };
    } catch (error) {
      return { error: true, message: "Network Error" };
    }
  }

  // Fetch all stories
  async getAllStories() {
    try {
      // Try to get from IndexedDB first
      const offlineStories = await StoryIdb.getAllStories();
      if (offlineStories.length > 0) {
        console.log('Getting stories from IndexedDB');
        return {
          error: false,
          message: 'Stories retrieved from local database',
          data: { stories: offlineStories },
        };
      }

      // If no offline data, fetch from API
      const response = await fetch(`${this.baseUrl}/stories`);
      const responseJson = await response.json();

      if (responseJson.error) {
        return responseJson;
      }

      // Store in IndexedDB for offline access
      await StoryIdb.putBulkStories(responseJson.data.stories);
      return responseJson;
    } catch (error) {
      console.error('Error in getAllStories:', error);
      
      // If offline, try to get from IndexedDB
      const offlineStories = await StoryIdb.getAllStories();
      if (offlineStories.length > 0) {
        return {
          error: false,
          message: 'Stories retrieved from local database',
          data: { stories: offlineStories },
        };
      }

      return {
        error: true,
        message: 'Failed to fetch stories',
      };
    }
  }

  // Fetch story details by ID
  async getStoryDetail(id) {
    try {
      console.log('Getting story detail for ID:', id);
      
      // Try to get from IndexedDB first
      const story = await StoryIdb.getStory(id);
      if (story) {
        console.log('Story found in IndexedDB:', story);
        return {
          error: false,
          message: 'Story retrieved from local database',
          data: { story },
        };
      }

      console.log('Story not found in IndexedDB, fetching from API...');
      const token = AuthAPI.getToken();
      if (!token) {
        console.error('No auth token found');
        return { error: true, message: "Not authenticated" };
      }

      // If not in IndexedDB, fetch from API
      const response = await fetch(`${this.baseUrl}/stories/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const responseJson = await response.json();
      console.log('API Response:', responseJson);

      if (responseJson.error) {
        console.error('API returned error:', responseJson.message);
        return responseJson;
      }

      // Store in IndexedDB for offline access
      if (responseJson.story) {
        await StoryIdb.putStory(responseJson.story);
        console.log('Story saved to IndexedDB');
      }

      return {
        error: false,
        data: { story: responseJson.story }
      };
    } catch (error) {
      console.error('Error in getStoryDetail:', error);
      return {
        error: true,
        message: 'Failed to fetch story detail',
      };
    }
  }

  // Add a new story
  async addNewStory({ description, photo, lat, lon }) {
    try {
      // Validate inputs
      if (!description || !photo) {
        return { error: true, message: "Description and photo are required" };
      }

      // Optimize photo if needed
      const optimizedPhoto = await this._optimizePhoto(photo);
      
      const formData = new FormData();
      formData.append("description", description);
      formData.append("photo", optimizedPhoto);

      if (lat !== null && lon !== null) {
        formData.append("lat", lat);
        formData.append("lon", lon);
      }

      const result = await this.#post("/stories", formData, true);
      
      if (!result.error) {
        // Send push notification asynchronously without waiting
        this._sendPushNotification(description).catch(console.error);
        
        // Save to IndexedDB asynchronously
        this._saveToIndexedDB(result.data.story).catch(console.error);
      }

      return result;
    } catch (error) {
      console.error('Error in addNewStory:', error);
      return { 
        error: true, 
        message: error.message || "Failed to add story" 
      };
    }
  }

  // Private method to optimize photo
  async _optimizePhoto(photoBlob) {
    try {
      // If photo is already small enough, return as is
      if (photoBlob.size <= 1024 * 1024) { // 1MB
        return photoBlob;
      }

      // Create an image element
      const img = document.createElement('img');
      const photoUrl = URL.createObjectURL(photoBlob);
      
      // Wait for image to load
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = photoUrl;
      });

      // Create canvas for resizing
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while maintaining aspect ratio
      const maxDimension = 1280; // Max width or height
      if (width > height && width > maxDimension) {
        height = (height * maxDimension) / width;
        width = maxDimension;
      } else if (height > maxDimension) {
        width = (width * maxDimension) / height;
        height = maxDimension;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress image
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Clean up
      URL.revokeObjectURL(photoUrl);

      // Convert to blob with reduced quality
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob),
          'image/jpeg',
          0.7 // 70% quality
        );
      });
    } catch (error) {
      console.error('Error optimizing photo:', error);
      return photoBlob; // Return original if optimization fails
    }
  }

  // Private method to save to IndexedDB
  async _saveToIndexedDB(story) {
    try {
      const db = await openDB(CONFIG.DATABASE_NAME, CONFIG.DATABASE_VERSION);
      const tx = db.transaction(CONFIG.OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CONFIG.OBJECT_STORE_NAME);
      await store.put(story);
      await tx.done;
    } catch (error) {
      console.error('Error saving to IndexedDB:', error);
    }
  }

  // Handle subscription notification
  async notifySubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.pushManager) {
        const notificationData = {
          title: "Notifikasi Diaktifkan",
          options: {
            body: "Anda akan menerima notifikasi untuk setiap story baru yang dibuat",
            icon: "/icons/icon-72x72.png",
            badge: "/icons/icon-72x72.png"
          }
        };

        // Send notification data to service worker
        registration.active.postMessage({
          type: 'PUSH_NOTIFICATION',
          data: notificationData
        });
      }
    } catch (error) {
      console.error('Error sending subscription notification:', error);
    }
  }

  // Handle unsubscription notification
  async notifyUnsubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.pushManager) {
        const notificationData = {
          title: "Notifikasi Dinonaktifkan",
          options: {
            body: "Anda tidak akan menerima notifikasi lagi untuk story baru",
            icon: "/icons/icon-72x72.png",
            badge: "/icons/icon-72x72.png"
          }
        };

        // Send notification data to service worker
        registration.active.postMessage({
          type: 'PUSH_NOTIFICATION',
          data: notificationData
        });
      }
    } catch (error) {
      console.error('Error sending unsubscription notification:', error);
    }
  }

  // Send push notification for new story
  async _sendPushNotification(description) {
    try {
      const token = AuthAPI.getToken();
      if (!token) {
        return { error: true, message: "Not authenticated" };
      }

      const notificationData = {
        title: "Story berhasil dibuat",
        options: {
          body: `Anda telah membuat story baru dengan deskripsi: ${description}`,
          icon: "/icons/icon-72x72.png",
          badge: "/icons/icon-72x72.png",
          vibrate: [100, 50, 100],
          data: {
            dateOfArrival: Date.now(),
            primaryKey: 1,
            url: window.location.href
          }
        }
      };

      const registration = await navigator.serviceWorker.ready;
      if (registration.pushManager) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Send notification data to service worker
          registration.active.postMessage({
            type: 'PUSH_NOTIFICATION',
            data: notificationData
          });
        }
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Delete a story
  async deleteStory(id) {
    try {
      const response = await fetch(`${this.baseUrl}/stories/${id}`, {
        method: 'DELETE',
      });

      const responseJson = await response.json();

      if (!responseJson.error) {
        // Delete from IndexedDB if successful
        await StoryIdb.deleteStory(id);
      }

      return responseJson;
    } catch (error) {
      console.error('Error in deleteStory:', error);
      return {
        error: true,
        message: 'Failed to delete story',
      };
    }
  }

  // Add search functionality using IndexedDB
  async searchStories(query) {
    try {
      return await StoryIdb.searchStories(query);
    } catch (error) {
      console.error('Error in searchStories:', error);
      return [];
    }
  }
}

export default new StoryAPI();