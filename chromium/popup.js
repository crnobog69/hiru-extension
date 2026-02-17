const STORAGE_SERVER_KEY = "hiru_server_url";
const STORAGE_THEME_KEY = "hiru_ext_theme";
const STORAGE_LANGUAGE_KEY = "hiru_ext_language";
const DEFAULT_TEST_SERVER = "http://localhost:3000";
const DEFAULT_THEME = "dark";
const DEFAULT_LANGUAGE = "auto";
const SUPPORTED_LANGUAGES = [
  "en",
  "sr",
  "sr_Cyrl",
  "ja",
  "ja_Latn",
  "zh_CN",
  "zh_TW",
  "el",
  "ro",
  "ru",
];

const serverSelect = document.getElementById("serverSelect");
const customServer = document.getElementById("customServer");
const themeSelect = document.getElementById("themeSelect");
const languageSelect = document.getElementById("languageSelect");
const settingsToggleBtn = document.getElementById("settingsToggleBtn");
const settingsPanel = document.getElementById("settingsPanel");
const collectionSelect = document.getElementById("collectionSelect");
const collectionPicker = document.getElementById("collectionPicker");
const collectionPickerBtn = document.getElementById("collectionPickerBtn");
const collectionPickerMenu = document.getElementById("collectionPickerMenu");
const collectionSearch = document.getElementById("collectionSearch");
const collectionList = document.getElementById("collectionList");
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
let pickerItems = [];
let lucideNameSet = null;
let activeMessages = null;

const ICON_ALIAS_MAP = {
  book: "book-open",
  code: "code-2",
  music: "music-3",
  gamepad2: "gamepad-2",
  graduationcap: "graduation-cap",
  trash: "trash-2",
};

function formatMessage(template, substitutions) {
  if (!substitutions) return template;
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  let out = template;
  values.forEach((value, index) => {
    const tokenIndex = index + 1;
    const safeValue = String(value ?? "");
    out = out.replaceAll(`$${tokenIndex}`, safeValue);
    out = out.replaceAll(`$STATUS$`, safeValue);
  });
  return out;
}

function t(key, fallback = "", substitutions) {
  const localMessage = activeMessages?.[key]?.message;
  if (typeof localMessage === "string" && localMessage.trim()) {
    return formatMessage(localMessage, substitutions);
  }
  const fromChrome = chrome?.i18n?.getMessage?.(key, substitutions);
  if (typeof fromChrome === "string" && fromChrome.trim()) return fromChrome;
  return fallback || key;
}

function normalizeToSupportedLocale(raw) {
  const lower = String(raw || "").trim().toLowerCase();
  if (lower.startsWith("zh-cn") || lower === "zh-hans" || lower.startsWith("zh-sg")) {
    return "zh_CN";
  }
  if (lower.startsWith("zh-tw") || lower === "zh-hant" || lower.startsWith("zh-hk")) {
    return "zh_TW";
  }
  if (lower.startsWith("sr-cyrl")) return "sr_Cyrl";
  if (lower.startsWith("sr-latn")) return "sr";
  if (lower.startsWith("sr")) return "sr";
  if (lower.startsWith("el")) return "el";
  if (lower.startsWith("ro")) return "ro";
  if (lower.startsWith("ru")) return "ru";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("en")) return "en";
  return "en";
}

async function resolveActiveLocale(selectedLanguage) {
  if (selectedLanguage && selectedLanguage !== "auto") {
    return SUPPORTED_LANGUAGES.includes(selectedLanguage) ? selectedLanguage : "en";
  }
  const language = chrome?.i18n?.getUILanguage?.() || "en";
  return normalizeToSupportedLocale(language);
}

async function loadMessagesForLocale(locale) {
  try {
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function applyStaticI18n() {
  const language = languageSelect?.value || DEFAULT_LANGUAGE;
  if (language === "ja" || language === "ja_Latn") {
    document.documentElement.lang = "ja";
  } else if (language === "zh_CN" || language === "zh_TW") {
    document.documentElement.lang = "zh";
  } else if (language === "sr" || language === "sr_Cyrl") {
    document.documentElement.lang = "sr";
  } else if (language === "el") {
    document.documentElement.lang = "el";
  } else if (language === "ro") {
    document.documentElement.lang = "ro";
  } else if (language === "ru") {
    document.documentElement.lang = "ru";
  } else {
    document.documentElement.lang = "en";
  }

  for (const el of document.querySelectorAll("[data-i18n]")) {
    const key = el.getAttribute("data-i18n");
    if (!key) continue;
    el.textContent = t(key, el.textContent || "");
  }

  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) continue;
    const fallback = el.getAttribute("placeholder") || "";
    el.setAttribute("placeholder", t(key, fallback));
  }

  for (const el of document.querySelectorAll("[data-i18n-title]")) {
    const key = el.getAttribute("data-i18n-title");
    if (!key) continue;
    const fallback = el.getAttribute("title") || "";
    el.setAttribute("title", t(key, fallback));
  }
}

function normalizeIconKey(value) {
  const v = String(value || "")
    .trim()
    .replace(/^lucide[-:]/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return v || "folder";
}

function toLucideIcon(value) {
  const key = normalizeIconKey(value);
  const preferred = ICON_ALIAS_MAP[key] || key;
  if (!lucideNameSet) {
    const icons = window?.lucide?.icons;
    lucideNameSet = new Set();
    if (icons && typeof icons === "object") {
      for (const iconName of Object.keys(icons)) {
        lucideNameSet.add(normalizeIconKey(iconName));
      }
    }
  }
  if (lucideNameSet.has(preferred)) return preferred;
  if (lucideNameSet.has(key)) return key;
  return "folder";
}

function normalizeIconColor(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return raw;
  if (/^rgb(a)?\([^)]+\)$/i.test(raw)) return raw;
  if (/^hsl(a)?\([^)]+\)$/i.test(raw)) return raw;
  return "";
}

function renderLucide() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons({
      attrs: {
        width: "14",
        height: "14",
        "stroke-width": "2",
      },
    });
  }
}

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
  pickerItems = [];
  collectionSelect.innerHTML = "";

  function bySortOrderThenName(a, b) {
    const sa = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 0;
    const sb = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0;
    if (sa !== sb) return sa - sb;
    return String(a.name || "").localeCompare(String(b.name || ""));
  }

  function buildTree(items) {
    const map = new Map();
    const roots = [];
    for (const item of items) {
      map.set(item.id, { ...item, children: [] });
    }
    for (const item of items) {
      const node = map.get(item.id);
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }
    const sortDeep = (nodes) => {
      nodes.sort(bySortOrderThenName);
      for (const n of nodes) sortDeep(n.children);
    };
    sortDeep(roots);
    return roots;
  }

  function addNodeOption(node, depth) {
    const opt = document.createElement("option");
    const indent = depth > 0 ? `${"  ".repeat(depth)}↳ ` : "";
    opt.value = node.id;
    opt.textContent = `${indent}${node.name}`;
    collectionSelect.appendChild(opt);
    pickerItems.push({
      id: node.id,
      name: node.name,
      iconName: toLucideIcon(node.icon),
      color: normalizeIconColor(node.color),
      depth,
      sortOrder: Number.isFinite(Number(node.sortOrder)) ? Number(node.sortOrder) : 0,
    });
    for (const child of node.children) {
      addNodeOption(child, depth + 1);
    }
  }

  const unsorted = collections.find((c) => c.isDefault);
  const normal = collections.filter(
    (c) => !c.isTrash && !c.isFavorites && !c.isDefault
  );
  const roots = buildTree(normal);

  if (unsorted) {
    const opt = document.createElement("option");
    opt.value = unsorted.id;
    opt.textContent = `${unsorted.name}`;
    collectionSelect.appendChild(opt);
    pickerItems.push({
      id: unsorted.id,
      name: unsorted.name,
      iconName: toLucideIcon(unsorted.icon || "inbox"),
      color: normalizeIconColor(unsorted.color),
      depth: 0,
      sortOrder: Number.isFinite(Number(unsorted.sortOrder))
        ? Number(unsorted.sortOrder)
        : 0,
    });
  } else {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = t("unsortedLabel", "Unsorted");
    collectionSelect.appendChild(opt);
    pickerItems.push({
      id: "",
      name: t("unsortedLabel", "Unsorted"),
      iconName: "inbox",
      color: "",
      depth: 0,
      sortOrder: 0,
    });
  }

  for (const root of roots) {
    addNodeOption(root, 0);
  }

  if (oldValue && Array.from(collectionSelect.options).some((o) => o.value === oldValue)) {
    collectionSelect.value = oldValue;
  } else if (!collectionSelect.value && collectionSelect.options.length > 0) {
    collectionSelect.value = collectionSelect.options[0].value;
  }

  renderCollectionPicker();
}

function selectedCollectionMeta() {
  const selected = pickerItems.find((item) => item.id === collectionSelect.value);
  if (!selected) {
    return { iconName: "inbox", name: t("unsortedLabel", "Unsorted"), depth: 0, color: "" };
  }
  return selected;
}

function renderPickerButtonLabel() {
  const selected = selectedCollectionMeta();
  const wrap = document.createElement("span");
  wrap.className = "picker-btn-content";

  const iconWrap = document.createElement("span");
  iconWrap.className = "picker-btn-icon";
  if (selected.color) iconWrap.style.color = selected.color;

  const icon = document.createElement("i");
  icon.setAttribute("data-lucide", selected.iconName || "folder");
  icon.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "picker-btn-label";
  const indent = selected.depth > 0 ? `${"· ".repeat(selected.depth)}` : "";
  label.textContent = `${indent}${selected.name}`;

  iconWrap.appendChild(icon);
  wrap.appendChild(iconWrap);
  wrap.appendChild(label);
  collectionPickerBtn.replaceChildren(wrap);
  renderLucide();
}

function renderCollectionPicker() {
  const query = String(collectionSearch.value || "").trim().toLowerCase();
  collectionList.innerHTML = "";

  const visible = pickerItems.filter((item) => {
    if (!query) return true;
    return item.name.toLowerCase().includes(query);
  });

  if (visible.length === 0) {
    const empty = document.createElement("div");
    empty.className = "picker-empty";
    empty.textContent = t("noFoldersFound", "No folders found.");
    collectionList.appendChild(empty);
  } else {
    for (const item of visible) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "picker-item";
      if (item.id === collectionSelect.value) row.classList.add("active");

      const label = document.createElement("span");
      label.className = "picker-item-label";

      const iconWrap = document.createElement("span");
      iconWrap.className = "picker-item-icon";
      if (item.color) iconWrap.style.color = item.color;

      const icon = document.createElement("i");
      icon.setAttribute("data-lucide", item.iconName || "folder");
      icon.setAttribute("aria-hidden", "true");

      const text = document.createElement("span");
      const indent = item.depth > 0 ? `${"· ".repeat(item.depth)}` : "";
      text.textContent = `${indent}${item.name}`;

      iconWrap.appendChild(icon);
      label.appendChild(iconWrap);
      label.appendChild(text);

      const mark = document.createElement("span");
      mark.textContent = item.id === collectionSelect.value ? "✓" : "";

      row.appendChild(label);
      row.appendChild(mark);
      row.addEventListener("click", () => {
        collectionSelect.value = item.id;
        renderPickerButtonLabel();
        collectionPickerMenu.classList.add("hidden");
      });
      collectionList.appendChild(row);
    }
  }

  renderPickerButtonLabel();
  renderLucide();
}

async function loadTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab || null;
  const initialTitle = currentTab?.title || t("untitled", "Untitled");
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

async function loadLanguage() {
  const data = await chrome.storage.sync.get(STORAGE_LANGUAGE_KEY);
  const selected = data?.[STORAGE_LANGUAGE_KEY] || DEFAULT_LANGUAGE;
  languageSelect.value = selected;
  const resolved = await resolveActiveLocale(selected);
  activeMessages = await loadMessagesForLocale(resolved);
  if (!activeMessages) {
    activeMessages = await loadMessagesForLocale("en");
  }
}

async function saveLanguage() {
  const selected = languageSelect.value || DEFAULT_LANGUAGE;
  await chrome.storage.sync.set({ [STORAGE_LANGUAGE_KEY]: selected });
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
    setStatus(t("statusValidServerUrl", "Enter a valid server URL."), "err");
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
    collectionSelect.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("unsortedLabel", "Unsorted");
    collectionSelect.appendChild(option);
    pickerItems = [{ id: "", name: t("unsortedLabel", "Unsorted"), iconName: "inbox", color: "", depth: 0, sortOrder: 0 }];
    renderCollectionPicker();
    setStatus(t("statusCouldNotLoadFolders", "Could not load folders. Open Hiru and sign in."), "err");
  }
}

collectionPickerBtn.addEventListener("click", () => {
  collectionPickerMenu.classList.toggle("hidden");
  if (!collectionPickerMenu.classList.contains("hidden")) {
    collectionSearch.focus();
    collectionSearch.select();
    renderCollectionPicker();
  }
});

collectionSearch.addEventListener("input", () => {
  renderCollectionPicker();
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (!collectionPicker.contains(target)) {
    collectionPickerMenu.classList.add("hidden");
  }
});

settingsToggleBtn.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

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

languageSelect.addEventListener("change", async () => {
  await saveLanguage();
  await loadLanguage();
  applyStaticI18n();
  updateDescCounter();
  renderCollectionPicker();
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
    setStatus(t("statusUrlRequired", "URL is required."), "err");
    return;
  }
  try {
    new URL(finalUrl);
  } catch {
    setStatus(t("statusValidUrl", "Enter a valid URL."), "err");
    return;
  }

  saveBtn.disabled = true;
  setStatus(t("statusSaving", "Saving..."));

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
      setStatus(t("statusBookmarkSaved", "Bookmark saved."), "ok");
      return;
    }

    let msg = t("statusSaveFailed", `Save failed (${res.status}).`, String(res.status));
    try {
      const data = await res.json();
      if (typeof data?.error === "string" && data.error) msg = data.error;
    } catch {
      // ignore non-json body
    }

    if (res.status === 401 || res.status === 403) {
      setStatus(t("statusNotAuthenticated", "Not authenticated. Open Hiru and sign in."), "err");
      return;
    }

    setStatus(msg, "err");
  } catch {
    setStatus(t("statusNetworkError", "Network error. Check server URL and try again."), "err");
  } finally {
    saveBtn.disabled = false;
  }
});

(async () => {
  await loadLanguage();
  applyStaticI18n();
  renderLucide();
  await loadTheme();
  await loadTab();
  await loadServerSelection();
  updateDescCounter();
  await reloadCollections();
})();
