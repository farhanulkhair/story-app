import StoryAPI from "../../data/storyAPI";
import { showLoading, hideLoading, showResponseMessage } from "../../utils/index";

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
      // Validate all required fields
      const validationErrors = [];
      
      if (!description || description.trim() === '') {
        validationErrors.push('Deskripsi cerita wajib diisi');
      } else if (description.length < 10) {
        validationErrors.push('Deskripsi cerita minimal 10 karakter');
      }

      if (!this._photoBlob) {
        validationErrors.push('Foto cerita wajib diisi');
      }

      if (!location) {
        validationErrors.push('Lokasi cerita wajib dipilih');
      }

      if (validationErrors.length > 0) {
        showResponseMessage(`Validasi gagal:\n${validationErrors.join('\n')}`);
        return;
      }

      showLoading();

      const result = await StoryAPI.addNewStory({
        description: description.trim(),
        photo: this._photoBlob,
        lat: location.lat,
        lon: location.lng,
      });

      if (result.error) {
        throw new Error(result.message || "Gagal menambahkan cerita");
      }

      // Ensure we have complete story data
      const newStory = {
        id: result.data.id,
        name: result.data.name || 'Anonymous',
        description: description.trim(),
        photoUrl: result.data.photoUrl,
        createdAt: result.data.createdAt || new Date().toISOString(),
        lat: location.lat,
        lon: location.lng,
        userId: result.data.userId
      };

      // Bersihkan resources
      this._stopMediaStream();
      this._cleanup();

      // Tampilkan pesan sukses
      showResponseMessage("Cerita berhasil ditambahkan!");
      
      // Dispatch event dengan data story yang lengkap
      const storyAddedEvent = new CustomEvent('story-added', {
        detail: { story: newStory }
      });
      
      console.log('Dispatching story-added event with data:', newStory);
      window.dispatchEvent(storyAddedEvent);

      // Navigasi ke home page
      hideLoading();
      window.location.hash = "#/home";

    } catch (error) {
      console.error("Error adding story:", error);
      showResponseMessage("Gagal menambahkan cerita: " + (error.message || "Terjadi kesalahan"));
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