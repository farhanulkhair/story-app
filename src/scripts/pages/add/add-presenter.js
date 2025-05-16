import StoryAPI from "../../data/storyAPI";
import { showLoading, hideLoading, showResponseMessage } from "../../utils/template";
import AuthAPI from "../../data/authAPI";
import CONFIG from "../../config";

class AddPresenter {
  constructor({ view }) {
    this._view = view;
    this._stream = null;
    this._photoBlob = null;
    this._cameraDevices = [];

    // Cleanup when page is left
    window.addEventListener("hashchange", this._handlePageLeave.bind(this));
  }

  async populateCameraDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this._cameraDevices = devices.filter(device => device.kind === "videoinput");
      this._view.updateCameraDevices(this._cameraDevices);
    } catch (error) {
      showResponseMessage(`Gagal memuat daftar kamera: ${error.message}`);
    }
  }

  async handleCameraButtonClick() {
    try {
      if (this._stream) {
        this._stopMediaStream();
        this._view.updateCameraUI(false, this._photoBlob !== null);
        return;
      }

      await this._startCamera();
      this._view.updateCameraUI(true, false);
    } catch (error) {
      showResponseMessage(`Gagal mengakses kamera: ${error.message}`);
    }
  }

  async handleCameraChange(deviceId) {
    try {
      await this._startCamera(deviceId);
    } catch (error) {
      showResponseMessage(`Gagal mengganti kamera: ${error.message}`);
    }
  }

  handlePhotoCapture(blob) {
    this._photoBlob = blob;
    const photoURL = URL.createObjectURL(blob);
    this._view.updatePhotoPreview(photoURL);
    this._stopMediaStream();
    this._view.updateCameraUI(false, true);
  }

  async handleFormSubmit({ description, location }) {
    try {
      console.log('Starting form submission...');
      // Validate all required fields
      const validationErrors = [];
      
      if (!description || description.trim() === '') {
        validationErrors.push('Deskripsi cerita wajib diisi');
      }

      if (!this._photoBlob) {
        validationErrors.push('Foto cerita wajib diisi');
      }

      if (!location) {
        validationErrors.push('Lokasi cerita wajib dipilih');
      }

      // If there are validation errors, show them and stop
      if (validationErrors.length > 0) {
        this._view.showValidationErrors(validationErrors);
        return;
      }

      showLoading();
      console.log('Submitting story to API...');

      const result = await StoryAPI.addNewStory({
        description: description.trim(),
        photo: this._photoBlob,
        lat: location.lat,
        lon: location.lng,
      });

      console.log('API Response:', result);

      if (result.error) {
        throw new Error(result.message || "Gagal menambahkan cerita");
      }

      // Story successfully added
      showResponseMessage('Story berhasil ditambahkan!');

      // Clean up resources
      this._stopMediaStream();
      this._cleanup();

      // Dispatch event with complete story data
      const storyAddedEvent = new CustomEvent('story-added', {
        detail: { story: result.data.story }
      });
      
      console.log('Dispatching story-added event');
      window.dispatchEvent(storyAddedEvent);

      // Redirect to home page
      window.location.hash = '#/home';

    } catch (error) {
      console.error('Error in form submission:', error);
      hideLoading();
      showResponseMessage(error.message || 'Gagal menambahkan story');
    } finally {
      hideLoading();
    }
  }

  async _startCamera(deviceId) {
    if (this._stream) {
      this._stopMediaStream();
    }

    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
      audio: false,
    };

    try {
      this._stream = await navigator.mediaDevices.getUserMedia(constraints);
      this._view.setCameraStream(this._stream);
    } catch (error) {
      console.error("Error starting camera:", error);
      showResponseMessage(`Gagal memulai kamera: ${error.message}`);
    }
  }

  _stopMediaStream() {
    if (this._stream) {
      this._stream.getTracks().forEach(track => track.stop());
      this._stream = null;
    }
  }

  _cleanup() {
    this._photoBlob = null;
  }

  _handlePageLeave() {
    this._stopMediaStream();
    this._cleanup();
  }
}

export default AddPresenter;