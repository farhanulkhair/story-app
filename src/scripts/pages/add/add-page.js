import AddPresenter from "./add-presenter";
import { createAddStoryFormTemplate } from "../../utils/template";

class AddPage {
  constructor() {
    this._presenter = null;
    this._map = null;
    this._selectedLocation = null;
    this._cameraSelect = null;
  }

  async render() {
    return `
      <section class="content" id="mainContent">
        <h2 class="content__heading">Tambah Cerita Baru</h2>
        <div id="addStoryContainer"></div>
      </section>
    `;
  }

  async afterRender() {
    const addStoryContainer = document.querySelector("#addStoryContainer");
    addStoryContainer.innerHTML = createAddStoryFormTemplate();

    this._initializePresenter();
    this._initMap();
    await this._initCameraButtons();
    this._initFormSubmit();
  }

  _initializePresenter() {
    this._presenter = new AddPresenter({
      view: this,
      mapContainerId: "mapAdd",
      formSelector: "#addStoryForm",
      startCameraButtonSelector: "#startCamera",
      capturePhotoButtonSelector: "#capturePhoto",
      cameraPreviewSelector: "#cameraPreview",
      photoCanvasSelector: "#photoCanvas",
      photoPreviewSelector: "#photoPreview",
      selectedLocationSelector: "#selectedLocation"
    });
  }

  _initMap() {
    this._map = L.map("mapAdd").setView([-2.548926, 118.014863], 5);

    const baseLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }
    ).addTo(this._map);

    const satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri — Source: Esri and others",
        maxZoom: 18,
      }
    );

    const topoLayer = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        attribution:
          "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap",
        maxZoom: 17,
      }
    );

    const baseLayers = {
      "Peta Jalan": baseLayer,
      Satelit: satelliteLayer,
      Topografi: topoLayer,
    };

    L.control.layers(baseLayers).addTo(this._map);

    this._map.on("click", (e) => {
      if (this._selectedLocation) {
        this._map.removeLayer(this._selectedLocation);
      }
      this._selectedLocation = L.marker(e.latlng).addTo(this._map);

      document.querySelector(
        "#selectedLocation"
      ).innerHTML = `Lat: ${e.latlng.lat.toFixed(
        6
      )}, Lon: ${e.latlng.lng.toFixed(6)}`;
    });
  }

  async _initCameraButtons() {
    const startCameraButton = document.querySelector("#startCamera");
    const capturePhotoButton = document.querySelector("#capturePhoto");
    const cameraPreview = document.querySelector("#cameraPreview");
    const photoCanvas = document.querySelector("#photoCanvas");
    const photoPreview = document.querySelector("#photoPreview");

    // Create camera selection dropdown
    this._cameraSelect = document.createElement("select");
    this._cameraSelect.id = "cameraSelect";
    this._cameraSelect.style.display = "none";
    this._cameraSelect.innerHTML = '<option value="">Pilih Kamera</option>';
    startCameraButton.parentNode.insertBefore(
      this._cameraSelect,
      startCameraButton.nextSibling
    );

    // Setup event listeners
    startCameraButton.addEventListener("click", () => this._presenter.handleCameraButtonClick());
    
    this._cameraSelect.addEventListener("change", () => {
      if (this._cameraSelect.value) {
        this._presenter.handleCameraChange(this._cameraSelect.value);
      }
    });

    capturePhotoButton.addEventListener("click", () => {
      const context = photoCanvas.getContext("2d");
      photoCanvas.width = cameraPreview.videoWidth;
      photoCanvas.height = cameraPreview.videoHeight;
      
      context.drawImage(
        cameraPreview,
        0,
        0,
        photoCanvas.width,
        photoCanvas.height
      );

      photoCanvas.toBlob(
        (blob) => this._presenter.handlePhotoCapture(blob),
        "image/jpeg",
        0.8
      );
    });

    // Initial camera devices population
    await this._presenter.populateCameraDevices();
  }

  _initFormSubmit() {
    const form = document.querySelector("#addStoryForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const description = document.querySelector("#description").value;
      const location = this._selectedLocation ? this._selectedLocation.getLatLng() : null;
      
      await this._presenter.handleFormSubmit({
        description,
        location
      });
    });
  }

  // Methods called by Presenter
  updateCameraDevices(devices) {
    this._cameraSelect.innerHTML = '<option value="">Pilih Kamera</option>';
    devices.forEach((device, index) => {
      const option = document.createElement("option");
      option.value = device.deviceId;
      option.text = device.label || `Kamera ${index + 1}`;
      this._cameraSelect.appendChild(option);
    });
  }

  updateCameraUI(isStreamActive, hasPhoto) {
    const cameraPreview = document.querySelector("#cameraPreview");
    const capturePhotoButton = document.querySelector("#capturePhoto");
    const startCameraButton = document.querySelector("#startCamera");

    if (isStreamActive) {
      cameraPreview.style.display = "block";
      capturePhotoButton.style.display = "block";
      this._cameraSelect.style.display = "block";
      startCameraButton.textContent = "Tutup Kamera";
    } else {
      cameraPreview.style.display = "none";
      capturePhotoButton.style.display = "none";
      this._cameraSelect.style.display = "none";
      startCameraButton.textContent = hasPhoto ? "Ambil Ulang Foto" : "Buka Kamera";
    }
  }

  updatePhotoPreview(photoURL) {
    const photoPreview = document.querySelector("#photoPreview");
    photoPreview.innerHTML = `<img src="${photoURL}" alt="Foto yang diambil" class="captured-photo">`;
  }

  setCameraStream(stream) {
    const cameraPreview = document.querySelector("#cameraPreview");
    cameraPreview.srcObject = stream;
  }

  cleanup() {
    if (this._selectedLocation) {
      this._map.removeLayer(this._selectedLocation);
      this._selectedLocation = null;
    }
  }
}

export default AddPage;
