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
          database.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  },

  async getAllStories() {
    const db = await this.getDatabase();
    const tx = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = tx.objectStore(OBJECT_STORE_NAME);
    return store.getAll();
  },

  async getStory(id) {
    const db = await this.getDatabase();
    const tx = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = tx.objectStore(OBJECT_STORE_NAME);
    return store.get(id);
  },

  async putStory(story) {
    const db = await this.getDatabase();
    const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OBJECT_STORE_NAME);
    await store.put(story);
  },

  async deleteStory(id) {
    const db = await this.getDatabase();
    const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(OBJECT_STORE_NAME);
    await store.delete(id);
  },

  async searchStories(query) {
    const stories = await this.getAllStories();
    return stories.filter((story) => {
      const loweredQuery = query.toLowerCase();
      return (
        story.description.toLowerCase().includes(loweredQuery) ||
        story.name.toLowerCase().includes(loweredQuery)
      );
    });
  },

  async putBulkStories(stories) {
    if (!Array.isArray(stories)) return null;
    try {
      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      
      await Promise.all(stories.map((story) => 
        store.put({
          ...story,
          updatedAt: new Date().toISOString(),
        })
      ));
      
      await tx.done;
      return stories;
    } catch (error) {
      console.error('Error putting bulk stories:', error);
      return null;
    }
  },

  async clearStories() {
    try {
      const db = await this.getDatabase();
      await db.clear(OBJECT_STORE_NAME);
      return true;
    } catch (error) {
      console.error('Error clearing stories:', error);
      return false;
    }
  },

  async getStoriesCount() {
    try {
      const db = await this.getDatabase();
      return await db.count(OBJECT_STORE_NAME);
    } catch (error) {
      console.error('Error getting stories count:', error);
      return 0;
    }
  },

  async getStoriesByDateRange(startDate, endDate) {
    try {
      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readonly');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      const index = store.index('createdAt');
      
      const stories = await index.getAll(IDBKeyRange.bound(
        startDate.toISOString(),
        endDate.toISOString()
      ));
      
      return stories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error('Error getting stories by date range:', error);
      return [];
    }
  },

  async getLatestStories(limit = 10) {
    try {
      const stories = await this.getAllStories();
      return stories.slice(0, limit);
    } catch (error) {
      console.error('Error getting latest stories:', error);
      return [];
    }
  },

  async syncStories(onlineStories) {
    try {
      const db = await this.getDatabase();
      const tx = db.transaction(OBJECT_STORE_NAME, 'readwrite');
      const store = tx.objectStore(OBJECT_STORE_NAME);
      
      // Get all local stories
      const localStories = await store.getAll();
      
      // Create a map of online stories
      const onlineStoriesMap = new Map(
        onlineStories.map(story => [story.id, story])
      );
      
      // Delete stories that exist locally but not online
      await Promise.all(
        localStories
          .filter(story => !onlineStoriesMap.has(story.id))
          .map(story => store.delete(story.id))
      );
      
      // Update or add online stories
      await Promise.all(
        onlineStories.map(story => 
          store.put({
            ...story,
            updatedAt: new Date().toISOString(),
          })
        )
      );
      
      await tx.done;
      return true;
    } catch (error) {
      console.error('Error syncing stories:', error);
      return false;
    }
  }
};

export default StoryIdb;