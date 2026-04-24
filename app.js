const STORAGE_KEY = "evercam-saved-camera-ids";
const LOOKUP_HISTORY_KEY = "evercam-lookup-history";
const REMEMBERED_USERNAME_KEY = "evercam-remembered-username";
const REMEMBERED_PASSWORD_KEY = "evercam-remembered-password";
const LOCAL_FEED_STORAGE_KEY = "evercam-local-feed-settings";
const MAX_SAVED = 8;

const lookupForm = document.getElementById("lookup-form");
const lookupInput = document.getElementById("lookup-id");
const lookupSuggestions = document.getElementById("lookup-suggestions");
const authUsernameInput = document.getElementById("auth-username");
const authPasswordInput = document.getElementById("auth-password");
const rememberLoginInput = document.getElementById("remember-login");
const savedCameras = document.getElementById("saved-cameras");
const clearHistoryButton = document.getElementById("clear-history");
const clearLoginButton = document.getElementById("clear-login");
const refreshButton = document.getElementById("refresh-button");
const prevCameraButton = document.getElementById("prev-camera-button");
const nextCameraButton = document.getElementById("next-camera-button");
const overlayPrevCameraButton = document.getElementById("overlay-prev-camera-button");
const overlayNextCameraButton = document.getElementById("overlay-next-camera-button");
const snapshotTabButton = document.getElementById("snapshot-tab");
const liveTabButton = document.getElementById("live-tab");
const localTabButton = document.getElementById("local-tab");
const viewerTitle = document.getElementById("viewer-title");
const snapshotPanel = document.getElementById("snapshot-panel");
const livePanel = document.getElementById("live-panel");
const localPanel = document.getElementById("local-panel");
const statusText = document.getElementById("status");
const currentCameraText = document.getElementById("current-camera");
const snapshotImage = document.getElementById("snapshot-image");
const snapshotPlaceholder = document.getElementById("snapshot-placeholder");
const liveVideo = document.getElementById("live-video");
const livePlaceholder = document.getElementById("live-placeholder");
const localIpInput = document.getElementById("local-ip");
const localPortInput = document.getElementById("local-port");
const cameraBrandSelect = document.getElementById("camera-brand");
const openLocalCameraButton = document.getElementById("open-local-camera");
const resetLocalDefaultsButton = document.getElementById("reset-local-defaults");
const localUrlText = document.getElementById("local-url");
const localHelpText = document.getElementById("local-help");
const lookupStatusText = document.getElementById("lookup-status");
const jobResult = document.getElementById("job-result");
const jobNameText = document.getElementById("job-name");
const jobMetaText = document.getElementById("job-meta");
const jobWorksheetLink = document.getElementById("job-worksheet-link");
const jobCameras = document.getElementById("job-cameras");
const jobNotePanel = document.getElementById("job-note-panel");
const jobNoteContent = document.getElementById("job-note-content");
const jobNoteCamera = document.getElementById("job-note-camera");
const jobNoteImages = document.getElementById("job-note-images");
const jobNoteFiles = document.getElementById("job-note-files");
const jobNoteStatus = document.getElementById("job-note-status");
const saveJobNoteButton = document.getElementById("save-job-note");
const adminSnapshotTools = document.getElementById("admin-snapshot-tools");
const adminSnapshotLink = document.getElementById("admin-snapshot-link");

let currentCameraId = "";
let currentCameraName = "";
let currentObjectUrl = "";
let currentTab = "snapshot";
let hlsPlayer = null;
let currentJob = null;
let sessionAuthToken = "";
let currentCameraCollection = [];
let currentCameraMeta = null;
let selectedJobFiles = [];

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

function getLookupHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOOKUP_HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function setLookupHistory(items) {
  localStorage.setItem(LOOKUP_HISTORY_KEY, JSON.stringify(items));
}

function getRememberedUsername() {
  return localStorage.getItem(REMEMBERED_USERNAME_KEY) || "";
}

function setRememberedUsername(username) {
  if (!username) {
    localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    return;
  }
  localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
}

function getRememberedPassword() {
  return localStorage.getItem(REMEMBERED_PASSWORD_KEY) || "";
}

function setRememberedPassword(password) {
  if (!password) {
    localStorage.removeItem(REMEMBERED_PASSWORD_KEY);
    return;
  }
  localStorage.setItem(REMEMBERED_PASSWORD_KEY, password);
}

function getLocalFeedSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_FEED_STORAGE_KEY) || "{}");
    return {
      ip: parsed.ip || "192.168.8.101",
      port: parsed.port || "80",
      brand: parsed.brand || "auto"
    };
  } catch {
    return { ip: "192.168.8.101", port: "80", brand: "auto" };
  }
}

function setLocalFeedSettings(settings) {
  localStorage.setItem(LOCAL_FEED_STORAGE_KEY, JSON.stringify(settings));
}

function rememberLookupValue(value) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return;

  const next = [normalized, ...getLookupHistory().filter((item) => item !== normalized)].slice(0, 12);
  setLookupHistory(next);
}

function rememberCameraId(cameraId) {
  const normalized = cameraId.trim().toLowerCase();
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
      loadCurrentView(cameraId, {
        preserveSummary: !jobResult.hidden,
        preserveLookupValue: lookupInput.value
      });
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

function setLookupStatus(message, tone = "") {
  lookupStatusText.textContent = message;
  lookupStatusText.className = `helper-text${tone ? ` ${tone}` : ""}`;
}

function setJobNoteStatus(message, tone = "") {
  jobNoteStatus.textContent = message;
  jobNoteStatus.className = `helper-text${tone ? ` ${tone}` : ""}`;
}

function canAddJobNotes(job) {
  return String(job?.status || "").trim().toLowerCase() === "scheduled";
}

function setLookupStatusHtml(message, tone = "") {
  lookupStatusText.innerHTML = message;
  lookupStatusText.className = `helper-text${tone ? ` ${tone}` : ""}`;
}

function updateCurrentCameraText(cameraId = currentCameraId, cameraName = currentCameraName) {
  const normalizedId = (cameraId || "").trim().toLowerCase();
  const friendlyName = (cameraName || "").trim();

  if (!normalizedId) {
    currentCameraText.textContent = "No camera selected yet.";
    return;
  }

  currentCameraText.textContent = friendlyName
    ? `Current camera: ${friendlyName} (${normalizedId})`
    : `Current camera: ${normalizedId}`;
  updateCameraNavigation();
}

function setCurrentCameraCollection(cameras = []) {
  currentCameraCollection = Array.isArray(cameras)
    ? cameras
        .map((camera) => ({
          id: (camera.id || "").trim().toLowerCase(),
          name: camera.name || ""
        }))
        .filter((camera) => camera.id)
    : [];
  updateCameraNavigation();
}

function updateCameraNavigation() {
  const currentIndex = currentCameraCollection.findIndex((camera) => camera.id === currentCameraId);
  const showNavigation = currentCameraCollection.length > 1 && currentIndex !== -1;
  const showOverlayNavigation = showNavigation && currentTab === "snapshot";

  prevCameraButton.hidden = !showNavigation;
  nextCameraButton.hidden = !showNavigation;
  overlayPrevCameraButton.hidden = !showOverlayNavigation;
  overlayNextCameraButton.hidden = !showOverlayNavigation;

  if (!showNavigation) {
    prevCameraButton.disabled = true;
    nextCameraButton.disabled = true;
    overlayPrevCameraButton.disabled = true;
    overlayNextCameraButton.disabled = true;
    return;
  }

  prevCameraButton.disabled = currentIndex <= 0;
  nextCameraButton.disabled = currentIndex >= currentCameraCollection.length - 1;
  overlayPrevCameraButton.disabled = currentIndex <= 0;
  overlayNextCameraButton.disabled = currentIndex >= currentCameraCollection.length - 1;
}

function getJobFileKey(file) {
  return [file.name, file.size, file.lastModified].join("::");
}

function appendSelectedJobFiles(files) {
  const nextFiles = Array.isArray(files) ? files : Array.from(files || []);
  const seen = new Set(selectedJobFiles.map(getJobFileKey));

  nextFiles.forEach((file) => {
    const key = getJobFileKey(file);
    if (!seen.has(key)) {
      selectedJobFiles.push(file);
      seen.add(key);
    }
  });
}

function renderSelectedJobFiles() {
  const files = selectedJobFiles;
  jobNoteFiles.textContent = files.length
    ? `${files.length} photo${files.length === 1 ? "" : "s"} selected: ${files.map((file) => file.name).join(", ")}`
    : "No photos selected.";
}

function resetJobNoteForm() {
  jobNoteContent.value = "";
  selectedJobFiles = [];
  jobNoteCamera.value = "";
  jobNoteImages.value = "";
  renderSelectedJobFiles();
  setJobNoteStatus("");
}

function showJobNotePanel() {
  jobNotePanel.hidden = false;
  renderSelectedJobFiles();
}

function hideJobNotePanel() {
  jobNotePanel.hidden = true;
  resetJobNoteForm();
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function navigateCamera(direction) {
  const currentIndex = currentCameraCollection.findIndex((camera) => camera.id === currentCameraId);
  if (currentIndex === -1) {
    return;
  }

  const target = currentCameraCollection[currentIndex + direction];
  if (!target) {
    return;
  }

  currentCameraName = target.name || "";
  updateCurrentCameraText(target.id, currentCameraName);
  loadCurrentView(target.id, {
    preserveSummary: !jobResult.hidden,
    preserveLookupValue: lookupInput.value,
    preserveCameraName: true
  });
}

function hideLookupSuggestions() {
  lookupSuggestions.hidden = true;
  lookupSuggestions.innerHTML = "";
}

function renderLookupSuggestions(query) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 3) {
    hideLookupSuggestions();
    return;
  }

  const matches = getLookupHistory()
    .filter((item) => item.startsWith(normalized) && item !== normalized)
    .slice(0, 6);

  if (!matches.length) {
    hideLookupSuggestions();
    return;
  }

  lookupSuggestions.innerHTML = "";
  matches.forEach((match) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lookup-suggestion";
    button.textContent = match;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      lookupInput.value = match;
      hideLookupSuggestions();
      lookupInput.focus();
      const length = match.length;
      lookupInput.setSelectionRange(length, length);
    });
    lookupSuggestions.appendChild(button);
  });

  lookupSuggestions.hidden = false;
}

function buildSnapshotUrl(cameraId) {
  const encodedId = encodeURIComponent(cameraId.toLowerCase());
  return `https://media.evercam.io/v2/cameras/${encodedId}/live/snapshot?t=${Date.now()}`;
}

function buildHlsUrl(cameraId) {
  const encodedId = encodeURIComponent(cameraId.toLowerCase());
  return `https://media.evercam.io/v2/cameras/${encodedId}/hls?t=${Date.now()}`;
}

function buildCameraDetailsUrl(cameraId) {
  const encodedId = encodeURIComponent(cameraId.toLowerCase());
  return `https://media.evercam.io/v2/cameras/${encodedId}`;
}

function buildProjectCamerasUrl(projectId) {
  const encodedId = encodeURIComponent(projectId.toLowerCase());
  return `https://media.evercam.io/v2/projects/${encodedId}/cameras`;
}

function buildAdminSnapshotUrl(camera) {
  if (!camera?.nvr_host || !camera?.model) {
    return "";
  }

  const model = String(camera.model).toLowerCase();
  const host = `192-168-8-101-${camera.nvr_host}`;
  const auth = "admin:Mehcam4Mehcam";

  if (model.includes("hikvision")) {
    return `https://${auth}@${host}/ISAPI/Streaming/channels/101/picture`;
  }

  if (model.includes("milesight")) {
    return `https://${auth}@${host}/snapshot.cgi`;
  }

  return "";
}

function updateAdminSnapshotUi(camera = currentCameraMeta) {
  const adminUrl = buildAdminSnapshotUrl(camera);
  adminSnapshotTools.hidden = !adminUrl;

  if (!adminUrl) {
    adminSnapshotLink.hidden = true;
    adminSnapshotLink.removeAttribute("href");
    return;
  }

  adminSnapshotLink.href = adminUrl;
  adminSnapshotLink.hidden = false;
}

function applyCameraMetadata(camera) {
  if (!camera) {
    return;
  }

  currentCameraMeta = camera;
  currentCameraName = camera.name || currentCameraName;
  updateCurrentCameraText(camera.id || currentCameraId, currentCameraName);
  updateAdminSnapshotUi(camera);
}

async function readResponseBlobWithProgress(response, onProgress) {
  if (!response.body || typeof response.body.getReader !== "function") {
    onProgress?.(null);
    return response.blob();
  }

  const totalBytes = Number(response.headers.get("content-length")) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedBytes += value.length;
      onProgress?.(totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : null);
    }
  }

  return new Blob(chunks, {
    type: response.headers.get("content-type") || "image/jpeg"
  });
}

function buildLocalCameraUrl() {
  const ip = localIpInput.value.trim() || "192.168.8.101";
  const port = localPortInput.value.trim() || "80";
  return `http://${ip}:${port}`;
}

function updateLocalFeedUi() {
  const brand = cameraBrandSelect.value;
  const localUrl = buildLocalCameraUrl();
  localUrlText.textContent = `Local address: ${localUrl}`;

  const brandHint = brand === "hikvision"
    ? "Likely Hikvision. Opening the local web interface should prompt for the camera login."
    : brand === "milesight"
      ? "Likely Milesight. Opening the local web interface should prompt for the camera login."
      : "Open the local web interface and log in on the camera LAN if prompted.";

  localHelpText.textContent = `${brandHint} Hosted web apps usually cannot auto-scan your local network, so direct browser detection is limited.`;

  setLocalFeedSettings({
    ip: localIpInput.value.trim() || "192.168.8.101",
    port: localPortInput.value.trim() || "80",
    brand
  });
}

async function getAuthHeaders() {
  const username = authUsernameInput.value.trim();
  const password = authPasswordInput.value;

  if (!username || !password) {
    sessionAuthToken = "";
    return {};
  }

  if (rememberLoginInput.checked) {
    setRememberedUsername(username);
    setRememberedPassword(password);
  } else {
    setRememberedUsername("");
    setRememberedPassword("");
  }

  const loginResponse = await fetch("https://media.evercam.io/v2/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!loginResponse.ok) {
    let message = "Evercam login failed.";
    try {
      const errorJson = await loginResponse.json();
      message = errorJson.message || errorJson.error || message;
    } catch {
      // Ignore JSON parsing errors and keep generic message.
    }
    throw new Error(message);
  }

  const loginJson = await loginResponse.json();
  const loginToken = loginJson.token;
  if (!loginToken) {
    throw new Error("Evercam login succeeded but no token was returned.");
  }

  sessionAuthToken = loginToken;

  if (rememberLoginInput.checked && window.PasswordCredential && navigator.credentials?.store) {
    try {
      const credential = new window.PasswordCredential({
        id: username,
        password,
        name: username
      });
      await navigator.credentials.store(credential);
    } catch {
      // Ignore browser credential storage failures and continue with login.
    }
  }

  return { Authorization: `Bearer ${sessionAuthToken}` };
}

function getCurrentAuthToken() {
  return sessionAuthToken || "";
}

function renderCameraSelection(cameras, selectedCameraId = "") {
  jobCameras.innerHTML = "";

  if (!cameras.length) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent = "No cameras found.";
    jobCameras.appendChild(empty);
    return;
  }

  cameras.forEach((camera) => {
    const chip = document.createElement("div");
    chip.className = "saved-camera";

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "saved-camera-load";
    loadButton.textContent = camera.id;
    loadButton.title = camera.name || camera.id;
    if (selectedCameraId && camera.id === selectedCameraId) {
      loadButton.setAttribute("aria-current", "true");
    }
    loadButton.addEventListener("click", () => {
      loadCurrentView(camera.id, {
        preserveSummary: true,
        preserveLookupValue: lookupInput.value.trim().toLowerCase(),
        preserveCameraName: true
      });
    });

    chip.append(loadButton);
    jobCameras.appendChild(chip);
  });
}

function renderJobResult(job, selectedCameraId = "") {
  currentJob = job;
  jobResult.hidden = false;
  jobNameText.textContent = `${job.jobNumber} - ${job.name}`;

  const meta = [];
  if (job.projectName) meta.push(`Project: ${job.projectName}`);
  if (job.installDate) meta.push(`Install: ${job.installDate}`);
  jobMetaText.textContent = meta.join(" | ");

  if (job.worksheetUrl) {
    jobWorksheetLink.href = job.worksheetUrl;
    jobWorksheetLink.hidden = false;
  } else {
    jobWorksheetLink.hidden = true;
    jobWorksheetLink.removeAttribute("href");
  }

  renderCameraSelection(job.cameras, selectedCameraId);
  if (canAddJobNotes(job)) {
    showJobNotePanel();
  } else {
    hideJobNotePanel();
  }
}

function renderProjectResult(projectId, cameras, selectedCameraId = "") {
  currentJob = null;
  jobResult.hidden = false;
  jobResult.classList.toggle("project-emphasis", cameras.length > 1);
  jobNameText.textContent = cameras[0]?.projectName || projectId;
  jobMetaText.textContent = cameras.length > 1
    ? `${cameras.length} cameras found for this project. The first snapshot has been loaded automatically.`
    : "1 camera found for this project.";
  jobWorksheetLink.hidden = true;
  jobWorksheetLink.removeAttribute("href");
  renderCameraSelection(cameras, selectedCameraId);
  hideJobNotePanel();
}

function hideJobResult() {
  currentJob = null;
  jobResult.hidden = true;
  jobResult.classList.remove("project-emphasis");
  jobNameText.textContent = "";
  jobMetaText.textContent = "";
  jobWorksheetLink.hidden = true;
  jobWorksheetLink.removeAttribute("href");
  jobCameras.innerHTML = "";
  hideJobNotePanel();
  setCurrentCameraCollection([]);
}

function looksLikeProjectId(value) {
  return /^[a-z0-9]{5}-[a-z0-9]{5}$/i.test(value.trim());
}

function cleanupObjectUrl() {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = "";
  }
}

function cleanupHls() {
  if (hlsPlayer) {
    hlsPlayer.destroy();
    hlsPlayer = null;
  }

  liveVideo.pause();
  liveVideo.removeAttribute("src");
  liveVideo.load();
}

function switchTab(tab, options = {}) {
  currentTab = tab;
  const isSnapshot = tab === "snapshot";
  const isLive = tab === "live";
  const isLocal = tab === "local";

  snapshotTabButton.classList.toggle("active", isSnapshot);
  liveTabButton.classList.toggle("active", isLive);
  localTabButton.classList.toggle("active", isLocal);
  snapshotTabButton.setAttribute("aria-selected", String(isSnapshot));
  liveTabButton.setAttribute("aria-selected", String(isLive));
  localTabButton.setAttribute("aria-selected", String(isLocal));
  snapshotPanel.hidden = !isSnapshot;
  livePanel.hidden = !isLive;
  localPanel.hidden = !isLocal;
  viewerTitle.textContent = isSnapshot ? "Live Snapshot" : isLive ? "Live Feed" : "Local Feed";
  refreshButton.textContent = isSnapshot ? "Refresh Snapshot" : isLive ? "Refresh Live Feed" : "Refresh Local Feed";
  setStatus(
    currentCameraId
      ? isSnapshot
        ? "Ready to refresh the latest snapshot."
        : isLive
          ? "Ready to load the live feed."
          : "Ready to open the local camera feed."
      : isSnapshot
        ? "Enter a camera ID to load a snapshot."
        : isLive
          ? "Enter a camera ID to load a live feed."
          : "Enter a camera ID to prepare the local feed."
  );

  if (currentCameraId && !isLocal && !options.suppressLoad) {
    loadCurrentView(currentCameraId, {
      preserveSummary: !jobResult.hidden,
      preserveLookupValue: lookupInput.value
    });
  }

  if (isLocal) {
    updateLocalFeedUi();
  }
}

async function loadSnapshot(cameraId, options = {}) {
  const normalized = cameraId.trim().toLowerCase();
  if (!normalized) {
    setStatus("Enter a camera ID first.", "error");
    return;
  }

  currentCameraId = normalized;
  if (!options.preserveCameraName) {
    currentCameraName = "";
  }
  currentCameraMeta = null;
  updateAdminSnapshotUi(null);
  if (!options.preserveSummary) {
    hideJobResult();
  }
  if (options.preserveLookupValue) {
    lookupInput.value = options.preserveLookupValue;
  } else {
    lookupInput.value = normalized;
  }
  refreshButton.disabled = false;
  updateCurrentCameraText(normalized);
  setStatus("Loading snapshot...", "");
  rememberCameraId(normalized);

  snapshotImage.hidden = true;
  snapshotPlaceholder.hidden = false;
  snapshotPlaceholder.textContent = "Loading latest snapshot...";

  cleanupObjectUrl();
  cleanupHls();

  try {
    const headers = await getAuthHeaders();
    try {
      const detailsResponse = await fetch(buildCameraDetailsUrl(normalized), { headers });
      if (detailsResponse.ok) {
        const detailsJson = await detailsResponse.json();
        const camera = Array.isArray(detailsJson.cameras) ? detailsJson.cameras[0] : null;
        applyCameraMetadata(camera);
      }
    } catch {
      // Ignore metadata lookup failures and continue trying the snapshot itself.
    }

    const response = await fetch(buildSnapshotUrl(normalized), {
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    setStatus("Success. Snapshot is loading in the background...", "success");
    snapshotPlaceholder.textContent = "Snapshot found. Downloading image...";

    const blob = await readResponseBlobWithProgress(response, (percent) => {
      if (percent === null) {
        setStatus("Success. Snapshot is loading in the background...", "success");
        snapshotPlaceholder.textContent = "Snapshot found. Downloading image...";
        return;
      }

      setStatus(`Success. Snapshot is loading in the background... ${percent}%`, "success");
      snapshotPlaceholder.textContent = `Downloading snapshot... ${percent}%`;
    });

    currentObjectUrl = URL.createObjectURL(blob);
    snapshotImage.src = currentObjectUrl;
    snapshotImage.alt = `Live snapshot for ${normalized}`;
    snapshotImage.hidden = false;
    snapshotPlaceholder.hidden = true;
    setStatus("Snapshot loaded.", "success");
  } catch (error) {
    const message = authUsernameInput.value.trim()
      ? "Could not load that camera. Check the camera ID, token access, or browser CORS restrictions."
      : "Could not load that camera. It may be private, unavailable, or the ID may be incorrect.";
    setStatus(message, "error");
    snapshotImage.hidden = true;
    snapshotPlaceholder.hidden = false;
    snapshotPlaceholder.textContent = "Snapshot unavailable for this camera ID.";
  }
}

async function loadLiveFeed(cameraId, options = {}) {
  const normalized = cameraId.trim().toLowerCase();
  if (!normalized) {
    setStatus("Enter a camera ID first.", "error");
    return;
  }

  currentCameraId = normalized;
  if (!options.preserveCameraName) {
    currentCameraName = "";
  }
  currentCameraMeta = null;
  updateAdminSnapshotUi(null);
  if (!options.preserveSummary) {
    hideJobResult();
  }
  if (options.preserveLookupValue) {
    lookupInput.value = options.preserveLookupValue;
  } else {
    lookupInput.value = normalized;
  }
  refreshButton.disabled = false;
  updateCurrentCameraText(normalized);
  setStatus("Loading live feed...", "");
  rememberCameraId(normalized);

  snapshotImage.hidden = true;
  snapshotPlaceholder.hidden = false;
  snapshotPlaceholder.textContent = "Snapshot will appear here.";
  liveVideo.hidden = true;
  livePlaceholder.hidden = false;
  livePlaceholder.textContent = "Connecting to live feed...";

  cleanupObjectUrl();
  cleanupHls();

  try {
    const headers = await getAuthHeaders();
    const token = getCurrentAuthToken();
    const detailsResponse = await fetch(buildCameraDetailsUrl(normalized), {
      headers
    });

    if (!detailsResponse.ok) {
      throw new Error(`HTTP ${detailsResponse.status}`);
    }

      const detailsJson = await detailsResponse.json();
      const camera = Array.isArray(detailsJson.cameras) ? detailsJson.cameras[0] : null;
      applyCameraMetadata(camera);
      const hlsUrl = camera?.proxy_url?.hls || buildHlsUrl(normalized);

    if (window.Hls && window.Hls.isSupported()) {
      hlsPlayer = new window.Hls({
        xhrSetup: (xhr) => {
          if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          }
        }
      });
      hlsPlayer.loadSource(hlsUrl);
      hlsPlayer.attachMedia(liveVideo);
      hlsPlayer.on(window.Hls.Events.MANIFEST_PARSED, () => {
        liveVideo.hidden = false;
        livePlaceholder.hidden = true;
        liveVideo.play().catch(() => {});
        setStatus("Live feed loaded.", "success");
      });
      hlsPlayer.on(window.Hls.Events.ERROR, (_event, data) => {
        if (data && data.fatal) {
          cleanupHls();
          liveVideo.hidden = true;
          livePlaceholder.hidden = false;
          livePlaceholder.textContent = "Live feed unavailable for this camera ID.";
          setStatus("Could not load the live feed. Check camera support, token access, or browser restrictions.", "error");
        }
      });
      return;
    }

    if (liveVideo.canPlayType("application/vnd.apple.mpegurl")) {
      liveVideo.src = hlsUrl;
      liveVideo.hidden = false;
      livePlaceholder.hidden = true;
      liveVideo.addEventListener("loadedmetadata", () => {
        liveVideo.play().catch(() => {});
      }, { once: true });
      setStatus(token
        ? "Live feed may require browser support for bearer-authenticated HLS."
        : "Live feed loaded.", token ? "error" : "success");
      return;
    }

    throw new Error("HLS unsupported");
  } catch (error) {
    cleanupHls();
    liveVideo.hidden = true;
    livePlaceholder.hidden = false;
    livePlaceholder.textContent = "Live feed unavailable for this camera ID.";
    setStatus("Could not load the live feed. This camera may not support HLS, or the browser may block it.", "error");
  }
}

function loadCurrentView(cameraId, options = {}) {
  const normalized = cameraId.trim().toLowerCase();
  if (currentTab === "live") {
    return loadLiveFeed(normalized, options);
  }

  if (currentTab === "local") {
    currentCameraId = normalized;
    if (!options.preserveSummary) {
      hideJobResult();
    }
    if (options.preserveLookupValue) {
      lookupInput.value = options.preserveLookupValue;
      } else {
        lookupInput.value = currentCameraId;
      }
      updateCurrentCameraText(currentCameraId);
      rememberCameraId(currentCameraId);
    updateLocalFeedUi();
    setStatus("Ready to open the local camera feed on the onsite network.", "success");
    return;
  }

  return loadSnapshot(normalized, options);
}
refreshButton.addEventListener("click", () => {
  if (currentCameraId) {
    loadCurrentView(currentCameraId, {
      preserveSummary: !jobResult.hidden,
      preserveLookupValue: lookupInput.value
    });
  }
});

prevCameraButton.addEventListener("click", () => navigateCamera(-1));
nextCameraButton.addEventListener("click", () => navigateCamera(1));
overlayPrevCameraButton.addEventListener("click", () => navigateCamera(-1));
overlayNextCameraButton.addEventListener("click", () => navigateCamera(1));

snapshotTabButton.addEventListener("click", () => switchTab("snapshot"));
liveTabButton.addEventListener("click", () => switchTab("live"));
localTabButton.addEventListener("click", () => switchTab("local"));

clearHistoryButton.addEventListener("click", () => {
  setSavedCameraIds([]);
  renderSavedCameraIds();
});

clearLoginButton.addEventListener("click", () => {
  authUsernameInput.value = "";
  authPasswordInput.value = "";
  rememberLoginInput.checked = false;
  setRememberedUsername("");
  setRememberedPassword("");
  sessionAuthToken = "";
});

jobNoteCamera.addEventListener("change", () => {
  appendSelectedJobFiles(jobNoteCamera.files);
  jobNoteCamera.value = "";
  renderSelectedJobFiles();
});

jobNoteImages.addEventListener("change", () => {
  appendSelectedJobFiles(jobNoteImages.files);
  jobNoteImages.value = "";
  renderSelectedJobFiles();
});

saveJobNoteButton.addEventListener("click", async () => {
  if (!currentJob?.id) {
    setJobNoteStatus("Find a CRM job first before saving a note.", "error");
    return;
  }

  const note = jobNoteContent.value.trim();
  const files = [...selectedJobFiles];

  if (!note && files.length === 0) {
    setJobNoteStatus("Add some note text or at least one photo before saving.", "error");
    return;
  }

  saveJobNoteButton.disabled = true;
  setJobNoteStatus("Saving note to Zoho...", "");

  try {
    const payload = {
      jobRecordId: currentJob.id,
      note,
      files: await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          type: file.type || "image/jpeg",
          contentBase64: await fileToBase64(file)
        }))
      )
    };

    const response = await fetch("/api/zoho-job-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not save the job note.");
    }

    resetJobNoteForm();
    setJobNoteStatus(
      `Saved ${result.createdNotes || 0} note${result.createdNotes === 1 ? "" : "s"} and ${result.uploadedFiles || 0} photo${result.uploadedFiles === 1 ? "" : "s"} to this job.`,
      "success"
    );
  } catch (error) {
    setJobNoteStatus(error.message || "Could not save the job note.", "error");
  } finally {
    saveJobNoteButton.disabled = false;
  }
});

openLocalCameraButton.addEventListener("click", () => {
  const url = buildLocalCameraUrl();
  updateLocalFeedUi();
  window.open(url, "_blank", "noopener,noreferrer");
});

resetLocalDefaultsButton.addEventListener("click", () => {
  localIpInput.value = "192.168.8.101";
  localPortInput.value = "80";
  cameraBrandSelect.value = "auto";
  updateLocalFeedUi();
});

localIpInput.addEventListener("input", updateLocalFeedUi);
localPortInput.addEventListener("input", updateLocalFeedUi);
cameraBrandSelect.addEventListener("change", updateLocalFeedUi);

authUsernameInput.value = getRememberedUsername();
authPasswordInput.value = getRememberedPassword();
rememberLoginInput.checked = Boolean(authUsernameInput.value || authPasswordInput.value);
const localFeedSettings = getLocalFeedSettings();
localIpInput.value = localFeedSettings.ip;
localPortInput.value = localFeedSettings.port;
cameraBrandSelect.value = localFeedSettings.brand;
updateLocalFeedUi();
renderSavedCameraIds();
renderSelectedJobFiles();
lookupInput.addEventListener("input", () => {
  const start = lookupInput.selectionStart;
  const end = lookupInput.selectionEnd;
  const lower = lookupInput.value.toLowerCase();
  if (lookupInput.value !== lower) {
    lookupInput.value = lower;
    if (start !== null && end !== null) {
      lookupInput.setSelectionRange(start, end);
    }
  }
  renderLookupSuggestions(lookupInput.value);
});
lookupInput.addEventListener("focus", () => renderLookupSuggestions(lookupInput.value));
lookupInput.addEventListener("blur", () => {
  window.setTimeout(hideLookupSuggestions, 120);
});

async function loadProjectCameras(projectId) {
  setStatus("Loading project cameras...", "");
  hideJobResult();

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(buildProjectCamerasUrl(projectId), { headers });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || "Could not load that project.");
    }

    const cameras = Array.isArray(result.cameras)
      ? result.cameras.map((camera) => ({
          id: (camera.id || camera.exid || "").toLowerCase(),
          name: camera.name || "",
          projectName: camera.project?.name || ""
        })).filter((camera) => camera.id)
      : [];

    if (!cameras.length) {
      throw new Error("No cameras found for that project.");
    }

      currentCameraId = cameras[0].id;
      currentCameraName = cameras[0].name || "";
      setCurrentCameraCollection(cameras);
      updateCurrentCameraText(currentCameraId, currentCameraName);
      refreshButton.disabled = false;

    renderProjectResult(projectId, cameras, cameras[0].id);
    setLookupStatus(`Loaded ${cameras.length} camera${cameras.length === 1 ? "" : "s"} for project ${projectId}.`, "success");
    rememberLookupValue(projectId);
    switchTab("snapshot", { suppressLoad: true });
      await loadSnapshot(cameras[0].id, {
        preserveSummary: true,
        preserveLookupValue: projectId,
        preserveCameraName: true
      });
    lookupInput.value = projectId;
  } catch (error) {
    setLookupStatus(error.message || "Could not load that project.", "error");
  }
}

async function tryLoadSingleCamera(cameraId) {
  const headers = await getAuthHeaders();
  const response = await fetch(buildCameraDetailsUrl(cameraId), { headers });
  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const result = await response.json();
  const camera = Array.isArray(result.cameras) ? result.cameras[0] : null;
  if (!camera) {
    return { ok: false, status: 404 };
  }

  applyCameraMetadata(camera);
  hideJobResult();
  setCurrentCameraCollection([]);
  setLookupStatus(`Loaded camera ${cameraId}.`, "success");
  rememberLookupValue(cameraId);
  await loadCurrentView(cameraId, { preserveCameraName: true });
  lookupInput.value = cameraId;
  return { ok: true };
}

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  const value = lookupInput.value.trim().toLowerCase();
  lookupInput.value = value;

  if (!value) {
    setLookupStatus("Enter a camera ID, project ID, or 5-digit job number.", "");
    return;
  }

  if (/^\d{5}$/.test(value)) {
    const jobId = value;
    setLookupStatus("Finding job...", "");
    hideJobResult();

    try {
      const response = await fetch(`/api/zoho-job?jobId=${encodeURIComponent(jobId)}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Job lookup failed.");
      }

        renderJobResult(result, result.cameras[0]?.id || "");
        setLookupStatus(`Loaded ${result.cameras.length} camera${result.cameras.length === 1 ? "" : "s"} for job ${result.jobNumber}.`, "success");
        rememberLookupValue(jobId);

        if (result.cameras.length) {
          currentCameraId = result.cameras[0].id;
          currentCameraName = result.cameras[0].name || "";
          setCurrentCameraCollection(result.cameras);
          updateCurrentCameraText(currentCameraId, currentCameraName);
          refreshButton.disabled = false;
        switchTab("snapshot", { suppressLoad: true });
        await loadSnapshot(result.cameras[0].id, {
          preserveSummary: true,
          preserveLookupValue: jobId,
          preserveCameraName: true
        });
        lookupInput.value = jobId;
      }
    } catch (error) {
      hideJobResult();
      const message = error.message || "Could not load that job.";
      if (message.includes("Missing Zoho environment variables")) {
        setLookupStatus("Job lookup is not configured in Vercel yet. Add the Zoho environment variables, or use a camera or project ID instead.", "error");
        return;
      }
      setLookupStatus(message, "error");
    }
    return;
  }

  hideJobResult();

  const cameraResult = await tryLoadSingleCamera(value);
  if (cameraResult.ok) {
    return;
  }

  if (cameraResult.status === 403) {
    setLookupStatusHtml(
      'Camera found, but <span class="lookup-emphasis">your user does not have viewer access to this camera</span>. Sign in with a user who does.',
      "error"
    );
    return;
  }

  if (cameraResult.status === 401) {
    setLookupStatus("Login failed or session expired. Please sign in again.", "error");
    return;
  }

  if (cameraResult.status === 400 && authUsernameInput.value.trim()) {
    setLookupStatus("Camera lookup failed after sign-in. Please check your login details or camera access.", "error");
    return;
  }

  if (looksLikeProjectId(value)) {
    await loadProjectCameras(value);
    return;
  }

  setLookupStatus("No camera or project found for that ID.", "");
});
