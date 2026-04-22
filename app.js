const STORAGE_KEY = "evercam-saved-camera-ids";
const TOKEN_STORAGE_KEY = "evercam-auth-token";
const MAX_SAVED = 8;

const form = document.getElementById("snapshot-form");
const cameraInput = document.getElementById("camera-id");
const authTokenInput = document.getElementById("auth-token");
const savedCameras = document.getElementById("saved-cameras");
const clearHistoryButton = document.getElementById("clear-history");
const clearTokenButton = document.getElementById("clear-token");
const refreshButton = document.getElementById("refresh-button");
const statusText = document.getElementById("status");
const currentCameraText = document.getElementById("current-camera");
const snapshotImage = document.getElementById("snapshot-image");
const snapshotPlaceholder = document.getElementById("snapshot-placeholder");

let currentCameraId = "";
let currentObjectUrl = "";

function getSavedCameraIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function setSavedCameraIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

function getSavedToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

function setSavedToken(token) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function rememberCameraId(cameraId) {
  const normalized = cameraId.trim();
  if (!normalized) return;

  const next = [normalized, ...getSavedCameraIds().filter((id) => id !== normalized)].slice(0, MAX_SAVED);
  setSavedCameraIds(next);
  renderSavedCameraIds();
}

function removeCameraId(cameraId) {
  const next = getSavedCameraIds().filter((id) => id !== cameraId);
  setSavedCameraIds(next);
  renderSavedCameraIds();
}

function renderSavedCameraIds() {
  const ids = getSavedCameraIds();
  savedCameras.innerHTML = "";
  clearHistoryButton.disabled = ids.length === 0;

  if (ids.length === 0) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent = "No saved camera IDs yet.";
    savedCameras.appendChild(empty);
    return;
  }

  ids.forEach((cameraId) => {
    const chip = document.createElement("div");
    chip.className = "saved-camera";

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "saved-camera-load";
    loadButton.textContent = cameraId;
    loadButton.addEventListener("click", () => {
      cameraInput.value = cameraId;
      loadSnapshot(cameraId);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "saved-camera-remove";
    removeButton.textContent = "x";
    removeButton.setAttribute("aria-label", `Remove ${cameraId}`);
    removeButton.addEventListener("click", () => removeCameraId(cameraId));

    chip.append(loadButton, removeButton);
    savedCameras.appendChild(chip);
  });
}

function setStatus(message, tone = "") {
  statusText.textContent = message;
  statusText.className = `status${tone ? ` ${tone}` : ""}`;
}

function buildSnapshotUrl(cameraId) {
  const encodedId = encodeURIComponent(cameraId);
  return `https://media.evercam.io/v2/cameras/${encodedId}/live/snapshot?t=${Date.now()}`;
}

function cleanupObjectUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = "";
  }
}

async function loadSnapshot(cameraId) {
  const normalized = cameraId.trim();
  if (!normalized) {
    setStatus("Enter a camera ID first.", "error");
    return;
  }

  const token = authTokenInput.value.trim();
  setSavedToken(token);

  currentCameraId = normalized;
  cameraInput.value = normalized;
  refreshButton.disabled = false;
  currentCameraText.textContent = `Current camera: ${normalized}`;
  setStatus("Loading snapshot...", "");
  rememberCameraId(normalized);

  snapshotImage.hidden = true;
  snapshotPlaceholder.hidden = false;
  snapshotPlaceholder.textContent = "Loading latest snapshot...";

  cleanupObjectUrl();

  try {
    const response = await fetch(buildSnapshotUrl(normalized), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    currentObjectUrl = URL.createObjectURL(blob);
    snapshotImage.src = currentObjectUrl;
    snapshotImage.alt = `Live snapshot for ${normalized}`;
    snapshotImage.hidden = false;
    snapshotPlaceholder.hidden = true;
    setStatus("Snapshot loaded.", "success");
  } catch (error) {
    const message = token
      ? "Could not load that camera. Check the camera ID, token access, or browser CORS restrictions."
      : "Could not load that camera. It may be private, unavailable, or the ID may be incorrect.";
    setStatus(message, "error");
    snapshotImage.hidden = true;
    snapshotPlaceholder.hidden = false;
    snapshotPlaceholder.textContent = "Snapshot unavailable for this camera ID.";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadSnapshot(cameraInput.value);
});

refreshButton.addEventListener("click", () => {
  if (currentCameraId) {
    loadSnapshot(currentCameraId);
  }
});

clearHistoryButton.addEventListener("click", () => {
  setSavedCameraIds([]);
  renderSavedCameraIds();
});

clearTokenButton.addEventListener("click", () => {
  authTokenInput.value = "";
  setSavedToken("");
});

authTokenInput.value = getSavedToken();
renderSavedCameraIds();
