import { openDB } from 'idb';
import CONFIG from '../config';

const DATABASE_NAME = CONFIG.DATABASE_NAME;
const DATABASE_VERSION = CONFIG.DATABASE_VERSION;
const OBJECT_STORE_NAME = CONFIG.OBJECT_STORE_NAME;

const StoryIdb = {
  async getDatabase() {
    return openDB(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(database) {
        // Create object store if it doesn't exist
        if (!database.objectStoreNames.contains(OBJECT_STORE_NAME)) {
          const store = database.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'id' });
          
          // Add indexes for common queries
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      },
    });
  },

  async getAllStories() {
    try {
      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readonly');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      const stories = await store.getAll();
      
      // Always sort by createdAt in descending order (newest first)
      return stories.sort((a, b) => {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Error getting all stories:', error);
      return [];
    }
  },

  async getStory(id) {
    try {
      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readonly');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      return await store.get(id);
    } catch (error) {
      console.error('Error getting story:', error);
      return null;
    }
  },

  async putStory(story) {
    try {
      if (!story || !story.id) {
        throw new Error('Invalid story data: missing ID');
      }

      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      
      // Ensure required fields exist
      const storyToStore = {
        ...story,
        createdAt: story.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await store.put(storyToStore);
      await tx.done;
    } catch (error) {
      console.error('Error putting story:', error);
      throw error; // Re-throw to handle in calling code
    }
  },

  async deleteStory(id) {
    try {
      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      await store.delete(id);
      await tx.done;
      return true;
    } catch (error) {
      console.error('Error deleting story:', error);
      return false;
    }
  },

  async searchStories(query) {
    try {
      const stories = await this.getAllStories();
      return stories.filter((story) => {
        const loweredQuery = query.toLowerCase();
        return (
          story.description?.toLowerCase().includes(loweredQuery) ||
          story.name?.toLowerCase().includes(loweredQuery)
        );
      });
    } catch (error) {
      console.error('Error searching stories:', error);
      return [];
    }
  },

  async putBulkStories(stories) {
    if (!Array.isArray(stories)) {
      console.error('Invalid input: stories must be an array');
      return null;
    }

    try {
      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      
      const timestamp = new Date().toISOString();
      
      await Promise.all(stories.map((story) => {
        if (!story || !story.id) {
          console.warn('Skipping invalid story:', story);
          return Promise.resolve();
        }
        
        return store.put({
          ...story,
          updatedAt: timestamp,
          createdAt: story.createdAt || timestamp,
        });
      }));
      
      await tx.done;
      return stories;
    } catch (error) {
      console.error('Error putting bulk stories:', error);
      return null;
    }
  },

  async getStoriesByDateRange(startDate, endDate) {
    try {
      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readonly');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      
      try {
        const index = store.index('createdAt');
        const stories = await index.getAll(IDBKeyRange.bound(
          startDate.toISOString(),
          endDate.toISOString()
        ));
        return stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } catch (indexError) {
        // Fallback if index doesn't exist
        console.warn('CreatedAt index not found, falling back to full scan');
        const allStories = await store.getAll();
        return allStories.filter(story => {
          const storyDate = new Date(story.createdAt);
          return storyDate >= startDate && storyDate <= endDate;
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    } catch (error) {
      console.error('Error getting stories by date range:', error);
      return [];
    }
  },

  async getLatestStories(limit = 10) {
    try {
      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readonly');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      
      try {
        const index = store.index('createdAt');
        const stories = await index.getAll();
        return stories
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, limit);
      } catch (indexError) {
        // Fallback if index doesn't exist
        console.warn('CreatedAt index not found, falling back to full scan');
        const stories = await store.getAll();
        return stories
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, limit);
      }
    } catch (error) {
      console.error('Error getting latest stories:', error);
      return [];
    }
  },

  async syncStories(onlineStories) {
    if (!Array.isArray(onlineStories)) {
      console.error('Invalid input: onlineStories must be an array');
      throw new Error('Invalid input: onlineStories must be an array');
    }

    try {
      console.log('Starting sync with online stories:', onlineStories.length);
      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      
      // Get all local stories
      const localStories = await store.getAll();
      console.log('Local stories found:', localStories.length);
      
      // Create a map of online stories
      const onlineStoriesMap = new Map(
        onlineStories.map(story => [story.id, story])
      );
      
      // Delete stories that exist locally but not online
      const storiesToDelete = localStories.filter(story => !onlineStoriesMap.has(story.id));
      console.log('Stories to delete:', storiesToDelete.length);
      
      await Promise.all(
        storiesToDelete.map(story => store.delete(story.id))
      );
      
      // Update or add online stories
      const timestamp = new Date().toISOString();
      console.log('Updating/adding online stories...');
      
      await Promise.all(
        onlineStories.map(story => {
          if (!story || !story.id) {
            console.warn('Skipping invalid story during sync:', story);
            return Promise.resolve();
          }
          
          return store.put({
            ...story,
            updatedAt: timestamp,
            createdAt: story.createdAt || timestamp,
          });
        })
      );
      
      await tx.done;
      console.log('Sync completed successfully');
      return true;
    } catch (error) {
      console.error('Error syncing stories:', error);
      throw error; // Re-throw to handle in calling code
    }
  }
};

export default StoryIdb;