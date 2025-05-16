import CONFIG from "../config.js";
import AuthAPI from "./authAPI.js";
import StoryIdb from './database.js';

class StoryAPI {
  constructor() {
    if (StoryAPI.instance) {
      return StoryAPI.instance;
    }
    
    this.baseUrl = CONFIG.BASE_URL;
    StoryAPI.instance = this;
  }

  static getInstance() {
    if (!StoryAPI.instance) {
      StoryAPI.instance = new StoryAPI();
    }
    return StoryAPI.instance;
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
      const token = AuthAPI.getToken();
      if (!token) {
        return { error: true, message: "Not authenticated" };
      }

      console.log('Fetching stories from API...');
      const response = await fetch(`${this.baseUrl}/stories`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const responseJson = await response.json();
      console.log('API Response:', responseJson);

      if (responseJson.error) {
        return { error: true, message: responseJson.message };
      }

      // Get stories from the correct property (listStory)
      const stories = responseJson.listStory || [];
      console.log('Stories from API:', stories);

      // Store in IndexedDB for offline access
      if (stories.length > 0) {
        await StoryIdb.putBulkStories(stories);
        console.log('Stories saved to IndexedDB:', stories.length);
      }

      return {
        error: false,
        data: { stories }
      };
    } catch (error) {
      console.error('Error in getAllStories:', error);
      
      // If offline or error, try to get from IndexedDB
      try {
        const offlineStories = await StoryIdb.getAllStories();
        if (offlineStories.length > 0) {
          console.log('Using cached stories from IndexedDB:', offlineStories.length);
          return {
            error: false,
            message: 'Stories retrieved from local database',
            data: { stories: offlineStories },
          };
        }
      } catch (dbError) {
        console.error('Error getting stories from IndexedDB:', dbError);
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
      console.log('Starting addNewStory with:', { description, hasPhoto: !!photo, lat, lon });
      
      // Validate inputs
      if (!description || !photo) {
        return { error: true, message: "Description and photo are required" };
      }

      // Optimize photo if needed
      console.log('Optimizing photo...');
      const optimizedPhoto = await this._optimizePhoto(photo);
      
      const formData = new FormData();
      formData.append("description", description);
      formData.append("photo", optimizedPhoto);

      if (lat !== null && lon !== null) {
        formData.append("lat", lat.toString());
        formData.append("lon", lon.toString());
      }

      console.log('Sending story to API...');
      const token = AuthAPI.getToken();
      if (!token) {
        return { error: true, message: "Not authenticated" };
      }

      const response = await fetch(`${this.baseUrl}/stories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const responseJson = await response.json();
      console.log('Raw API Response:', responseJson);

      if (responseJson.error) {
        return { error: true, message: responseJson.message };
      }

      // Create story object with available data
      const newStory = {
        id: responseJson.story?.id || Date.now().toString(),
        name: responseJson.story?.name || 'Anonymous',
        description: description,
        photoUrl: responseJson.story?.photoUrl,
        createdAt: responseJson.story?.createdAt || new Date().toISOString(),
        lat: lat || null,
        lon: lon || null,
        userId: responseJson.story?.userId
      };

      console.log('Structured story for IndexedDB:', newStory);
      
      if (!responseJson.error) {
        // Save to IndexedDB
        console.log('Story saved successfully');
        await StoryIdb.putStory(newStory);

        // Refresh the stories list
        const allStoriesResult = await this.getAllStories();
        if (!allStoriesResult.error) {
          await StoryIdb.putBulkStories(allStoriesResult.data.stories);
          console.log('Stories in IndexedDB updated');
        }

        return {
          error: false,
          data: { story: newStory }
        };
      }
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
      const registration = await navigator.serviceWorker.ready;
      console.log('Service Worker ready for push notification');
      
      if (!registration.pushManager) {
        console.log('PushManager not available');
        return;
      }

      // Check if user is subscribed
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        console.log('User not subscribed to notifications');
        return;
      }

      console.log('User is subscribed, sending notification');
      
      const notificationData = {
        title: "Story App Notification",
        options: {
          body: "Story baru saja ditambahkan",
          icon: "/favicon.png",
          badge: "/favicon.png",
          vibrate: [100, 50, 100],
          data: {
            dateOfArrival: Date.now(),
            url: window.location.origin + '/#/home'
          }
        }
      };

      // Kirim pesan ke service worker
      console.log('Sending message to SW:', notificationData);
      registration.active.postMessage({
        type: 'PUSH_NOTIFICATION',
        data: notificationData
      });
      
      console.log('Push notification message sent');
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

  // Subscribe to push notifications
  async subscribePushNotification(subscription) {
    try {
      if (!subscription || !subscription.endpoint) {
        throw new Error('Invalid subscription object');
      }

      console.log('Sending subscription to server:', subscription);
      
      // Get subscription keys
      const subscriptionJson = subscription.toJSON();
      console.log('Subscription JSON:', subscriptionJson);

      const token = AuthAPI.getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${this.baseUrl}${CONFIG.PUSH_MSG_SUBSCRIBE_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscriptionJson.keys.p256dh,
            auth: subscriptionJson.keys.auth
          }
        })
      });

      const responseJson = await response.json();
      console.log('Server subscription response:', responseJson);

      if (!responseJson.error) {
        console.log('Successfully subscribed on server');
        await this.notifySubscription();
        
        // Save subscription status locally
        localStorage.setItem('notificationSubscribed', 'true');
        return responseJson;
      } else {
        console.error('Server subscription failed:', responseJson.message);
        throw new Error(responseJson.message || 'Server subscription failed');
      }
    } catch (error) {
      console.error('Error subscribing to push notification:', error);
      return { 
        error: true, 
        message: error.message || 'Failed to subscribe to push notifications' 
      };
    }
  }

  // Unsubscribe from push notifications
  async unsubscribePushNotification(subscription) {
    try {
      if (!subscription || !subscription.endpoint) {
        throw new Error('Invalid subscription object');
      }

      console.log('Sending unsubscription to server for endpoint:', subscription.endpoint);
      
      const token = AuthAPI.getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${this.baseUrl}${CONFIG.PUSH_MSG_UNSUBSCRIBE_URL}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint
        })
      });

      const responseJson = await response.json();
      console.log('Server unsubscribe response:', responseJson);

      if (!responseJson.error) {
        console.log('Successfully unsubscribed from server');
        await this.notifyUnsubscription();
        
        // Remove subscription status locally
        localStorage.removeItem('notificationSubscribed');
      } else {
        console.error('Server unsubscription failed:', responseJson.message);
        throw new Error(responseJson.message || 'Server unsubscription failed');
      }

      return responseJson;
    } catch (error) {
      console.error('Error unsubscribing from push notification:', error);
      return { 
        error: true, 
        message: error.message || 'Failed to unsubscribe from push notifications' 
      };
    }
  }

  // Check if notifications are subscribed
  async isSubscribed() {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) {
        return false;
      }

      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        localStorage.removeItem('notificationSubscribed');
        return false;
      }

      // If we have a subscription but no local storage flag, assume we're subscribed
      // This helps with page refreshes where localStorage might get cleared
      if (!localStorage.getItem('notificationSubscribed')) {
        localStorage.setItem('notificationSubscribed', 'true');
      }
      
      return true;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  }
}

// Create and export singleton instance
const storyAPI = StoryAPI.getInstance();
Object.freeze(storyAPI);
export default storyAPI;