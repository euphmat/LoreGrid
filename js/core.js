"use strict";

// Shared state, persistence, image storage, and common helpers.

const STORAGE_KEY = "loregrid.state.v2";
const SCHEMA_VERSION = 4;
const IMAGE_DB_NAME = "loregrid.assets.v1";
const IMAGE_DB_VERSION = 1;
const IMAGE_STORE_NAME = "images";
const BOARD_WIDTH = 1800;
const BOARD_HEIGHT = 1050;
const COLOR_PALETTE = [
  "#F8F6EF", "#E8E3D8", "#D6D0C4", "#B8B2A8",
  "#F3C6C0", "#E98F86", "#CF5E55", "#923E3A",
  "#F5D1B5", "#E99A5E", "#CB713C", "#8D4C2C",
  "#F3E1A8", "#E7C95B", "#B89B35", "#786627",
  "#CDE3B1", "#93C76D", "#5D9B57", "#376A43",
  "#B7DDD6", "#69B6A9", "#3D8E88", "#286368",
  "#B8D8ED", "#74ADD1", "#477FA9", "#315575",
  "#D2C4E8", "#9A7CC1", "#74549A", "#513B72",
];
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const now = () => new Date().toISOString();
const uid = (prefix = "id") =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const escapeHTML = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
const normalizeColor = (value = "#F8F6EF") => {
  const color = String(value).trim().toUpperCase();
  return /^#[\dA-F]{6}$/.test(color) ? color : "#F8F6EF";
};
const normalizePaletteColor = (value) => {
  const color = normalizeColor(value);
  return COLOR_PALETTE.includes(color) ? color : "#74ADD1";
};

function normalizeListOptions(options) {
  if (!Array.isArray(options)) return [];
  const labels = new Set();
  return options
    .map((option, index) => {
      const source =
        option && typeof option === "object"
          ? option
          : { label: String(option ?? "") };
      const label = String(source.label || "").trim();
      if (!label || labels.has(label)) return null;
      labels.add(label);
      return {
        id: source.id || uid("opt"),
        label,
        color: normalizePaletteColor(
          source.color || COLOR_PALETTE[(index * 3 + 20) % COLOR_PALETTE.length],
        ),
      };
    })
    .filter(Boolean)
    .slice(0, 50);
}

function normalizeLinkMemo(link) {
  if (typeof link?.memo === "string") return link.memo.slice(0, 240);
  const legacyLabel = String(link?.label || "").trim();
  const legacyAction = String(link?.action || "").trim();
  if (legacyLabel && legacyLabel !== "関連" && legacyAction) {
    return `${legacyLabel}：${legacyAction}`.slice(0, 240);
  }
  return (legacyAction || (legacyLabel === "関連" ? "" : legacyLabel)).slice(0, 240);
}

const entity = (data) => ({
  id: data.id || uid("ent"),
  title: data.title || "名称未設定",
  body: data.body || "",
  fields: data.fields && typeof data.fields === "object" ? { ...data.fields } : {},
  image: data.image || "",
  imageId: data.imageId || "",
  imageName: data.imageName || "",
  organisation: data.organisation === true,
  groupColor: normalizePaletteColor(data.groupColor || "#74ADD1"),
  groupWidth: Number.isFinite(data.groupWidth)
    ? Math.min(1200, Math.max(240, data.groupWidth))
    : 480,
  groupHeight: Number.isFinite(data.groupHeight)
    ? Math.min(850, Math.max(170, data.groupHeight))
    : 300,
  parentGroupId: typeof data.parentGroupId === "string" ? data.parentGroupId : "",
  links: Array.isArray(data.links)
    ? data.links
        .filter((link) => link?.targetId)
        .map((link) => ({
          targetId: link.targetId,
          memo: normalizeLinkMemo(link),
          arrow: ["none", "start", "end", "both"].includes(link.arrow)
            ? link.arrow
            : "none",
          sourceAnchor: link.sourceAnchor || "",
          targetAnchor: link.targetAnchor || "",
        }))
    : [],
  x: Number.isFinite(data.x) ? data.x : 100,
  y: Number.isFinite(data.y) ? data.y : 100,
  createdAt: data.createdAt || now(),
  updatedAt: data.updatedAt || now(),
});

function seedState() {
  const timestamp = now();
  return {
    schemaVersion: SCHEMA_VERSION,
    activeProjectId: "project_default",
    activeEntityId: null,
    settings: {
      theme: "dark",
      view: "database",
      query: "",
      listFilters: {},
      sort: "updatedAt-desc",
      boardZoom: 1,
      sidebarCollapsed: false,
    },
    projects: [
      {
        id: "project_default",
        name: "新しいプロジェクト",
        gameType: "その他",
        accent: "#d06347",
        description: "",
        bannerImageId: "",
        bannerImageName: "",
        columns: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        entities: [],
      },
    ],
  };
}

function normalizeState(candidate) {
  if (!candidate || !Array.isArray(candidate.projects)) throw new Error("プロジェクトがありません。");
  const defaults = seedState().settings;
  const projects = candidate.projects.map((project) => {
    const rawEntities = Array.isArray(project.entities) ? project.entities : [];
    const columns = Array.isArray(project.columns)
      ? project.columns.map((column) => ({
          id: column.id || uid("field"),
          label: column.label || "名称未設定",
          kind: ["text", "number", "date", "checkbox", "textarea", "list"].includes(column.kind)
            ? column.kind
            : "text",
          options: normalizeListOptions(column.options),
        }))
      : [];
    const entities = rawEntities.map((item) =>
      entity({
        ...item,
        fields: item.fields || {},
      }),
    );
    columns
      .filter((column) => column.kind === "list")
      .forEach((column) => {
        entities.forEach((item) => {
          const value = item.fields[column.id];
          if (value === undefined || value === null || value === "") return;
          const match = column.options.find(
            (option) => option.id === value || option.label === String(value),
          );
          if (match) item.fields[column.id] = match.id;
        });
      });
    return {
      id: project.id || uid("project"),
      name: project.name || "名称未設定のプロジェクト",
      gameType: project.gameType || "その他",
      accent: project.accent || "#d06347",
      description: project.description || "",
      bannerImageId: project.bannerImageId || "",
      bannerImageName: project.bannerImageName || "",
      columns,
      createdAt: project.createdAt || now(),
      updatedAt: project.updatedAt || now(),
      entities,
    };
  });
  if (!projects.length) throw new Error("少なくとも1つのプロジェクトが必要です。");
  projects.forEach((project) => {
    const organisationIds = new Set(
      project.entities.filter((item) => item.organisation).map((item) => item.id),
    );
    project.entities.forEach((item) => {
      if (
        !organisationIds.has(item.parentGroupId) ||
        item.parentGroupId === item.id
      ) {
        item.parentGroupId = "";
      }
    });
    project.entities.forEach((item) => {
      const visited = new Set([item.id]);
      let parentId = item.parentGroupId;
      while (parentId) {
        if (visited.has(parentId)) {
          item.parentGroupId = "";
          break;
        }
        visited.add(parentId);
        parentId =
          project.entities.find((candidate) => candidate.id === parentId)?.parentGroupId || "";
      }
    });
  });
  const activeProjectId = projects.some((p) => p.id === candidate.activeProjectId)
    ? candidate.activeProjectId
    : projects[0].id;
  const settings = { ...defaults };
  Object.keys(defaults).forEach((key) => {
    if (candidate.settings?.[key] !== undefined) {
      settings[key] = candidate.settings[key];
    }
  });
  if (settings.sort === "type-asc" || settings.sort === "type-desc") {
    settings.sort = defaults.sort;
  }
  settings.listFilters =
    settings.listFilters && typeof settings.listFilters === "object"
      ? Object.fromEntries(
          Object.entries(settings.listFilters)
            .map(([columnId, optionIds]) => [
              columnId,
              Array.isArray(optionIds)
                ? [...new Set(optionIds.map(String).filter(Boolean))]
                : [],
            ])
            .filter(([, optionIds]) => optionIds.length),
        )
      : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    activeProjectId,
    activeEntityId: candidate.activeEntityId || null,
    settings,
    projects,
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("LoreGrid: saved data could not be loaded.", error);
    return seedState();
  }
}

let state = loadState();
let saveTimer = null;
let commandSelection = 0;
let commandItems = [];
let draggedDatabaseColumnId = "";
let databaseColumnEditorDirty = false;
let workspaceBannerDragDepth = 0;
let lastGlobalEscape = 0;
const sessionImageURLs = new Map();
const imageLoadPending = new Map();
const missingImageIds = new Set();
let imageDatabasePromise = null;
let pendingProjectBannerFile = null;
let pendingProjectBannerURL = "";
let projectBannerRemovalRequested = false;

const dom = {
  app: $("#app"),
  sidebar: $("#sidebar"),
  sidebarBackdrop: $("#sidebar-backdrop"),
  projectList: $("#project-list"),
  tableHead: $("#entity-table-head"),
  tableBody: $("#entity-table-body"),
  emptyState: $("#empty-state"),
  databaseView: $("#database-view"),
  boardView: $("#board-view"),
  boardViewport: $("#board-viewport"),
  boardCanvas: $("#board-canvas"),
  boardCards: $("#board-cards"),
  relationLines: $("#relation-lines"),
  relationDraftLines: $("#relation-draft-lines"),
  relationEditor: $("#relation-editor"),
  relationMemo: $("#relation-memo"),
  workspaceHeader: $("#workspace-header"),
  workspaceBanner: $("#workspace-banner"),
  inspector: $("#inspector"),
  inspectorContent: $("#inspector-content"),
  search: $("#inline-search"),
  listFilterBar: $("#list-filter-bar"),
  entityModal: $("#entity-modal"),
  projectModal: $("#project-modal"),
  columnModal: $("#column-modal"),
  settingsModal: $("#settings-modal"),
  commandModal: $("#command-modal"),
  helpModal: $("#help-modal"),
  commandInput: $("#command-input"),
  commandResults: $("#command-results"),
  entityForm: $("#entity-form"),
  projectForm: $("#project-form"),
  columnForm: $("#column-form"),
  projectBannerDrop: $("#project-banner-drop"),
  projectBannerPreview: $("#project-banner-preview"),
  bodyEditor: $("#entity-body"),
  imagePath: $("#entity-image"),
  imagePreview: $("#image-preview"),
  dropzone: $("#image-dropzone"),
};

function activeProject() {
  return state.projects.find((project) => project.id === state.activeProjectId) || state.projects[0];
}

function activeEntity() {
  return activeProject()?.entities.find((item) => item.id === state.activeEntityId) || null;
}

function getEntityById(id) {
  return activeProject()?.entities.find((item) => item.id === id) || null;
}

function imageStorageSupported() {
  return Boolean(window.indexedDB);
}

function openImageDatabase() {
  if (!imageStorageSupported()) {
    return Promise.reject(new Error("このブラウザは IndexedDB に対応していません。"));
  }
  if (imageDatabasePromise) return imageDatabasePromise;
  const openPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        database.createObjectStore(IMAGE_STORE_NAME, { keyPath: "entityId" });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error("画像データベースを開けませんでした。"));
    request.onblocked = () => reject(new Error("画像データベースが別のタブで使用中です。"));
  });
  imageDatabasePromise = openPromise.catch((error) => {
    imageDatabasePromise = null;
    throw error;
  });
  return imageDatabasePromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB の操作に失敗しました。"));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error || new Error("IndexedDB の保存に失敗しました。"));
    transaction.onabort = () =>
      reject(transaction.error || new Error("IndexedDB の操作が中断されました。"));
  });
}

async function getStoredImage(entityId) {
  const database = await openImageDatabase();
  const transaction = database.transaction(IMAGE_STORE_NAME, "readonly");
  return requestResult(transaction.objectStore(IMAGE_STORE_NAME).get(entityId));
}

async function getAllStoredImages() {
  const database = await openImageDatabase();
  const transaction = database.transaction(IMAGE_STORE_NAME, "readonly");
  return requestResult(transaction.objectStore(IMAGE_STORE_NAME).getAll());
}

async function putStoredImage(entityId, file, name = file.name) {
  const database = await openImageDatabase();
  const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
  transaction.objectStore(IMAGE_STORE_NAME).put({
    entityId,
    blob: file,
    name: name || "image",
    type: file.type || "application/octet-stream",
    updatedAt: now(),
  });
  await transactionComplete(transaction);
}

async function deleteStoredImage(entityId) {
  if (!imageStorageSupported()) return;
  const database = await openImageDatabase();
  const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
  transaction.objectStore(IMAGE_STORE_NAME).delete(entityId);
  await transactionComplete(transaction);
}

async function replaceStoredImages(records) {
  if (!imageStorageSupported()) return;
  const database = await openImageDatabase();
  const transaction = database.transaction(IMAGE_STORE_NAME, "readwrite");
  const store = transaction.objectStore(IMAGE_STORE_NAME);
  store.clear();
  records.forEach((record) => store.put(record));
  await transactionComplete(transaction);
}

async function deleteImageDatabaseCompletely() {
  if (!imageStorageSupported()) return;
  if (imageDatabasePromise) {
    try {
      const database = await imageDatabasePromise;
      database.close();
    } catch {
      // The delete request below is still safe when opening previously failed.
    }
    imageDatabasePromise = null;
  }
  await new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(IMAGE_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error || new Error("画像データベースを削除できませんでした。"));
    request.onblocked = () =>
      reject(new Error("別のタブでLoreGridが開かれています。ほかのタブを閉じてください。"));
  });
}

function setSessionImageURL(entityId, blob) {
  const previous = sessionImageURLs.get(entityId);
  if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
  sessionImageURLs.set(entityId, URL.createObjectURL(blob));
  missingImageIds.delete(entityId);
}

function projectBannerSessionKey(projectId) {
  return `project-banner:${projectId}`;
}

async function hydrateEntityImage(item) {
  if (!item?.imageId || sessionImageURLs.has(item.id) || missingImageIds.has(item.id)) return false;
  if (imageLoadPending.has(item.id)) return imageLoadPending.get(item.id);
  const promise = getStoredImage(item.imageId)
    .then((record) => {
      if (!record?.blob) {
        missingImageIds.add(item.id);
        return false;
      }
      setSessionImageURL(item.id, record.blob);
      return true;
    })
    .catch((error) => {
      console.warn("LoreGrid: image could not be loaded.", error);
      return false;
    })
    .finally(() => imageLoadPending.delete(item.id));
  imageLoadPending.set(item.id, promise);
  return promise;
}

async function hydrateProjectBanner(project) {
  if (!project?.bannerImageId) return false;
  const sessionKey = projectBannerSessionKey(project.id);
  if (sessionImageURLs.has(sessionKey) || missingImageIds.has(sessionKey)) return false;
  if (imageLoadPending.has(sessionKey)) return imageLoadPending.get(sessionKey);
  const promise = getStoredImage(project.bannerImageId)
    .then((record) => {
      if (!record?.blob) {
        missingImageIds.add(sessionKey);
        return false;
      }
      setSessionImageURL(sessionKey, record.blob);
      return true;
    })
    .catch((error) => {
      console.warn("LoreGrid: project banner could not be loaded.", error);
      return false;
    })
    .finally(() => imageLoadPending.delete(sessionKey));
  imageLoadPending.set(sessionKey, promise);
  return promise;
}

async function hydrateActiveProjectImages(projectId = state.activeProjectId) {
  if (!imageStorageSupported()) return;
  const project = state.projects.find((candidate) => candidate.id === projectId);
  if (!project) return;
  const changed = await Promise.all([
    hydrateProjectBanner(project),
    ...project.entities.map(hydrateEntityImage),
  ]);
  if (projectId !== state.activeProjectId || !changed.some(Boolean)) return;
  renderHeader();
  renderDatabase();
  renderBoard();
  renderInspector();
}

function markChanged(message = "保存しました") {
  const pulse = $(".save-pulse");
  pulse?.classList.add("is-saving");
  $("#save-status").textContent = "保存中…";
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    pulse?.classList.remove("is-saving");
    $("#save-status").textContent = "この端末に保存済み";
  }, 180);
  if (message) $("#status-message").textContent = message;
}

function saveImmediately() {
  clearTimeout(saveTimer);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  $(".save-pulse")?.classList.remove("is-saving");
  $("#save-status").textContent = "この端末に保存済み";
}

function toast(message, icon = "✓") {
  const node = document.createElement("div");
  node.className = "toast";
  node.innerHTML = `<span class="toast-icon">${escapeHTML(icon)}</span><span>${escapeHTML(message)}</span>`;
  $("#toast-region").append(node);
  window.setTimeout(() => node.remove(), 3300);
}

function visibleEntities() {
  const { query, sort } = state.settings;
  const normalizedQuery = String(query || "").trim().toLocaleLowerCase("ja");
  const savedListFilters =
    state.settings.listFilters && typeof state.settings.listFilters === "object"
      ? state.settings.listFilters
      : {};
  const listFilters = activeProject().columns
    .filter((column) => column.kind === "list")
    .map((column) => {
      const validIds = new Set((column.options || []).map((option) => option.id));
      const optionIds = Array.isArray(savedListFilters[column.id])
        ? savedListFilters[column.id].filter((optionId) => validIds.has(optionId))
        : [];
      return [column.id, optionIds];
    })
    .filter(([, optionIds]) => optionIds.length);
  const items = activeProject().entities.filter((item) => {
    const matchesListFilters = listFilters.every(
      ([columnId, optionIds]) =>
        !Array.isArray(optionIds) ||
        !optionIds.length ||
        optionIds.includes(String(item.fields?.[columnId] ?? "")),
    );
    if (!matchesListFilters) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      item.title,
      item.body,
      ...activeProject().columns.map((column) => {
        const value = item.fields?.[column.id];
        return column.kind === "list"
          ? listOptionForValue(column, value)?.label || value || ""
          : value || "";
      }),
    ]
      .join("\n")
      .toLocaleLowerCase("ja");
    return haystack.includes(normalizedQuery);
  });
  const [key, direction] = String(sort || "updatedAt-desc").split("-");
  return [...items].sort((a, b) => {
    let result;
    if (key === "updatedAt") result = new Date(a.updatedAt) - new Date(b.updatedAt);
    else result = a.title.localeCompare(b.title, "ja");
    return direction === "asc" ? result : -result;
  });
}
