const STORAGE_KEY = "evercam-saved-camera-ids";
const TOKEN_STORAGE_KEY = "evercam-auth-token";
const LOCAL_FEED_STORAGE_KEY = "evercam-local-feed-settings";
const MAX_SAVED = 8;

const jobForm = document.getElementById("job-form");
const jobInput = document.getElementById("job-id");
const form = document.getElementById("camera-form");
const cameraInput = document.getElementById("camera-id");
const authTokenInput = document.getElementById("auth-token");
const savedCameras = document.getElementById("saved-cameras");
const clearHistoryButton = document.getElementById("clear-history");
const clearTokenButton = document.getElementById("clear-token");
const refreshButton = document.getElementById("refresh-button");
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
const jobStatusText = document.getElementById("job-status");
const jobResult = document.getElementById("job-result");
const jobNameText = document.getElementById("job-name");
const jobMetaText = document.getElementById("job-meta");
const jobCameras = document.getElementById("job-cameras");

let currentCameraId = "";
let currentObjectUrl = "";
let currentTab = "snapshot";
let hlsPlayer = null;
let currentJob = null;

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
      loadCurrentView(cameraId);
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

function setJobStatus(message, tone = "") {
  jobStatusText.textContent = message;
  jobStatusText.className = `helper-text${tone ? ` ${tone}` : ""}`;
}

function buildSnapshotUrl(cameraId) {
  const encodedId = encodeURIComponent(cameraId);
  return `https://media.evercam.io/v2/cameras/${encodedId}/live/snapshot?t=${Date.now()}`;
}

function buildHlsUrl(cameraId) {
  const encodedId = encodeURIComponent(cameraId);
  return `https://media.evercam.io/v2/cameras/${encodedId}/hls?t=${Date.now()}`;
}

function buildCameraDetailsUrl(cameraId) {
  const encodedId = encodeURIComponent(cameraId);
  return `https://media.evercam.io/v2/cameras/${encodedId}`;
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

function renderJobResult(job) {
  currentJob = job;
  jobResult.hidden = false;
  jobNameText.textContent = `${job.jobNumber} - ${job.name}`;

  const meta = [];
  if (job.projectName) meta.push(`Project: ${job.projectName}`);
  if (job.dealName) meta.push(`Deal: ${job.dealName}`);
  if (job.status) meta.push(`Status: ${job.status}`);
  if (job.installDate) meta.push(`Install: ${job.installDate}`);
  jobMetaText.textContent = meta.join(" | ");

  jobCameras.innerHTML = "";
  if (!job.cameras.length) {
    const empty = document.createElement("p");
    empty.className = "helper-text";
    empty.textContent = "No cameras found on this job.";
    jobCameras.appendChild(empty);
    return;
  }

  job.cameras.forEach((camera) => {
    const chip = document.createElement("div");
    chip.className = "saved-camera";

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "saved-camera-load";
    loadButton.textContent = camera.id;
    loadButton.title = camera.name || camera.id;
    loadButton.addEventListener("click", () => {
      cameraInput.value = camera.id;
      loadCurrentView(camera.id);
    });

    chip.append(loadButton);
    jobCameras.appendChild(chip);
  });
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

function switchTab(tab) {
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

  if (currentCameraId && !isLocal) {
    loadCurrentView(currentCameraId);
  }

  if (isLocal) {
    updateLocalFeedUi();
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
  cleanupHls();

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

async function loadLiveFeed(cameraId) {
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
    const detailsResponse = await fetch(buildCameraDetailsUrl(normalized), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });

    if (!detailsResponse.ok) {
      throw new Error(`HTTP ${detailsResponse.status}`);
    }

    const detailsJson = await detailsResponse.json();
    const camera = Array.isArray(detailsJson.cameras) ? detailsJson.cameras[0] : null;
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

function loadCurrentView(cameraId) {
  if (currentTab === "live") {
    return loadLiveFeed(cameraId);
  }

  if (currentTab === "local") {
    currentCameraId = cameraId.trim();
    cameraInput.value = currentCameraId;
    currentCameraText.textContent = `Current camera: ${currentCameraId || "No camera selected yet."}`;
    rememberCameraId(currentCameraId);
    updateLocalFeedUi();
    setStatus("Ready to open the local camera feed on the onsite network.", "success");
    return;
  }

  return loadSnapshot(cameraId);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadCurrentView(cameraInput.value);
});

jobForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const jobId = jobInput.value.trim();
  if (!jobId) {
    setJobStatus("Enter a job number first.", "error");
    return;
  }

  setJobStatus("Finding job...", "");
  jobResult.hidden = true;

  try {
    const response = await fetch(`/api/zoho-job?jobId=${encodeURIComponent(jobId)}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Job lookup failed.");
    }

    renderJobResult(result);
    setJobStatus(`Loaded ${result.cameras.length} camera${result.cameras.length === 1 ? "" : "s"} for job ${result.jobNumber}.`, "success");

    if (result.cameras.length) {
      cameraInput.value = result.cameras[0].id;
      currentCameraId = result.cameras[0].id;
      currentCameraText.textContent = `Current camera: ${currentCameraId}`;
      refreshButton.disabled = false;
    }
  } catch (error) {
    currentJob = null;
    jobResult.hidden = true;
    setJobStatus(error.message || "Could not load that job.", "error");
  }
});

refreshButton.addEventListener("click", () => {
  if (currentCameraId) {
    loadCurrentView(currentCameraId);
  }
});

snapshotTabButton.addEventListener("click", () => switchTab("snapshot"));
liveTabButton.addEventListener("click", () => switchTab("live"));
localTabButton.addEventListener("click", () => switchTab("local"));

clearHistoryButton.addEventListener("click", () => {
  setSavedCameraIds([]);
  renderSavedCameraIds();
});

clearTokenButton.addEventListener("click", () => {
  authTokenInput.value = "";
  setSavedToken("");
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

authTokenInput.value = getSavedToken();
const localFeedSettings = getLocalFeedSettings();
localIpInput.value = localFeedSettings.ip;
localPortInput.value = localFeedSettings.port;
cameraBrandSelect.value = localFeedSettings.brand;
updateLocalFeedUi();
renderSavedCameraIds();
