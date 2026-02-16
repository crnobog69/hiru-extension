const STORAGE_SERVER_KEY = "hiru_server_url";
const STORAGE_THEME_KEY = "hiru_ext_theme";
const DEFAULT_TEST_SERVER = "http://localhost:3000";
const DEFAULT_THEME = "dark";

const serverSelect = document.getElementById("serverSelect");
const customServer = document.getElementById("customServer");
const themeSelect = document.getElementById("themeSelect");
const collectionSelect = document.getElementById("collectionSelect");
const descriptionInput = document.getElementById("descriptionInput");
const descCounter = document.getElementById("descCounter");
const titleInput = document.getElementById("titleInput");
const urlInput = document.getElementById("urlInput");
const tabTitle = document.getElementById("tabTitle");
const tabUrl = document.getElementById("tabUrl");
const saveBtn = document.getElementById("saveBtn");
const openBtn = document.getElementById("openBtn");
const statusEl = document.getElementById("status");

let currentTab = null;

function normalizeServerUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.classList.remove("ok", "err");
  if (kind) statusEl.classList.add(kind);
}

function updateDescCounter() {
  const len = descriptionInput.value.length;
  descCounter.textContent = `${len} / 100`;
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme || DEFAULT_THEME);
}

async function getSessionToken(server) {
  try {
    const cookie = await chrome.cookies.get({
      url: server,
      name: "hiru_session",
    });
    return cookie?.value || null;
  } catch {
    return null;
  }
}

async function buildAuthHeaders(server) {
  const headers = { "Content-Type": "application/json" };
  const token = await getSessionToken(server);
  if (token) {
    headers["x-hiru-session"] = token;
  }
  return headers;
}

async function fetchCollections(server) {
  const headers = await buildAuthHeaders(server);
  const res = await fetch(`${server}/api/collections`, {
    method: "GET",
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Collections fetch failed (${res.status})`);
  }

  return res.json();
}

function fillCollections(collections) {
  const oldValue = collectionSelect.value;
  collectionSelect.innerHTML = "";

  const unsorted = collections.find((c) => c.isDefault);
  const normal = collections.filter((c) => !c.isTrash && !c.isFavorites && !c.isDefault);

  if (unsorted) {
    const opt = document.createElement("option");
    opt.value = unsorted.id;
    opt.textContent = unsorted.name;
    collectionSelect.appendChild(opt);
  } else {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Unsorted";
    collectionSelect.appendChild(opt);
  }

  for (const c of normal) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    collectionSelect.appendChild(opt);
  }

  if (oldValue && Array.from(collectionSelect.options).some((o) => o.value === oldValue)) {
    collectionSelect.value = oldValue;
  }
}

async function loadTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab || null;
  const initialTitle = currentTab?.title || "Untitled";
  const initialUrl = currentTab?.url || "";
  tabTitle.textContent = initialTitle;
  tabUrl.textContent = initialUrl;
  titleInput.value = initialTitle;
  urlInput.value = initialUrl;
}

async function loadTheme() {
  const data = await chrome.storage.sync.get(STORAGE_THEME_KEY);
  const saved = data?.[STORAGE_THEME_KEY] || DEFAULT_THEME;
  themeSelect.value = saved;
  applyTheme(saved);
}

async function saveTheme() {
  const next = themeSelect.value || DEFAULT_THEME;
  await chrome.storage.sync.set({ [STORAGE_THEME_KEY]: next });
  applyTheme(next);
}

async function loadServerSelection() {
  const { [STORAGE_SERVER_KEY]: stored } = await chrome.storage.sync.get(STORAGE_SERVER_KEY);
  const saved = normalizeServerUrl(stored) || DEFAULT_TEST_SERVER;

  if (saved === "http://localhost:3000") {
    serverSelect.value = "http://localhost:3000";
    customServer.classList.add("hidden");
    customServer.value = "";
    return saved;
  }

  if (saved === "https://hiru.crnbg.org") {
    serverSelect.value = "https://hiru.crnbg.org";
    customServer.classList.add("hidden");
    customServer.value = "";
    return saved;
  }

  serverSelect.value = "custom";
  customServer.classList.remove("hidden");
  customServer.value = saved;
  return saved;
}

async function saveServerSelection() {
  const selected = serverSelect.value;
  const next =
    selected === "custom"
      ? normalizeServerUrl(customServer.value)
      : normalizeServerUrl(selected);

  if (!next) {
    setStatus("Enter a valid server URL.", "err");
    return null;
  }

  await chrome.storage.sync.set({ [STORAGE_SERVER_KEY]: next });
  return next;
}

async function reloadCollections() {
  const server = await saveServerSelection();
  if (!server) return;

  try {
    const collections = await fetchCollections(server);
    fillCollections(collections);
    setStatus("", "");
  } catch {
    collectionSelect.innerHTML = "<option value=''>Unsorted</option>";
    setStatus("Could not load folders. Open Hiru and sign in.", "err");
  }
}

serverSelect.addEventListener("change", async () => {
  if (serverSelect.value === "custom") {
    customServer.classList.remove("hidden");
  } else {
    customServer.classList.add("hidden");
  }
  await reloadCollections();
});

customServer.addEventListener("blur", async () => {
  await reloadCollections();
});

themeSelect.addEventListener("change", async () => {
  await saveTheme();
});

descriptionInput.addEventListener("input", updateDescCounter);

openBtn.addEventListener("click", async () => {
  const server = await saveServerSelection();
  if (!server) return;
  await chrome.tabs.create({ url: `${server}/app` });
});

saveBtn.addEventListener("click", async () => {
  const server = await saveServerSelection();
  if (!server) return;
  const finalTitle = (titleInput.value || "").trim();
  const finalUrl = (urlInput.value || "").trim();
  if (!finalUrl) {
    setStatus("URL is required.", "err");
    return;
  }
  try {
    new URL(finalUrl);
  } catch {
    setStatus("Enter a valid URL.", "err");
    return;
  }

  saveBtn.disabled = true;
  setStatus("Saving...");

  try {
    const headers = await buildAuthHeaders(server);
    const payload = {
      url: finalUrl,
      title: finalTitle || finalUrl,
      collectionId: collectionSelect.value || null,
      description: (descriptionInput.value || "").slice(0, 100),
    };

    const res = await fetch(`${server}/api/bookmarks`, {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setStatus("Bookmark saved.", "ok");
      return;
    }

    let msg = `Save failed (${res.status}).`;
    try {
      const data = await res.json();
      if (typeof data?.error === "string" && data.error) msg = data.error;
    } catch {
      // ignore non-json body
    }

    if (res.status === 401 || res.status === 403) {
      setStatus("Not authenticated. Open Hiru and sign in.", "err");
      return;
    }

    setStatus(msg, "err");
  } catch {
    setStatus("Network error. Check server URL and try again.", "err");
  } finally {
    saveBtn.disabled = false;
  }
});

(async () => {
  await loadTheme();
  await loadTab();
  await loadServerSelection();
  updateDescCounter();
  await reloadCollections();
})();
