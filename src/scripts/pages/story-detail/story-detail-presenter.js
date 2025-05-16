import StoryAPI from "../../data/storyAPI";
import Database from "../../data/database";
import AuthAPI from "../../data/authAPI";
import { showLoading, hideLoading, showResponseMessage } from "../../utils/template";

class StoryDetailPresenter {
  constructor({ view, storyId }) {
    this._view = view;
    this._storyId = storyId;
    this._authAPI = new AuthAPI();
    this._handlePageLeave = this._handlePageLeave.bind(this);
    this._story = null;

    console.log('StoryDetailPresenter initialized with ID:', storyId);
    window.addEventListener("hashchange", this._handlePageLeave);
  }

  async init() {
    try {
      showLoading();
      
      if (!this._storyId) {
        throw new Error('Story ID tidak valid');
      }

      // Check authentication
      if (!this._authAPI.isLoggedIn()) {
        console.log('User not logged in, redirecting to login page');
        window.location.hash = '#/login';
        return;
      }

      const token = this._authAPI.getToken();
      console.log('Auth token available:', !!token);

      console.log('Loading story with ID:', this._storyId);
      await this._loadStory();
      console.log('Story loaded:', this._story);
      await this._displayStory();
      
    } catch (error) {
      console.error("Error in StoryDetailPresenter:", error);
      this._view.displayError(error.message || "Gagal memuat story");
    } finally {
      hideLoading();
    }
  }

  async _loadStory() {
    try {
      // Try to get story from IndexedDB first
      console.log('Trying to get story from IndexedDB...');
      this._story = await Database.getStory(this._storyId);
      console.log('Story from IndexedDB:', this._story);
      
      if (!this._story) {
        // If not in IndexedDB, fetch from API
        console.log('Story not found in IndexedDB, fetching from API...');
        const response = await StoryAPI.getStoryDetail(this._storyId);
        console.log('API Response:', response);
        
        if (response.error) {
          throw new Error(response.message || "Gagal memuat story dari server");
        }

        if (!response.data || !response.data.story) {
          throw new Error("Story tidak ditemukan");
        }

        this._story = response.data.story;
        console.log('Story loaded from API:', this._story);
        
        // Save to IndexedDB for offline access
        await Database.putStory(this._story);
      }

      this._validateStoryData();
    } catch (error) {
      console.error('Error in _loadStory:', error);
      throw error;
    }
  }

  _validateStoryData() {
    console.log('Validating story data:', this._story);
    if (!this._story) {
      throw new Error("Data story tidak ditemukan");
    }

    const requiredFields = ['name', 'description', 'photoUrl', 'createdAt'];
    const missingFields = requiredFields.filter(field => !this._story[field]);

    if (missingFields.length > 0) {
      throw new Error(`Data story tidak lengkap: ${missingFields.join(', ')}`);
    }
  }

  async _displayStory() {
    console.log('Displaying story:', this._story);
    const currentUser = this._authAPI.getUser();
    console.log('Current user:', currentUser);
    const isOwner = currentUser && currentUser.id === this._story.userId;
    console.log('Is owner:', isOwner);
    
    this._view.displayStory(this._story, isOwner);

    // Update browser title
    document.title = `${this._story.name} - Story App`;
  }

  async deleteStory() {
    try {
      const confirmed = confirm('Apakah Anda yakin ingin menghapus story ini?');
      if (!confirmed) return;

      showLoading();
      
      // Delete from API first
      const response = await StoryAPI.deleteStory(this._storyId);
      
      if (response.error) {
        throw new Error(response.message || "Gagal menghapus story");
      }

      // If successful, delete from IndexedDB
      await Database.deleteStory(this._storyId);
      
      showResponseMessage('Story berhasil dihapus');
      window.location.hash = '#/home';
      
    } catch (error) {
      console.error("Error deleting story:", error);
      showResponseMessage(error.message || "Gagal menghapus story");
    } finally {
      hideLoading();
    }
  }

  _handlePageLeave() {
    console.log('Leaving story detail page, cleaning up...');
    this._view.cleanup();
    window.removeEventListener("hashchange", this._handlePageLeave);
  }

  cleanup() {
    this._view.cleanup();
  }
}

export default StoryDetailPresenter;
