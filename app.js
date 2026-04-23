const STORAGE_KEY = "evercam-saved-camera-ids";
const REMEMBERED_USERNAME_KEY = "evercam-remembered-username";
const REMEMBERED_PASSWORD_KEY = "evercam-remembered-password";
const LOCAL_FEED_STORAGE_KEY = "evercam-local-feed-settings";
const MAX_SAVED = 8;

const lookupForm = document.getElementById("lookup-form");
const lookupInput = document.getElementById("lookup-id");
const authUsernameInput = document.getElementById("auth-username");
const authPasswordInput = document.getElementById("auth-password");
const rememberLoginInput = document.getElementById("remember-login");
const savedCameras = document.getElementById("saved-cameras");
const clearHistoryButton = document.getElementById("clear-history");
const clearLoginButton = document.getElementById("clear-login");
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
const lookupStatusText = document.getElementById("lookup-status");
const jobResult = document.getElementById("job-result");
const jobNameText = document.getElementById("job-name");
const jobMetaText = document.getElementById("job-meta");
const jobWorksheetLink = document.getElementById("job-worksheet-link");
const jobCameras = document.getElementById("job-cameras");

let currentCameraId = "";
let currentObjectUrl = "";
let currentTab = "snapshot";
let hlsPlayer = null;
let currentJob = null;
let sessionAuthToken = "";

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
        preserveLookupValue: lookupInput.value.trim().toLowerCase()
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
  if (!options.preserveSummary) {
    hideJobResult();
  }
  if (options.preserveLookupValue) {
    lookupInput.value = options.preserveLookupValue;
  } else {
    lookupInput.value = normalized;
  }
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
    const headers = await getAuthHeaders();
    const response = await fetch(buildSnapshotUrl(normalized), {
      headers
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
  if (!options.preserveSummary) {
    hideJobResult();
  }
  if (options.preserveLookupValue) {
    lookupInput.value = options.preserveLookupValue;
  } else {
    lookupInput.value = normalized;
  }
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
    currentCameraText.textContent = `Current camera: ${currentCameraId || "No camera selected yet."}`;
    rememberCameraId(currentCameraId);
    updateLocalFeedUi();
    setStatus("Ready to open the local camera feed on the onsite network.", "success");
    return;
  }

  return loadSnapshot(normalized, options);
}
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

clearLoginButton.addEventListener("click", () => {
  authUsernameInput.value = "";
  authPasswordInput.value = "";
  rememberLoginInput.checked = false;
  setRememberedUsername("");
  setRememberedPassword("");
  sessionAuthToken = "";
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
    currentCameraText.textContent = `Current camera: ${currentCameraId}`;
    refreshButton.disabled = false;

    renderProjectResult(projectId, cameras, cameras[0].id);
    setLookupStatus(`Loaded ${cameras.length} camera${cameras.length === 1 ? "" : "s"} for project ${projectId}.`, "success");
    switchTab("snapshot", { suppressLoad: true });
    await loadSnapshot(cameras[0].id, {
      preserveSummary: true,
      preserveLookupValue: projectId
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
    return false;
  }

  const result = await response.json();
  const camera = Array.isArray(result.cameras) ? result.cameras[0] : null;
  if (!camera) {
    return false;
  }

  hideJobResult();
  setLookupStatus(`Loaded camera ${cameraId}.`, "success");
  await loadCurrentView(cameraId);
  lookupInput.value = cameraId;
  return true;
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

      if (result.cameras.length) {
        currentCameraId = result.cameras[0].id;
        currentCameraText.textContent = `Current camera: ${currentCameraId}`;
        refreshButton.disabled = false;
        switchTab("snapshot", { suppressLoad: true });
        await loadSnapshot(result.cameras[0].id, {
          preserveSummary: true,
          preserveLookupValue: jobId
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

  const loadedCamera = await tryLoadSingleCamera(value);
  if (loadedCamera) {
    return;
  }

  if (looksLikeProjectId(value)) {
    await loadProjectCameras(value);
    return;
  }

  setLookupStatus("No camera or project found for that ID.", "error");
});
