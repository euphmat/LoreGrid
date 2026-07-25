(() => {
  "use strict";

  const STORAGE_KEY = "loregrid.state.v2";
  const SCHEMA_VERSION = 3;
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
            label: link.label || "関連",
            action: link.action || "",
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
    workspaceHeader: $("#workspace-header"),
    workspaceBanner: $("#workspace-banner"),
    inspector: $("#inspector"),
    inspectorContent: $("#inspector-content"),
    search: $("#inline-search"),
    entityModal: $("#entity-modal"),
    projectModal: $("#project-modal"),
    columnModal: $("#column-modal"),
    settingsModal: $("#settings-modal"),
    relationModal: $("#relation-modal"),
    commandModal: $("#command-modal"),
    helpModal: $("#help-modal"),
    commandInput: $("#command-input"),
    commandResults: $("#command-results"),
    entityForm: $("#entity-form"),
    projectForm: $("#project-form"),
    columnForm: $("#column-form"),
    relationForm: $("#relation-form"),
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
    const items = activeProject().entities.filter((item) => {
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

  function setAccent(color) {
    document.documentElement.style.setProperty("--accent", color || "#d06347");
  }

  function renderProjects() {
    dom.projectList.innerHTML = state.projects
      .map(
        (project) => `
          <button class="project-item ${project.id === state.activeProjectId ? "is-active" : ""}"
            data-project-id="${escapeHTML(project.id)}" style="--project-color:${escapeHTML(project.accent)}">
            <span class="project-sigil">${escapeHTML(project.name.slice(0, 1))}</span>
            <span>${escapeHTML(project.name)}</span>
            <small>${project.entities.length}</small>
          </button>`,
      )
      .join("");
  }

  function renderHeader() {
    const project = activeProject();
    setAccent(project.accent);
    $("#header-project-name").textContent = project.name;
    $("#workspace-title").textContent = project.name;
    $("#workspace-description").textContent = project.description || "このプロジェクトの説明はまだありません。";
    $("#project-kind").textContent = project.gameType;
    $("#entity-count").textContent = `${project.entities.length}項目`;
    const bannerURL = sessionImageURLs.get(projectBannerSessionKey(project.id));
    dom.workspaceBanner.innerHTML = bannerURL
      ? `<img src="${escapeHTML(bannerURL)}" alt="" />`
      : "";
    $("#sort-label").textContent =
      {
        "updatedAt-desc": "更新順",
        "title-asc": "名称順",
        "title-desc": "名称逆順",
      }[state.settings.sort] || "更新順";
  }

  function imageMarkup(item, className = "") {
    const src = sessionImageURLs.get(item.id) || item.image;
    return src
      ? `<img class="${className}" src="${escapeHTML(src)}" alt="" data-fallback-image />`
      : "";
  }

  function addImageFallbacks(root = document) {
    $$("[data-fallback-image]", root).forEach((img) => {
      img.addEventListener(
        "error",
        () => {
          img.style.display = "none";
        },
        { once: true },
      );
    });
  }

  function renderDatabase() {
    const items = visibleEntities();
    const columns = activeProject().columns;
    dom.tableHead.innerHTML = `
      <tr>
        <th class="col-marker"><span class="sr-only">選択</span></th>
        <th data-sort="title">Name <span class="sort-indicator">↕</span></th>
        ${columns
          .map(
            (column, index) => `
              <th
                class="custom-column-header"
                data-column-id="${escapeHTML(column.id)}"
                draggable="true"
              >
                <div class="custom-column-display">
                  <span class="column-drag-handle" title="ドラッグして並べ替え">⠿</span>
                  <span class="column-heading-copy">
                    <strong>${escapeHTML(column.label)}</strong>
                    <small>${escapeHTML(columnKindLabel(column.kind))}</small>
                  </span>
                  <div class="column-header-actions">
                    <button
                      data-move-db-column="${escapeHTML(column.id)}"
                      data-move-direction="-1"
                      aria-label="${escapeHTML(column.label)}を左へ移動"
                      title="左へ移動"
                      ${index === 0 ? "disabled" : ""}
                    >←</button>
                    <button
                      data-move-db-column="${escapeHTML(column.id)}"
                      data-move-direction="1"
                      aria-label="${escapeHTML(column.label)}を右へ移動"
                      title="右へ移動"
                      ${index === columns.length - 1 ? "disabled" : ""}
                    >→</button>
                    <button
                      class="column-edit-button"
                      data-edit-db-column="${escapeHTML(column.id)}"
                      aria-label="${escapeHTML(column.label)}を編集"
                    >編集</button>
                  </div>
                </div>
              </th>`,
          )
          .join("")}
        <th class="add-column-header"><button data-add-db-column>＋ 列を追加</button></th>
        <th class="col-menu"><span class="sr-only">操作</span></th>
      </tr>`;
    dom.tableBody.innerHTML = items
      .map((item) => {
        return `
          <tr data-entity-id="${escapeHTML(item.id)}" class="${item.id === state.activeEntityId ? "is-selected" : ""}">
            <td><span class="row-marker"></span></td>
            <td>
              <div class="entity-name-cell">
                <span class="entity-thumb" style="--entity-color:${escapeHTML(activeProject().accent)}">
                  ${imageMarkup(item)}
                  <span>${escapeHTML(item.title.slice(0, 1))}</span>
                </span>
                <span class="entity-name-copy">
                  <strong>${escapeHTML(item.title)}</strong>
                </span>
              </div>
            </td>
            ${columns
              .map(
                (column) =>
                  `<td class="db-edit-cell">${dbFieldEditorMarkup(column, item)}</td>`,
              )
              .join("")}
            <td class="add-column-cell"></td>
            <td><button class="row-menu" data-edit-entity="${escapeHTML(item.id)}" aria-label="${escapeHTML(item.title)}を編集">•••</button></td>
          </tr>`;
      })
      .join("");

    dom.emptyState.classList.toggle("is-hidden", items.length > 0);
    if (!items.length) {
      const hasFilter = state.settings.query;
      dom.emptyState.innerHTML = `
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
        <strong>${hasFilter ? "一致する項目がありません" : "最初のロアを記録しましょう"}</strong>
        <p>${hasFilter ? "検索語を変えてみてください。" : "DB列を自分で定義して、項目を整理できます。"}</p>
        <button class="secondary-button" id="${hasFilter ? "empty-clear-filter" : "empty-add-entity"}">
          ${hasFilter ? "絞り込みを解除" : "項目を追加"}
        </button>`;
    }
    addImageFallbacks(dom.databaseView);
  }

  function columnKindOptions(selected) {
    return [
      ["text", "テキスト"],
      ["textarea", "複数行"],
      ["number", "数値"],
      ["date", "日付"],
      ["checkbox", "チェック"],
      ["list", "リスト項目"],
    ]
      .map(
        ([value, label]) =>
          `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`,
      )
      .join("");
  }

  function columnKindLabel(kind) {
    return {
      text: "テキスト",
      textarea: "複数行",
      number: "数値",
      date: "日付",
      checkbox: "チェック",
      list: "リスト",
    }[kind] || "テキスト";
  }

  function listOptionForValue(column, value) {
    const current = value === undefined || value === null ? "" : String(value);
    return (column.options || []).find(
      (option) => option.id === current || option.label === current,
    ) || null;
  }

  function listColumnOptionsMarkup(column, selected) {
    const current = selected === undefined || selected === null ? "" : String(selected);
    const options = Array.isArray(column.options) ? [...column.options] : [];
    const selectedOption = listOptionForValue(column, current);
    return [
      `<option value="" ${current ? "" : "selected"}>未選択</option>`,
      ...options.map(
        (option) =>
          `<option value="${escapeHTML(option.id)}" ${option.id === selectedOption?.id ? "selected" : ""}>${escapeHTML(option.label)}</option>`,
      ),
      ...(current && !selectedOption
        ? [`<option value="${escapeHTML(current)}" selected>${escapeHTML(current)}</option>`]
        : []),
    ].join("");
  }

  function dbFieldEditorMarkup(column, item) {
    const value = item.fields?.[column.id];
    if (column.kind === "checkbox") {
      return `<label class="db-checkbox">
        <input
          type="checkbox"
          data-db-field="${escapeHTML(column.id)}"
          data-db-entity="${escapeHTML(item.id)}"
          ${value === true || value === "true" || value === 1 ? "checked" : ""}
          aria-label="${escapeHTML(column.label)}"
        />
      </label>`;
    }
    if (column.kind === "list") {
      const selectedOption = listOptionForValue(column, value);
      return `<select
        class="db-cell-input db-cell-select"
        data-db-field="${escapeHTML(column.id)}"
        data-db-entity="${escapeHTML(item.id)}"
        style="--list-color:${escapeHTML(selectedOption?.color || "#777B85")}"
        aria-label="${escapeHTML(column.label)}"
      >${listColumnOptionsMarkup(column, value)}</select>`;
    }
    const type = column.kind === "number" ? "number" : column.kind === "date" ? "date" : "text";
    return `<input
      class="db-cell-input"
      type="${type}"
      data-db-field="${escapeHTML(column.id)}"
      data-db-entity="${escapeHTML(item.id)}"
      value="${escapeHTML(value ?? "")}"
      aria-label="${escapeHTML(column.label)}"
    />`;
  }

  function getAllRenderableLinks(items) {
    const ids = new Set(items.map((item) => item.id));
    const links = [];
    items.forEach((source) => {
      source.links.forEach((link) => {
        if (!ids.has(link.targetId)) return;
        const target = getEntityById(link.targetId);
        if (target) links.push({ source, target, link });
      });
    });
    return links;
  }

  function automaticAnchor(source, target) {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const angle = Math.atan2(dy, dx);
    const index = Math.round((angle / (Math.PI / 4) + 8)) % 8;
    return ["e", "se", "s", "sw", "w", "nw", "n", "ne"][index];
  }

  function oppositeAnchor(anchor) {
    return { n: "s", ne: "sw", e: "w", se: "nw", s: "n", sw: "ne", w: "e", nw: "se" }[
      anchor
    ] || "w";
  }

  function anchorPoint(item, anchor) {
    const card = $(`[data-board-id="${CSS.escape(item.id)}"]`, dom.boardCards);
    const width = Number(card?.offsetWidth) || 188;
    const height = Number(card?.offsetHeight) || (item.imageId || item.image ? 180 : 108);
    const points = {
      nw: [0, 0],
      n: [width / 2, 0],
      ne: [width, 0],
      e: [width, height / 2],
      se: [width, height],
      s: [width / 2, height],
      sw: [0, height],
      w: [0, height / 2],
    };
    const [x, y] = points[anchor] || points.e;
    return { x: item.x + x, y: item.y + y };
  }

  function anchorVector(anchor) {
    const diagonal = Math.SQRT1_2;
    return {
      n: [0, -1],
      ne: [diagonal, -diagonal],
      e: [1, 0],
      se: [diagonal, diagonal],
      s: [0, 1],
      sw: [-diagonal, diagonal],
      w: [-1, 0],
      nw: [-diagonal, -diagonal],
    }[anchor] || [1, 0];
  }

  function renderRelationLines(items) {
    const links = getAllRenderableLinks(items);
    dom.relationLines.setAttribute("viewBox", `0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`);
    dom.relationLines.innerHTML = `
      <defs>
        <marker id="relation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z"></path>
        </marker>
      </defs>
      ${links
      .map(({ source, target, link }) => {
        const sourceAnchor = link.sourceAnchor || automaticAnchor(source, target);
        const targetAnchor = link.targetAnchor || oppositeAnchor(sourceAnchor);
        const start = anchorPoint(source, sourceAnchor);
        const end = anchorPoint(target, targetAnchor);
        const startVector = anchorVector(sourceAnchor);
        const endVector = anchorVector(targetAnchor);
        const distance = Math.max(55, Math.min(130, Math.hypot(end.x - start.x, end.y - start.y) * 0.32));
        const c1x = start.x + startVector[0] * distance;
        const c1y = start.y + startVector[1] * distance;
        const c2x = end.x + endVector[0] * distance;
        const c2y = end.y + endVector[1] * distance;
        const sx = start.x;
        const sy = start.y;
        const tx = end.x;
        const ty = end.y;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        const combinedLabel = link.action
          ? `${link.label || "関連"}：${link.action}`
          : link.label || "関連";
        const safeLabel = combinedLabel.slice(0, 28);
        const labelWidth = Math.max(42, safeLabel.length * 9 + 12);
        const markerStart = ["start", "both"].includes(link.arrow)
          ? 'marker-start="url(#relation-arrow)"'
          : "";
        const markerEnd = ["end", "both"].includes(link.arrow)
          ? 'marker-end="url(#relation-arrow)"'
          : "";
        return `
          <g data-relation-source="${escapeHTML(source.id)}" data-relation-target="${escapeHTML(target.id)}">
            <title>${escapeHTML(combinedLabel)}</title>
            <path class="relation-line-hit" d="M${sx} ${sy} C${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}" />
            <path class="relation-line" d="M${sx} ${sy} C${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}" ${markerStart} ${markerEnd} />
            <rect class="relation-label-bg" x="${mx - labelWidth / 2}" y="${my - 10}" width="${labelWidth}" height="18" rx="4" />
            <text class="relation-label-text" x="${mx}" y="${my + 2}" text-anchor="middle">${escapeHTML(safeLabel)}</text>
          </g>`;
      })
      .join("")}`;
  }

  function connectorHandlesMarkup(item) {
    return ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
      .map(
        (anchor) =>
          `<button
            class="connector-handle is-${anchor}"
            data-connector-handle="${anchor}"
            data-connector-source="${escapeHTML(item.id)}"
            aria-label="${escapeHTML(item.title)}から関連線を作成"
          ></button>`,
      )
      .join("");
  }

  function groupResizeHandlesMarkup(item) {
    return ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
      .map(
        (anchor) =>
          `<button
            class="group-resize-handle is-${anchor}"
            data-group-resize="${anchor}"
            data-group-id="${escapeHTML(item.id)}"
            aria-label="${escapeHTML(item.title)}の${anchor}方向をリサイズ"
          ></button>`,
      )
      .join("");
  }

  function groupDescendantIds(groupId) {
    const descendants = new Set();
    let found = true;
    while (found) {
      found = false;
      activeProject().entities.forEach((item) => {
        if (
          item.id !== groupId &&
          !descendants.has(item.id) &&
          (item.parentGroupId === groupId || descendants.has(item.parentGroupId))
        ) {
          descendants.add(item.id);
          found = true;
        }
      });
    }
    return descendants;
  }

  function groupDepth(item) {
    let depth = 0;
    let parentId = item.parentGroupId;
    const visited = new Set([item.id]);
    while (parentId && depth < 20 && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = getEntityById(parentId);
      if (!parent?.organisation) break;
      depth += 1;
      parentId = parent.parentGroupId;
    }
    return depth;
  }

  function organisationGroupMarkup(item) {
    const memberCount = activeProject().entities.filter(
      (candidate) => candidate.parentGroupId === item.id,
    ).length;
    return `
      <section
        class="board-group ${item.id === state.activeEntityId ? "is-selected" : ""}"
        data-board-id="${escapeHTML(item.id)}"
        data-organisation-group
        style="
          left:${item.x}px;
          top:${item.y}px;
          width:${item.groupWidth}px;
          height:${item.groupHeight}px;
          --group-color:${escapeHTML(item.groupColor)};
          --entity-color:${escapeHTML(activeProject().accent)};
          --group-depth:${groupDepth(item)};
        "
      >
        <header class="board-group-header">
          <span class="board-group-kicker">ORGANISATION</span>
          <strong>${escapeHTML(item.title)}</strong>
          <span class="board-group-count">${memberCount}項目</span>
        </header>
        <div class="board-group-drop-hint">項目をここへドラッグして内包</div>
        <button
          class="connector-handle is-e group-relation-connector"
          data-connector-handle="e"
          data-connector-source="${escapeHTML(item.id)}"
          aria-label="${escapeHTML(item.title)}から関連線を作成"
          title="関連線を作成"
        ></button>
        ${groupResizeHandlesMarkup(item)}
      </section>`;
  }

  function renderBoard() {
    const items = visibleEntities();
    const groups = items
      .filter((item) => item.organisation)
      .sort((a, b) => groupDepth(a) - groupDepth(b));
    const cards = items.filter((item) => !item.organisation);
    dom.boardCards.innerHTML =
      groups.map((item) => organisationGroupMarkup(item)).join("") +
      cards
      .map((item) => {
        return `
          <article class="board-card ${item.id === state.activeEntityId ? "is-selected" : ""}"
            data-board-id="${escapeHTML(item.id)}"
            style="left:${item.x}px;top:${item.y}px;--entity-color:${escapeHTML(activeProject().accent)}">
            ${imageMarkup(item, "board-card-image")}
            <div class="board-card-body">
              <h3>${escapeHTML(item.title)}</h3>
            </div>
            ${connectorHandlesMarkup(item)}
          </article>`;
      })
      .join("");
    renderRelationLines(items);
    const zoom = Math.min(1.4, Math.max(0.6, Number(state.settings.boardZoom) || 1));
    dom.boardCanvas.style.zoom = zoom;
    $("#zoom-label").textContent = `${Math.round(zoom * 100)}%`;
    addImageFallbacks(dom.boardView);
  }

  function organisationPaletteMarkup(item) {
    return `
      <div class="organisation-color-palette" role="group" aria-label="グループ背景色">
        ${COLOR_PALETTE.map(
          (color) => `
            <button
              type="button"
              class="organisation-color-swatch ${item.groupColor === color ? "is-selected" : ""}"
              data-organisation-color="${color}"
              style="--organisation-color:${color}"
              aria-label="${color}の透過背景を選択"
              title="${color}"
            ></button>`,
        ).join("")}
      </div>`;
  }

  function renderInspector() {
    const item = activeEntity();
    dom.app.classList.toggle("inspector-open", Boolean(item));
    if (!item) {
      dom.inspectorContent.innerHTML = "";
      return;
    }
    dom.inspectorContent.innerHTML = `
      <div
        class="inspector-cover"
        data-inspector-image-drop
        style="--entity-color:${escapeHTML(activeProject().accent)}"
      >
        ${imageMarkup(item)}
        <span class="inspector-cover-letter">${escapeHTML(item.title.slice(0, 1))}</span>
        <div class="inspector-cover-actions">
          <label class="inspector-cover-action">
            <input class="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" data-inspector-image-file />
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V4m0 0L8 8m4-4 4 4M5 15v5h14v-5"></path>
            </svg>
            <span>${item.imageId || item.image ? "画像を編集" : "画像を追加"}</span>
          </label>
          ${item.imageId || item.image
            ? `<button class="inspector-cover-action is-danger" data-remove-inspector-image="${escapeHTML(item.id)}">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"></path>
                </svg>
                <span>画像を削除</span>
              </button>`
            : ""}
        </div>
        <button class="inspector-close" data-close-inspector aria-label="詳細を閉じる">
          <svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"></path></svg>
        </button>
      </div>
      <div class="inspector-body" style="--entity-color:${escapeHTML(activeProject().accent)}">
        <label class="inspector-field">
          <span>名称</span>
          <input data-inspector-field="title" value="${escapeHTML(item.title)}" maxlength="80" />
        </label>
        <section class="inspector-section organisation-settings">
          <label class="inspector-check organisation-toggle">
            <input type="checkbox" data-inspector-organisation ${item.organisation ? "checked" : ""} />
            <span>
              <strong>Organisation</strong>
              <small>フリーボードで項目を内包するグループとして扱う</small>
            </span>
          </label>
          ${
            item.organisation
              ? `<div class="organisation-color-setting">
                  <span>グループ背景（透過）</span>
                  ${organisationPaletteMarkup(item)}
                </div>`
              : ""
          }
        </section>
        <section class="inspector-section">
          <h3>本文</h3>
          <textarea class="inspector-body-editor" data-inspector-field="body" rows="10" placeholder="本文を入力">${escapeHTML(item.body)}</textarea>
        </section>
        ${activeProject().columns.length
          ? `<section class="inspector-section">
              <h3>データベース列</h3>
              <div class="inspector-custom-fields">
                ${activeProject().columns
                  .map((column) => inspectorFieldMarkup(column, item.fields?.[column.id]))
                  .join("")}
              </div>
            </section>`
          : ""}
      </div>`;
    addImageFallbacks(dom.inspector);
  }

  function inspectorFieldMarkup(column, value) {
    const safeValue = value === undefined || value === null ? "" : value;
    if (column.kind === "checkbox") {
      return `<label class="inspector-check">
        <input type="checkbox" data-inspector-custom="${escapeHTML(column.id)}" ${safeValue ? "checked" : ""} />
        <span>${escapeHTML(column.label)}</span>
      </label>`;
    }
    if (column.kind === "textarea") {
      return `<label class="inspector-field">
        <span>${escapeHTML(column.label)}</span>
        <textarea rows="3" data-inspector-custom="${escapeHTML(column.id)}">${escapeHTML(safeValue)}</textarea>
      </label>`;
    }
    if (column.kind === "list") {
      const selectedOption = listOptionForValue(column, safeValue);
      return `<label class="inspector-field">
        <span>${escapeHTML(column.label)}</span>
        <select
          class="inspector-list-badge"
          data-inspector-custom="${escapeHTML(column.id)}"
          style="--list-color:${escapeHTML(selectedOption?.color || "#777B85")}"
        >
          ${listColumnOptionsMarkup(column, safeValue)}
        </select>
      </label>`;
    }
    const type = column.kind === "number" ? "number" : column.kind === "date" ? "date" : "text";
    return `<label class="inspector-field">
      <span>${escapeHTML(column.label)}</span>
      <input type="${type}" data-inspector-custom="${escapeHTML(column.id)}" value="${escapeHTML(safeValue)}" />
    </label>`;
  }

  function renderViewState() {
    const database = state.settings.view === "database";
    dom.databaseView.classList.toggle("is-hidden", !database);
    dom.boardView.classList.toggle("is-hidden", database);
    $("#board-zoom-controls").classList.toggle("is-hidden", database);
    $$(".view-button").forEach((button) =>
      button.classList.toggle("is-active", button.dataset.view === state.settings.view),
    );
    $("#mode-chip").textContent = database ? "NORMAL" : "BOARD";
  }

  function renderFilters() {
    dom.search.value = state.settings.query || "";
  }

  function renderAll() {
    const project = activeProject();
    if (!project) return;
    if (
      state.activeEntityId &&
      !project.entities.some((item) => item.id === state.activeEntityId)
    ) {
      state.activeEntityId = null;
    }
    renderHeader();
    renderProjects();
    renderFilters();
    renderViewState();
    renderDatabase();
    renderBoard();
    renderInspector();
    dom.app.classList.toggle("sidebar-collapsed", Boolean(state.settings.sidebarCollapsed));
    document.documentElement.classList.toggle("dark", state.settings.theme === "dark");
    void hydrateActiveProjectImages(project.id);
  }

  function selectEntity(id, { focus = false } = {}) {
    state.activeEntityId = id;
    renderDatabase();
    renderBoard();
    renderInspector();
    markChanged("項目を選択");
    if (focus) focusInspectorTitle();
  }

  function focusInspectorTitle() {
    window.setTimeout(() => {
      const input = $('[data-inspector-field="title"]', dom.inspectorContent);
      input?.focus();
      input?.select();
    }, 30);
  }

  function createEntityInInspector() {
    const project = activeProject();
    const timestamp = now();
    const created = entity({
      title: "名称未設定",
      x: 150 + (project.entities.length % 5) * 230,
      y: 110 + (project.entities.length % 4) * 175,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    project.entities.push(created);
    updateEntityGroupMembership(created);
    project.updatedAt = timestamp;
    state.activeEntityId = created.id;
    renderAll();
    markChanged("新しい項目を追加しました");
    focusInspectorTitle();
  }

  function closeInspector() {
    state.activeEntityId = null;
    renderDatabase();
    renderBoard();
    renderInspector();
    markChanged("詳細を閉じました");
  }

  function switchProject(id) {
    if (!state.projects.some((project) => project.id === id)) return;
    state.activeProjectId = id;
    state.activeEntityId = null;
    state.settings.query = "";
    closeMobileSidebar();
    renderAll();
    markChanged("プロジェクトを切り替えました");
  }

  function setView(view) {
    if (!["database", "board"].includes(view)) return;
    state.settings.view = view;
    renderHeader();
    renderViewState();
    if (view === "board") renderBoard();
    markChanged(view === "database" ? "データベース表示" : "ボード表示");
  }

  function clearFilters() {
    state.settings.query = "";
    renderAll();
    markChanged("絞り込みを解除しました");
  }

  function updateProjectTimestamp() {
    activeProject().updatedAt = now();
  }

  function addDatabaseColumn() {
    openDatabaseColumnModal();
  }

  function listOptionEditorRowMarkup(option = {}) {
    const id = option.id || uid("opt");
    const color = normalizePaletteColor(option.color || COLOR_PALETTE[20]);
    return `
      <div class="column-list-option-row" data-list-option-row data-option-id="${escapeHTML(id)}" style="--list-color:${color}">
        <span class="list-option-badge-preview" style="--list-color:${color}"></span>
        <input
          class="list-option-name"
          value="${escapeHTML(option.label || "")}"
          maxlength="40"
          placeholder="候補名"
          aria-label="リスト候補名"
        />
        <details class="list-option-color-picker">
          <summary style="--list-color:${color}" title="バッジカラーを選択"></summary>
          <div class="list-option-color-palette">
            ${COLOR_PALETTE.map(
              (paletteColor) => `
                <button
                  type="button"
                  data-list-option-color="${paletteColor}"
                  style="--swatch-color:${paletteColor}"
                  aria-label="${paletteColor}を選択"
                ></button>`,
            ).join("")}
          </div>
        </details>
        <input class="list-option-color-value" type="hidden" value="${color}" />
        <button type="button" class="list-option-remove" data-remove-list-option aria-label="候補を削除">×</button>
      </div>`;
  }

  function addListOptionEditorRow(option = {}) {
    $("#column-list-options").insertAdjacentHTML("beforeend", listOptionEditorRowMarkup(option));
    const row = $("#column-list-options").lastElementChild;
    $(".list-option-name", row)?.focus();
  }

  function updateColumnListSettingsVisibility() {
    $("#column-list-settings").classList.toggle("is-hidden", $("#column-kind").value !== "list");
  }

  function openDatabaseColumnModal(id = null) {
    const column = id
      ? activeProject().columns.find((candidate) => candidate.id === id)
      : null;
    $("#column-id").value = column?.id || "";
    $("#column-name").value = column?.label || "";
    $("#column-kind").innerHTML = columnKindOptions(column?.kind || "text");
    $("#column-list-options").innerHTML = (column?.options || [])
      .map((option) => listOptionEditorRowMarkup(option))
      .join("");
    $("#column-modal-title").textContent = column ? "列を編集" : "列を追加";
    $("#delete-column-button").classList.toggle("is-hidden", !column);
    updateColumnListSettingsVisibility();
    dom.columnModal.classList.remove("is-hidden");
    window.setTimeout(() => $("#column-name").focus(), 30);
  }

  function closeDatabaseColumnModal() {
    dom.columnModal.classList.add("is-hidden");
  }

  function submitDatabaseColumn(event) {
    event.preventDefault();
    const project = activeProject();
    const id = $("#column-id").value;
    const existing = id
      ? project.columns.find((candidate) => candidate.id === id)
      : null;
    const label = $("#column-name").value.trim();
    if (!label) return;
    const kind = $("#column-kind").value;
    const options = normalizeListOptions(
      $$(".column-list-option-row", $("#column-list-options")).map((row) => ({
        id: row.dataset.optionId,
        label: $(".list-option-name", row).value,
        color: $(".list-option-color-value", row).value,
      })),
    );
    const column = existing || {
      id: uid("field"),
      label,
      kind,
      options: [],
    };
    const previousKind = column.kind;
    const previousOptions = [...(column.options || [])];
    Object.assign(column, { label, kind, options });
    if (!existing) project.columns.push(column);

    project.entities.forEach((item) => {
      const current = item.fields[column.id];
      if (kind === "checkbox") {
        item.fields[column.id] = current === true || current === "true" || current === 1;
      } else if (kind === "list") {
        const previousOption = previousOptions.find(
          (option) => option.id === current || option.label === String(current ?? ""),
        );
        const match = options.find(
          (option) =>
            option.id === current ||
            option.label === String(current ?? "") ||
            option.label === previousOption?.label,
        );
        item.fields[column.id] = match?.id || "";
      } else if (previousKind === "list") {
        const previousOption = previousOptions.find((option) => option.id === current);
        item.fields[column.id] = previousOption?.label || "";
      }
    });
    updateProjectTimestamp();
    closeDatabaseColumnModal();
    renderAll();
    markChanged(existing ? "DB列を更新しました" : "DB列を追加しました");
    toast(existing ? `列「${label}」を更新しました。` : `列「${label}」を追加しました。`);
  }

  function moveDatabaseColumn(id, direction) {
    const columns = activeProject().columns;
    const index = columns.findIndex((column) => column.id === id);
    const nextIndex = Math.max(0, Math.min(columns.length - 1, index + direction));
    if (index < 0 || index === nextIndex) return;
    const [column] = columns.splice(index, 1);
    columns.splice(nextIndex, 0, column);
    updateProjectTimestamp();
    renderDatabase();
    renderInspector();
    markChanged("DB列を並べ替えました");
  }

  function reorderDatabaseColumn(sourceId, targetId, placeAfter = false) {
    const columns = activeProject().columns;
    const sourceIndex = columns.findIndex((column) => column.id === sourceId);
    const targetIndex = columns.findIndex((column) => column.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const [column] = columns.splice(sourceIndex, 1);
    let insertionIndex = columns.findIndex((candidate) => candidate.id === targetId);
    if (placeAfter) insertionIndex += 1;
    columns.splice(insertionIndex, 0, column);
    updateProjectTimestamp();
    renderDatabase();
    renderInspector();
    markChanged("DB列を並べ替えました");
  }

  function deleteDatabaseColumn(id) {
    const project = activeProject();
    const column = project.columns.find((candidate) => candidate.id === id);
    if (!column) return false;
    if (!window.confirm(`列「${column.label || "名称未設定"}」を削除しますか？\nこの列に入力した値も削除されます。`)) return false;
    project.columns = project.columns.filter((candidate) => candidate.id !== id);
    project.entities.forEach((item) => {
      delete item.fields[id];
    });
    updateProjectTimestamp();
    closeDatabaseColumnModal();
    renderAll();
    markChanged("DB列を削除しました");
    toast(`列「${column.label || "名称未設定"}」を削除しました。`, "−");
    return true;
  }

  function updateDatabaseCell(target) {
    const item = getEntityById(target.dataset.dbEntity);
    const column = activeProject().columns.find(
      (candidate) => candidate.id === target.dataset.dbField,
    );
    if (!item || !column) return;
    item.fields[column.id] = target.type === "checkbox" ? target.checked : target.value;
    if (column.kind === "list") {
      const option = listOptionForValue(column, target.value);
      target.style.setProperty("--list-color", option?.color || "#777B85");
    }
    item.updatedAt = now();
    updateProjectTimestamp();
    renderBoard();
    if (state.activeEntityId === item.id) renderInspector();
    markChanged("セルの変更を保存しました");
  }

  function openEntityModal(id = null) {
    const item = id ? getEntityById(id) : null;
    $("#entity-id").value = item?.id || "";
    $("#entity-title").value = item?.title || "";
    $("#custom-fields-form").innerHTML = activeProject().columns
      .map((column) => customFieldFormMarkup(column, item?.fields?.[column.id]))
      .join("");
    dom.bodyEditor.value = item?.body || "";
    dom.imagePath.value = item?.image || "";
    $("#relation-label").value = "";
    $("#entity-modal-kicker").textContent = item ? "項目を編集" : "新しい項目";
    $("#entity-modal-title").textContent = item ? item.title : "ロアを追加";
    $("#delete-entity-button").classList.toggle("is-hidden", !item);

    const linked = new Set(item?.links.map((link) => link.targetId) || []);
    const relationCandidates = activeProject().entities.filter((candidate) => candidate.id !== item?.id);
    $("#relation-picker").innerHTML = relationCandidates.length
      ? relationCandidates
          .map(
            (candidate) => `
              <label class="relation-option">
                <input type="checkbox" value="${escapeHTML(candidate.id)}" ${linked.has(candidate.id) ? "checked" : ""} />
                <span>${escapeHTML(candidate.title)}</span>
              </label>`,
          )
          .join("")
      : '<span class="relation-empty">先に別の項目を作成してください。</span>';

    setImagePreview(item?.id || null, item?.image || "");
    vim.reset();
    updateEditorGutter();
    dom.entityModal.classList.remove("is-hidden");
    window.setTimeout(() => $("#entity-title").focus(), 30);
  }

  function customFieldFormMarkup(column, value) {
    const safeValue = value === undefined || value === null ? "" : value;
    if (column.kind === "checkbox") {
      return `<label class="field custom-checkbox-field">
        <span>${escapeHTML(column.label)}</span>
        <input type="checkbox" data-custom-field="${escapeHTML(column.id)}" ${safeValue ? "checked" : ""} />
      </label>`;
    }
    if (column.kind === "textarea") {
      return `<label class="field">
        <span>${escapeHTML(column.label)}</span>
        <textarea rows="3" data-custom-field="${escapeHTML(column.id)}">${escapeHTML(safeValue)}</textarea>
      </label>`;
    }
    if (column.kind === "list") {
      const selectedOption = listOptionForValue(column, safeValue);
      return `<label class="field">
        <span>${escapeHTML(column.label)}</span>
        <select
          class="inspector-list-badge"
          data-custom-field="${escapeHTML(column.id)}"
          style="--list-color:${escapeHTML(selectedOption?.color || "#777B85")}"
        >
          ${listColumnOptionsMarkup(column, safeValue)}
        </select>
      </label>`;
    }
    const type = column.kind === "number" ? "number" : column.kind === "date" ? "date" : "text";
    return `<label class="field">
      <span>${escapeHTML(column.label)}</span>
      <input type="${type}" data-custom-field="${escapeHTML(column.id)}" value="${escapeHTML(safeValue)}" />
    </label>`;
  }

  function closeEntityModal() {
    dom.entityModal.classList.add("is-hidden");
    vim.reset();
  }

  function setImagePreview(entityId, path) {
    const sessionURL = entityId ? sessionImageURLs.get(entityId) : null;
    const src = sessionURL || path;
    dom.imagePreview.innerHTML = src
      ? `<img src="${escapeHTML(src)}" alt="画像プレビュー" />`
      : `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="m4 17 5-4 3 3 3-2 5 4"></path></svg>`;
    const img = $("img", dom.imagePreview);
    img?.addEventListener("error", () => {
      dom.imagePreview.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M4 4l16 16M5 18l4-5 3 3 2-1M3 4h18v16H3z"></path></svg>';
    });
  }

  function handleImageFile(file) {
    void handleInspectorImageFile(file);
  }

  function submitEntity(event) {
    event.preventDefault();
    const id = $("#entity-id").value;
    const existing = id ? getEntityById(id) : null;
    const title = $("#entity-title").value.trim();
    if (!title) return;
    const selectedLinks = $$('#relation-picker input[type="checkbox"]:checked').map(
      (input) => input.value,
    );
    const relationLabel = $("#relation-label").value.trim();
    const oldLinks = new Map((existing?.links || []).map((link) => [link.targetId, link]));
    const timestamp = now();
    const data = {
      id: existing?.id || uid("ent"),
      title,
      body: dom.bodyEditor.value,
      fields: Object.fromEntries(
        $$("[data-custom-field]", dom.entityForm).map((input) => [
          input.dataset.customField,
          input.type === "checkbox" ? input.checked : input.value,
        ]),
      ),
      image: dom.imagePath.value.trim().replace(/^\/+/, ""),
      links: selectedLinks.map((targetId) => {
        const oldLink = oldLinks.get(targetId);
        return {
          targetId,
          label: relationLabel || oldLink?.label || "関連",
          action: oldLink?.action || "",
          arrow: oldLink?.arrow || "end",
          sourceAnchor: oldLink?.sourceAnchor || "",
          targetAnchor: oldLink?.targetAnchor || "",
        };
      }),
      x: existing?.x ?? 150 + (activeProject().entities.length % 5) * 230,
      y: existing?.y ?? 110 + (activeProject().entities.length % 4) * 175,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
    };

    if (existing) {
      Object.assign(existing, data);
      const sessionURL = sessionImageURLs.get(existing.id);
      if (!sessionURL && sessionImageURLs.has("__new__")) {
        sessionImageURLs.set(existing.id, sessionImageURLs.get("__new__"));
        sessionImageURLs.delete("__new__");
      }
    } else {
      const created = entity(data);
      activeProject().entities.push(created);
      const tempURL = sessionImageURLs.get("__new__");
      if (tempURL) {
        sessionImageURLs.set(created.id, tempURL);
        sessionImageURLs.delete("__new__");
      }
      state.activeEntityId = created.id;
    }

    updateProjectTimestamp();
    closeEntityModal();
    renderAll();
    markChanged("項目を保存しました");
    toast(existing ? "変更を保存しました。" : "新しい項目を追加しました。");
  }

  function deleteCurrentEntity() {
    const id = $("#entity-id").value;
    const item = getEntityById(id);
    if (!item) return;
    if (!window.confirm(`「${item.title}」を削除しますか？\nこの操作は JSON バックアップからのみ復元できます。`)) return;
    const project = activeProject();
    project.entities = project.entities.filter((candidate) => candidate.id !== id);
    project.entities.forEach((candidate) => {
      candidate.links = candidate.links.filter((link) => link.targetId !== id);
      if (candidate.parentGroupId === id) candidate.parentGroupId = "";
    });
    const url = sessionImageURLs.get(id);
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    sessionImageURLs.delete(id);
    missingImageIds.delete(id);
    if (item.imageId) {
      void deleteStoredImage(item.imageId).catch((error) =>
        console.warn("LoreGrid: image could not be deleted.", error),
      );
    }
    state.activeEntityId = null;
    updateProjectTimestamp();
    closeEntityModal();
    renderAll();
    markChanged("項目を削除しました");
    toast(`「${item.title}」を削除しました。`, "−");
  }

  async function duplicateEntity(id) {
    const original = getEntityById(id);
    if (!original) return;
    const newId = uid("ent");
    const copy = entity({
      ...original,
      id: newId,
      title: `${original.title}（複製）`,
      x: Math.min(BOARD_WIDTH - 220, original.x + 35),
      y: Math.min(BOARD_HEIGHT - 150, original.y + 35),
      createdAt: now(),
      updatedAt: now(),
      links: original.links.map((link) => ({ ...link })),
      fields: { ...original.fields },
      imageId: "",
    });
    activeProject().entities.push(copy);
    updateEntityGroupMembership(copy);
    state.activeEntityId = copy.id;
    updateProjectTimestamp();
    renderAll();
    markChanged("項目を複製しました");
    toast("項目を複製しました。");
    if (original.imageId) {
      try {
        const record = await getStoredImage(original.imageId);
        if (record?.blob) {
          const copiedImageId = uid("img");
          await putStoredImage(copiedImageId, record.blob, record.name);
          copy.imageId = copiedImageId;
          copy.imageName = record.name || original.imageName;
          setSessionImageURL(copy.id, record.blob);
          renderAll();
          markChanged("画像を含めて項目を複製しました");
        }
      } catch (error) {
        console.warn("LoreGrid: duplicated image could not be copied.", error);
        toast("項目は複製しましたが、画像をコピーできませんでした。", "!");
      }
    }
  }

  function clearPendingProjectBanner() {
    if (pendingProjectBannerURL?.startsWith("blob:")) URL.revokeObjectURL(pendingProjectBannerURL);
    pendingProjectBannerFile = null;
    pendingProjectBannerURL = "";
    projectBannerRemovalRequested = false;
  }

  function setProjectBannerPreview(src = "", name = "") {
    dom.projectBannerPreview.innerHTML = src
      ? `<img src="${escapeHTML(src)}" alt="${escapeHTML(name || "バナープレビュー")}" />`
      : `<svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2"></rect>
          <circle cx="9" cy="10" r="2"></circle>
          <path d="m4 17 5-4 3 3 3-2 5 4"></path>
        </svg>`;
  }

  async function renderProjectBannerEditor(project) {
    const sessionKey = project ? projectBannerSessionKey(project.id) : "";
    const sessionURL = sessionKey ? sessionImageURLs.get(sessionKey) : "";
    setProjectBannerPreview(sessionURL || "", project?.bannerImageName || "");
    $("#remove-project-banner").classList.toggle(
      "is-hidden",
      !project?.bannerImageId && !pendingProjectBannerFile,
    );
    if (!project?.bannerImageId || sessionURL || !imageStorageSupported()) return;
    try {
      const record = await getStoredImage(project.bannerImageId);
      if (
        !record?.blob ||
        $("#project-id").value !== project.id ||
        pendingProjectBannerFile ||
        projectBannerRemovalRequested
      ) {
        return;
      }
      setSessionImageURL(sessionKey, record.blob);
      setProjectBannerPreview(sessionImageURLs.get(sessionKey), record.name);
    } catch (error) {
      console.warn("LoreGrid: project banner preview could not be loaded.", error);
    }
  }

  function handleProjectBannerFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      toast("画像ファイルを選択してください。", "!");
      return;
    }
    if (pendingProjectBannerURL?.startsWith("blob:")) URL.revokeObjectURL(pendingProjectBannerURL);
    pendingProjectBannerFile = file;
    pendingProjectBannerURL = URL.createObjectURL(file);
    projectBannerRemovalRequested = false;
    setProjectBannerPreview(pendingProjectBannerURL, file.name);
    $("#remove-project-banner").classList.remove("is-hidden");
  }

  async function applyProjectBannerFromWorkspace(file) {
    if (!file || !file.type.startsWith("image/")) {
      toast("画像ファイルをドロップしてください。", "!");
      return;
    }
    const project = activeProject();
    if (!project) return;
    try {
      const imageId = project.bannerImageId || uid("img");
      await putStoredImage(imageId, file);
      project.bannerImageId = imageId;
      project.bannerImageName = file.name;
      project.updatedAt = now();
      setSessionImageURL(projectBannerSessionKey(project.id), file);
      if (project.id === state.activeProjectId) renderHeader();
      markChanged("プロジェクト画像を保存しました");
      toast(`「${project.name}」のプロジェクト画像を設定しました。`);
    } catch (error) {
      toast(`プロジェクト画像を保存できませんでした: ${error.message}`, "!");
    }
  }

  function removePendingProjectBanner() {
    if (pendingProjectBannerURL?.startsWith("blob:")) URL.revokeObjectURL(pendingProjectBannerURL);
    pendingProjectBannerFile = null;
    pendingProjectBannerURL = "";
    projectBannerRemovalRequested = true;
    setProjectBannerPreview();
    $("#remove-project-banner").classList.add("is-hidden");
  }

  function openProjectModal(id = null) {
    const project = id ? state.projects.find((candidate) => candidate.id === id) : null;
    clearPendingProjectBanner();
    $("#project-id").value = project?.id || "";
    $("#project-name").value = project?.name || "";
    $("#project-game-type").value = project?.gameType || "RPG";
    $("#project-accent").value = project?.accent || "#d06347";
    $("#project-description").value = project?.description || "";
    void renderProjectBannerEditor(project);
    $("#project-modal-title").textContent = project ? "プロジェクトを編集" : "プロジェクトを作成";
    dom.projectModal.classList.remove("is-hidden");
    window.setTimeout(() => $("#project-name").focus(), 30);
  }

  function closeProjectModal() {
    dom.projectModal.classList.add("is-hidden");
    clearPendingProjectBanner();
  }

  async function submitProject(event) {
    event.preventDefault();
    const id = $("#project-id").value;
    const existing = id ? state.projects.find((project) => project.id === id) : null;
    const timestamp = now();
    const data = {
      name: $("#project-name").value.trim(),
      gameType: $("#project-game-type").value,
      accent: $("#project-accent").value,
      description: $("#project-description").value.trim(),
      columns: existing?.columns || [],
      updatedAt: timestamp,
    };
    let savedProject;
    if (existing) {
      Object.assign(existing, data);
      savedProject = existing;
    } else {
      const project = {
        id: uid("project"),
        ...data,
        bannerImageId: "",
        bannerImageName: "",
        createdAt: timestamp,
        entities: [],
      };
      state.projects.push(project);
      savedProject = project;
      state.activeProjectId = project.id;
      state.activeEntityId = null;
    }
    try {
      const sessionKey = projectBannerSessionKey(savedProject.id);
      if (projectBannerRemovalRequested && savedProject.bannerImageId) {
        await deleteStoredImage(savedProject.bannerImageId);
        const currentURL = sessionImageURLs.get(sessionKey);
        if (currentURL?.startsWith("blob:")) URL.revokeObjectURL(currentURL);
        sessionImageURLs.delete(sessionKey);
        missingImageIds.delete(sessionKey);
        savedProject.bannerImageId = "";
        savedProject.bannerImageName = "";
      }
      if (pendingProjectBannerFile) {
        const imageId = savedProject.bannerImageId || uid("img");
        await putStoredImage(imageId, pendingProjectBannerFile);
        savedProject.bannerImageId = imageId;
        savedProject.bannerImageName = pendingProjectBannerFile.name;
        setSessionImageURL(sessionKey, pendingProjectBannerFile);
      }
    } catch (error) {
      toast(`バナー画像を保存できませんでした: ${error.message}`, "!");
    }
    closeProjectModal();
    renderAll();
    markChanged("プロジェクトを保存しました");
    toast(existing ? "プロジェクトを更新しました。" : "新しいプロジェクトを作成しました。");
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("画像を変換できませんでした。"));
      reader.readAsDataURL(blob);
    });
  }

  function dataURLToBlob(dataURL) {
    const [header, encoded] = String(dataURL).split(",");
    const type = header.match(/^data:([^;]+);base64$/)?.[1] || "application/octet-stream";
    const binary = atob(encoded || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type });
  }

  async function exportJSON() {
    try {
      saveImmediately();
      const referencedImageIds = new Set(
        state.projects.flatMap((project) => [
          project.bannerImageId,
          ...project.entities.map((item) => item.imageId),
        ]).filter(Boolean),
      );
      const storedImages = imageStorageSupported()
        ? (await getAllStoredImages()).filter((record) => referencedImageIds.has(record.entityId))
        : [];
      const assets = await Promise.all(
        storedImages.map(async (record) => ({
          entityId: record.entityId,
          name: record.name,
          type: record.type,
          data: await blobToDataURL(record.blob),
        })),
      );
      const payload = {
        ...state,
        assets,
        exportedAt: now(),
        application: "LoreGrid",
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `loregrid-${stamp}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast(`JSON バックアップを書き出しました。画像 ${assets.length}件を含みます。`);
    } catch (error) {
      toast(`書き出しに失敗しました: ${error.message}`, "!");
    }
  }

  async function importJSON(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const normalized = normalizeState(parsed);
      if (
        !window.confirm(
          `${normalized.projects.length}件のプロジェクトを読み込みます。\n現在のデータは置き換えられます。先に書き出しておくことをおすすめします。`,
        )
      ) {
        return;
      }
      const assets = Array.isArray(parsed.assets)
        ? parsed.assets
            .filter((asset) => asset?.entityId && asset?.data)
            .map((asset) => ({
              entityId: asset.entityId,
              blob: dataURLToBlob(asset.data),
              name: asset.name || "image",
              type: asset.type || "application/octet-stream",
              updatedAt: now(),
            }))
        : [];
      await replaceStoredImages(assets);
      sessionImageURLs.forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      sessionImageURLs.clear();
      imageLoadPending.clear();
      missingImageIds.clear();
      state = normalized;
      saveImmediately();
      renderAll();
      toast(`JSON バックアップを読み込みました。画像 ${assets.length}件を復元しました。`);
    } catch (error) {
      toast(`読み込みに失敗しました: ${error.message}`, "!");
    } finally {
      $("#import-file").value = "";
    }
  }

  const COMMANDS = [
    { id: "new-entity", title: "新しい項目を追加", subtitle: "右側の詳細パネルで編集", key: "N", icon: "＋", action: createEntityInInspector },
    { id: "new-project", title: "新しいプロジェクト", subtitle: "別のゲームを管理", icon: "P", action: () => openProjectModal() },
    { id: "database", title: "データベース表示", subtitle: "一覧で比較・整理", key: "D", icon: "≡", action: () => setView("database") },
    { id: "board", title: "フリーボード表示", subtitle: "関係を空間で把握", key: "B", icon: "▦", action: () => setView("board") },
    { id: "theme", title: "テーマを切り替える", subtitle: "ライト / ダーク", icon: "◐", action: () => toggleTheme() },
    { id: "export", title: "JSONを書き出す", subtitle: "すべてのプロジェクトをバックアップ", icon: "↓", action: () => exportJSON() },
    { id: "import", title: "JSONを読み込む", subtitle: "バックアップから置き換え", icon: "↑", action: () => $("#import-file").click() },
    { id: "help", title: "キー操作を表示", subtitle: "Vim とグローバルショートカット", key: "?", icon: "?", action: () => openHelp() },
  ];

  function openCommand(initial = "") {
    dom.commandModal.classList.remove("is-hidden");
    dom.commandInput.value = initial;
    commandSelection = 0;
    renderCommandResults();
    window.setTimeout(() => dom.commandInput.focus(), 25);
  }

  function closeCommand() {
    dom.commandModal.classList.add("is-hidden");
    dom.commandInput.value = "";
  }

  function renderCommandResults() {
    const raw = dom.commandInput.value;
    const commandOnly = raw.startsWith(":");
    const query = (commandOnly ? raw.slice(1) : raw).trim().toLocaleLowerCase("ja");
    const matches = (text) => !query || text.toLocaleLowerCase("ja").includes(query);
    const commands = COMMANDS.filter((command) => matches(`${command.title} ${command.subtitle}`));
    const entities = commandOnly
      ? []
      : activeProject().entities
          .filter((item) =>
            matches(
              `${item.title} ${item.body} ${activeProject().columns
                .map((column) =>
                  column.kind === "list"
                    ? listOptionForValue(column, item.fields?.[column.id])?.label || ""
                    : item.fields?.[column.id] || "",
                )
                .join(" ")}`,
            ),
          )
          .slice(0, 10)
          .map((item) => ({
            id: `entity-${item.id}`,
            title: item.title,
            subtitle: "項目",
            icon: item.title.slice(0, 1),
            color: activeProject().accent,
            action: () => selectEntity(item.id),
          }));
    commandItems = [...commands, ...entities];
    if (commandSelection >= commandItems.length) commandSelection = Math.max(0, commandItems.length - 1);

    let html = "";
    if (commands.length) {
      html += '<div class="command-group-label">コマンド</div>';
      html += commands
        .map((item, index) => commandResultMarkup(item, index))
        .join("");
    }
    if (entities.length) {
      html += '<div class="command-group-label">このプロジェクト</div>';
      html += entities
        .map((item, index) => commandResultMarkup(item, commands.length + index))
        .join("");
    }
    if (!commandItems.length) {
      html = '<div class="empty-state"><strong>見つかりませんでした</strong><p>別の言葉で検索してください。</p></div>';
    }
    dom.commandResults.innerHTML = html;
    $(".command-result.is-selected", dom.commandResults)?.scrollIntoView({ block: "nearest" });
  }

  function commandResultMarkup(item, index) {
    return `
      <button class="command-result ${index === commandSelection ? "is-selected" : ""}"
        data-command-index="${index}" style="--result-color:${item.color || "var(--ink-muted)"}">
        <span class="command-result-icon">${escapeHTML(item.icon || "•")}</span>
        <span class="command-result-copy">
          <strong>${escapeHTML(item.title)}</strong>
          <small>${escapeHTML(item.subtitle || "")}</small>
        </span>
        ${item.key ? `<kbd>${escapeHTML(item.key)}</kbd>` : ""}
      </button>`;
  }

  function runCommand(index = commandSelection) {
    const item = commandItems[index];
    if (!item) return;
    closeCommand();
    item.action();
  }

  function openHelp() {
    dom.helpModal.classList.remove("is-hidden");
  }

  function closeHelp() {
    dom.helpModal.classList.add("is-hidden");
  }

  function openRelationModal(sourceId, targetId, sourceAnchor = "", targetAnchor = "") {
    const source = getEntityById(sourceId);
    const target = getEntityById(targetId);
    if (!source || !target || source.id === target.id) return;
    const existing = source.links.find((link) => link.targetId === target.id);
    $("#relation-source-id").value = source.id;
    $("#relation-target-id").value = target.id;
    $("#relation-source-anchor").value =
      sourceAnchor || existing?.sourceAnchor || automaticAnchor(source, target);
    $("#relation-target-anchor").value =
      targetAnchor ||
      existing?.targetAnchor ||
      oppositeAnchor($("#relation-source-anchor").value);
    $("#relation-route").textContent = `${source.title} → ${target.title}`;
    $("#relation-name").value = existing?.label || "関連";
    $("#relation-action").value = existing?.action || "";
    $("#relation-arrow").value = existing?.arrow || "end";
    $("#delete-relation-button").classList.toggle("is-hidden", !existing);
    $("#relation-modal-title").textContent = existing ? "関連を編集" : "関連を設定";
    dom.relationModal.classList.remove("is-hidden");
    window.setTimeout(() => $("#relation-name").focus(), 30);
  }

  function closeRelationModal() {
    dom.relationModal.classList.add("is-hidden");
  }

  function submitRelation(event) {
    event.preventDefault();
    const source = getEntityById($("#relation-source-id").value);
    const targetId = $("#relation-target-id").value;
    if (!source || !getEntityById(targetId) || source.id === targetId) {
      closeRelationModal();
      return;
    }
    let link = source.links.find((candidate) => candidate.targetId === targetId);
    if (!link) {
      link = { targetId };
      source.links.push(link);
    }
    Object.assign(link, {
      targetId,
      label: $("#relation-name").value.trim() || "関連",
      action: $("#relation-action").value.trim(),
      arrow: $("#relation-arrow").value,
      sourceAnchor: $("#relation-source-anchor").value,
      targetAnchor: $("#relation-target-anchor").value,
    });
    source.updatedAt = now();
    updateProjectTimestamp();
    closeRelationModal();
    renderBoard();
    renderInspector();
    markChanged("関連を保存しました");
  }

  function deleteCurrentRelation() {
    const source = getEntityById($("#relation-source-id").value);
    const targetId = $("#relation-target-id").value;
    const target = getEntityById(targetId);
    if (!source || !target) return;
    if (!window.confirm(`「${source.title} → ${target.title}」の関連を削除しますか？`)) return;
    source.links = source.links.filter((link) => link.targetId !== targetId);
    source.updatedAt = now();
    updateProjectTimestamp();
    closeRelationModal();
    renderBoard();
    renderInspector();
    markChanged("関連を削除しました");
  }

  function openSettings() {
    dom.settingsModal.classList.remove("is-hidden");
  }

  function closeSettings() {
    dom.settingsModal.classList.add("is-hidden");
  }

  async function resetAllData() {
    const confirmation = window.prompt(
      "すべてのデータと画像を完全に削除します。\n実行するには RESET と入力してください。",
    );
    if (confirmation === null) return;
    if (confirmation !== "RESET") {
      toast("確認文字が一致しないため、リセットを中止しました。", "!");
      return;
    }
    const button = $("#complete-reset-button");
    button.disabled = true;
    button.textContent = "リセット中…";
    try {
      clearTimeout(saveTimer);
      await deleteImageDatabaseCompletely();
      sessionImageURLs.forEach((url) => {
        if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      sessionImageURLs.clear();
      imageLoadPending.clear();
      missingImageIds.clear();
      clearPendingProjectBanner();
      localStorage.removeItem(STORAGE_KEY);
      state = seedState();
      closeAllModals();
      saveImmediately();
      renderAll();
      toast("すべてのデータと画像を完全にリセットしました。", "−");
    } catch (error) {
      toast(`完全リセットに失敗しました: ${error.message}`, "!");
    } finally {
      button.disabled = false;
      button.textContent = "完全リセット";
    }
  }

  function toggleTheme() {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", state.settings.theme === "dark");
    markChanged(`${state.settings.theme === "dark" ? "ダーク" : "ライト"}テーマ`);
  }

  function closeAllModals() {
    closeEntityModal();
    closeProjectModal();
    closeDatabaseColumnModal();
    closeSettings();
    closeRelationModal();
    closeCommand();
    closeHelp();
  }

  function isModalOpen() {
    return $$(".modal-layer").some((modal) => !modal.classList.contains("is-hidden"));
  }

  function openMobileSidebar() {
    dom.sidebar.classList.add("is-open");
    dom.sidebarBackdrop.classList.add("is-open");
  }

  function closeMobileSidebar() {
    dom.sidebar.classList.remove("is-open");
    dom.sidebarBackdrop.classList.remove("is-open");
  }

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 820px)").matches) {
      if (dom.sidebar.classList.contains("is-open")) closeMobileSidebar();
      else openMobileSidebar();
      return;
    }
    state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
    dom.app.classList.toggle("sidebar-collapsed", state.settings.sidebarCollapsed);
    markChanged(state.settings.sidebarCollapsed ? "サイドバーを隠しました" : "サイドバーを表示しました");
  }

  function moveSelection(delta) {
    const items = visibleEntities();
    if (!items.length) return;
    const index = items.findIndex((item) => item.id === state.activeEntityId);
    const next = index < 0 ? (delta > 0 ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, index + delta));
    selectEntity(items[next].id);
    if (state.settings.view === "database") {
      $(`tr[data-entity-id="${CSS.escape(items[next].id)}"]`)?.scrollIntoView({
        block: "nearest",
      });
    } else {
      $(`[data-board-id="${CSS.escape(items[next].id)}"]`)?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
      });
    }
  }

  function cycleSort() {
    const order = ["updatedAt-desc", "title-asc", "title-desc"];
    const current = order.indexOf(state.settings.sort);
    state.settings.sort = order[(current + 1) % order.length];
    renderHeader();
    renderDatabase();
    renderBoard();
    markChanged("並び順を変更しました");
  }

  function setBoardZoom(delta) {
    state.settings.boardZoom = Math.min(
      1.4,
      Math.max(0.6, (Number(state.settings.boardZoom) || 1) + delta),
    );
    renderBoard();
    markChanged("ボードの表示倍率を変更");
  }

  function handleBoardWheelZoom(event) {
    if (!event.metaKey || event.deltaY === 0) return;
    event.preventDefault();
    const before = Number(state.settings.boardZoom) || 1;
    const rect = dom.boardViewport.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const contentX = (dom.boardViewport.scrollLeft + pointerX) / before;
    const contentY = (dom.boardViewport.scrollTop + pointerY) / before;
    const magnitude = Math.min(0.12, Math.max(0.02, Math.abs(event.deltaY) * 0.002));
    const next = Math.min(
      1.4,
      Math.max(0.6, Math.round((before + (event.deltaY < 0 ? magnitude : -magnitude)) * 100) / 100),
    );
    if (next === before) return;
    state.settings.boardZoom = next;
    renderBoard();
    dom.boardViewport.scrollLeft = contentX * next - pointerX;
    dom.boardViewport.scrollTop = contentY * next - pointerY;
    markChanged("Command + ホイールでボードをズーム");
  }

  function boardPointFromClient(clientX, clientY) {
    const rect = dom.boardCanvas.getBoundingClientRect();
    const zoom = Number(state.settings.boardZoom) || 1;
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }

  function nearestCardAnchor(card, clientX, clientY) {
    const handles = $$("[data-connector-handle]", card);
    let nearest = "w";
    let nearestDistance = Number.POSITIVE_INFINITY;
    const candidates = handles.length
      ? handles.map((handle) => {
          const rect = handle.getBoundingClientRect();
          return {
            anchor: handle.dataset.connectorHandle,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
        })
      : (() => {
          const rect = card.getBoundingClientRect();
          return [
            ["nw", rect.left, rect.top],
            ["n", rect.left + rect.width / 2, rect.top],
            ["ne", rect.right, rect.top],
            ["e", rect.right, rect.top + rect.height / 2],
            ["se", rect.right, rect.bottom],
            ["s", rect.left + rect.width / 2, rect.bottom],
            ["sw", rect.left, rect.bottom],
            ["w", rect.left, rect.top + rect.height / 2],
          ].map(([anchor, x, y]) => ({ anchor, x, y }));
        })();
    candidates.forEach((candidate) => {
      const distance = Math.hypot(
        clientX - candidate.x,
        clientY - candidate.y,
      );
      if (distance < nearestDistance) {
        nearest = candidate.anchor;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  function clearRelationDraft() {
    dom.relationDraftLines.innerHTML = "";
    $$(".is-connection-target", dom.boardCards).forEach((card) =>
      card.classList.remove("is-connection-target"),
    );
  }

  function beginRelationDrag(event, handle) {
    if (event.button !== 0) return;
    const sourceId = handle.dataset.connectorSource;
    const sourceAnchor = handle.dataset.connectorHandle;
    const source = getEntityById(sourceId);
    if (!source) return;
    event.preventDefault();
    event.stopPropagation();
    clearRelationDraft();
    dom.relationDraftLines.setAttribute("viewBox", `0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`);
    handle.setPointerCapture?.(event.pointerId);

    const handleRect = handle.getBoundingClientRect();
    const start = boardPointFromClient(
      handleRect.left + handleRect.width / 2,
      handleRect.top + handleRect.height / 2,
    );
    let targetCard = null;

    const move = (moveEvent) => {
      const end = boardPointFromClient(moveEvent.clientX, moveEvent.clientY);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const bend = Math.max(45, Math.min(120, Math.hypot(dx, dy) * 0.3));
      const [vx, vy] = anchorVector(sourceAnchor);
      const c1x = start.x + vx * bend;
      const c1y = start.y + vy * bend;
      const c2x = end.x - (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx || 1) * bend : 0);
      const c2y = end.y - (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy || 1) * bend : 0);
      dom.relationDraftLines.innerHTML = `<path class="relation-draft-line" d="M${start.x} ${start.y} C${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}" />`;

      const hovered = document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest("[data-board-id]");
      const nextTarget = hovered?.dataset.boardId !== sourceId ? hovered : null;
      if (nextTarget !== targetCard) {
        targetCard?.classList.remove("is-connection-target");
        targetCard = nextTarget;
        targetCard?.classList.add("is-connection-target");
      }
    };

    const end = (endEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      const completedTarget = targetCard;
      const targetAnchor = completedTarget
        ? nearestCardAnchor(completedTarget, endEvent.clientX, endEvent.clientY)
        : "";
      clearRelationDraft();
      if (completedTarget) {
        openRelationModal(sourceId, completedTarget.dataset.boardId, sourceAnchor, targetAnchor);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  function itemBoardSize(item) {
    if (item.organisation) {
      return { width: item.groupWidth, height: item.groupHeight };
    }
    const card = $(`[data-board-id="${CSS.escape(item.id)}"]`, dom.boardCards);
    return {
      width: Number(card?.offsetWidth) || 188,
      height: Number(card?.offsetHeight) || (item.imageId || item.image ? 180 : 104),
    };
  }

  function containingGroupFor(item) {
    const size = itemBoardSize(item);
    const centerX = item.x + size.width / 2;
    const centerY = item.y + size.height / 2;
    const excluded = item.organisation ? groupDescendantIds(item.id) : new Set();
    return (
      activeProject().entities
        .filter(
          (group) =>
            group.organisation &&
            group.id !== item.id &&
            !excluded.has(group.id) &&
            centerX >= group.x + 12 &&
            centerX <= group.x + group.groupWidth - 12 &&
            centerY >= group.y + 42 &&
            centerY <= group.y + group.groupHeight - 12,
        )
        .sort(
          (a, b) =>
            a.groupWidth * a.groupHeight - b.groupWidth * b.groupHeight ||
            groupDepth(b) - groupDepth(a),
        )[0] || null
    );
  }

  function updateEntityGroupMembership(item) {
    const group = containingGroupFor(item);
    const nextParentId = group?.id || "";
    const changed = item.parentGroupId !== nextParentId;
    item.parentGroupId = nextParentId;
    return changed;
  }

  function highlightGroupDropTarget(item) {
    const target = containingGroupFor(item);
    $$("[data-organisation-group]", dom.boardCards).forEach((group) =>
      group.classList.toggle("is-drop-target", group.dataset.boardId === target?.id),
    );
  }

  function clearGroupDropTargets() {
    $$(".board-group.is-drop-target", dom.boardCards).forEach((group) =>
      group.classList.remove("is-drop-target"),
    );
  }

  function beginBoardDrag(event, card) {
    if (event.button !== 0) return;
    const item = getEntityById(card.dataset.boardId);
    if (!item) return;
    event.preventDefault();
    state.activeEntityId = item.id;
    $$("[data-board-id]", dom.boardCards).forEach((node) =>
      node.classList.toggle("is-selected", node === card),
    );
    renderDatabase();
    renderInspector();
    const zoom = Number(state.settings.boardZoom) || 1;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = item.x;
    const originY = item.y;
    const size = itemBoardSize(item);
    const descendants = item.organisation
      ? [...groupDescendantIds(item.id)]
          .map((id) => getEntityById(id))
          .filter(Boolean)
          .map((descendant) => ({
            item: descendant,
            x: descendant.x,
            y: descendant.y,
          }))
      : [];
    card.classList.add("is-dragging");
    card.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      const x = Math.max(
        0,
        Math.min(BOARD_WIDTH - size.width, originX + (moveEvent.clientX - startX) / zoom),
      );
      const y = Math.max(
        0,
        Math.min(BOARD_HEIGHT - size.height, originY + (moveEvent.clientY - startY) / zoom),
      );
      item.x = Math.round(x);
      item.y = Math.round(y);
      card.style.left = `${item.x}px`;
      card.style.top = `${item.y}px`;
      const offsetX = item.x - originX;
      const offsetY = item.y - originY;
      descendants.forEach((entry) => {
        entry.item.x = Math.round(entry.x + offsetX);
        entry.item.y = Math.round(entry.y + offsetY);
        const descendantCard = $(
          `[data-board-id="${CSS.escape(entry.item.id)}"]`,
          dom.boardCards,
        );
        if (descendantCard) {
          descendantCard.style.left = `${entry.item.x}px`;
          descendantCard.style.top = `${entry.item.y}px`;
        }
      });
      highlightGroupDropTarget(item);
      renderRelationLines(visibleEntities());
    };
    const end = () => {
      card.classList.remove("is-dragging");
      clearGroupDropTargets();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      const membershipChanged = updateEntityGroupMembership(item);
      item.updatedAt = now();
      updateProjectTimestamp();
      renderBoard();
      markChanged(
        membershipChanged
          ? item.parentGroupId
            ? "項目をOrganisationグループへ移動しました"
            : "項目をOrganisationグループから取り出しました"
          : "ボードの配置を保存しました",
      );
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  function beginGroupResize(event, handle) {
    if (event.button !== 0) return;
    const item = getEntityById(handle.dataset.groupId);
    if (!item?.organisation) return;
    event.preventDefault();
    event.stopPropagation();
    state.activeEntityId = item.id;
    $$("[data-board-id]", dom.boardCards).forEach((node) =>
      node.classList.toggle("is-selected", node.dataset.boardId === item.id),
    );
    renderDatabase();
    renderInspector();
    const card = $(`[data-board-id="${CSS.escape(item.id)}"]`, dom.boardCards);
    if (!card) return;
    const anchor = handle.dataset.groupResize;
    const zoom = Number(state.settings.boardZoom) || 1;
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = {
      x: item.x,
      y: item.y,
      width: item.groupWidth,
      height: item.groupHeight,
    };
    const minimumWidth = 240;
    const minimumHeight = 170;
    card.classList.add("is-resizing");
    handle.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      let x = origin.x;
      let y = origin.y;
      let width = origin.width;
      let height = origin.height;
      if (anchor.includes("e")) {
        width = Math.min(BOARD_WIDTH - origin.x, Math.max(minimumWidth, origin.width + dx));
      }
      if (anchor.includes("s")) {
        height = Math.min(BOARD_HEIGHT - origin.y, Math.max(minimumHeight, origin.height + dy));
      }
      if (anchor.includes("w")) {
        x = Math.max(0, Math.min(origin.x + origin.width - minimumWidth, origin.x + dx));
        width = origin.width + (origin.x - x);
      }
      if (anchor.includes("n")) {
        y = Math.max(0, Math.min(origin.y + origin.height - minimumHeight, origin.y + dy));
        height = origin.height + (origin.y - y);
      }
      item.x = Math.round(x);
      item.y = Math.round(y);
      item.groupWidth = Math.round(width);
      item.groupHeight = Math.round(height);
      card.style.left = `${item.x}px`;
      card.style.top = `${item.y}px`;
      card.style.width = `${item.groupWidth}px`;
      card.style.height = `${item.groupHeight}px`;
      renderRelationLines(visibleEntities());
    };

    const end = () => {
      card.classList.remove("is-resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      activeProject().entities
        .filter((candidate) => candidate.id !== item.id)
        .forEach((candidate) => updateEntityGroupMembership(candidate));
      updateEntityGroupMembership(item);
      item.updatedAt = now();
      updateProjectTimestamp();
      renderBoard();
      markChanged("Organisationグループの大きさを保存しました");
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  function beginBoardPan(event) {
    if (event.button !== 0 || event.target.closest("[data-board-id]")) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const originLeft = dom.boardViewport.scrollLeft;
    const originTop = dom.boardViewport.scrollTop;
    dom.boardViewport.classList.add("is-panning");
    dom.boardViewport.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      dom.boardViewport.scrollLeft = originLeft - (moveEvent.clientX - startX);
      dom.boardViewport.scrollTop = originTop - (moveEvent.clientY - startY);
    };
    const end = () => {
      dom.boardViewport.classList.remove("is-panning");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  function updateInspectorValue(target) {
    const item = activeEntity();
    if (!item) return;
    if (target.dataset.inspectorField) {
      const key = target.dataset.inspectorField;
      item[key] = target.type === "checkbox" ? target.checked : target.value;
    } else if (target.dataset.inspectorCustom) {
      item.fields[target.dataset.inspectorCustom] =
        target.type === "checkbox" ? target.checked : target.value;
      const column = activeProject().columns.find(
        (candidate) => candidate.id === target.dataset.inspectorCustom,
      );
      if (column?.kind === "list") {
        const option = listOptionForValue(column, target.value);
        target.style.setProperty("--list-color", option?.color || "#777B85");
      }
    } else {
      return;
    }
    if (!String(item.title).trim()) item.title = "名称未設定";
    item.updatedAt = now();
    updateProjectTimestamp();
    if (target.dataset.inspectorField === "title") {
      $(".inspector-cover-letter", dom.inspectorContent).textContent = item.title.slice(0, 1);
    }
    renderHeader();
    renderDatabase();
    renderBoard();
    markChanged("詳細の変更を保存しました");
  }

  function updateInspectorOrganisation(enabled) {
    const item = activeEntity();
    if (!item) return;
    item.organisation = enabled;
    if (enabled) {
      item.x = Math.max(0, Math.min(BOARD_WIDTH - item.groupWidth, item.x));
      item.y = Math.max(0, Math.min(BOARD_HEIGHT - item.groupHeight, item.y));
    }
    if (!enabled) {
      activeProject().entities.forEach((candidate) => {
        if (candidate.parentGroupId === item.id) candidate.parentGroupId = "";
      });
    }
    activeProject().entities
      .filter((candidate) => candidate.id !== item.id)
      .forEach((candidate) => updateEntityGroupMembership(candidate));
    item.updatedAt = now();
    updateProjectTimestamp();
    renderDatabase();
    renderBoard();
    renderInspector();
    markChanged(enabled ? "Organisationを有効にしました" : "Organisationを無効にしました");
  }

  function setOrganisationColor(color) {
    const item = activeEntity();
    if (!item || !item.organisation) return;
    item.groupColor = normalizePaletteColor(color);
    item.updatedAt = now();
    updateProjectTimestamp();
    renderBoard();
    renderInspector();
    markChanged("グループ背景色を保存しました");
  }

  async function handleInspectorImageFile(file) {
    const item = activeEntity();
    if (!item || !file || !file.type.startsWith("image/")) {
      toast("画像ファイルを選択してください。", "!");
      return;
    }
    try {
      const imageId = item.imageId || uid("img");
      await putStoredImage(imageId, file);
      item.imageId = imageId;
      item.imageName = file.name;
      item.image = "";
      item.updatedAt = now();
      setSessionImageURL(item.id, file);
      updateProjectTimestamp();
      renderAll();
      markChanged("画像をブラウザへ保存しました");
      toast("画像をブラウザへ保存しました。");
    } catch (error) {
      toast(`画像を保存できませんでした: ${error.message}`, "!");
    }
  }

  async function removeInspectorImage(id) {
    const item = getEntityById(id);
    if (!item) return;
    try {
      if (item.imageId) await deleteStoredImage(item.imageId);
      const url = sessionImageURLs.get(item.id);
      if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      sessionImageURLs.delete(item.id);
      missingImageIds.delete(item.id);
      item.imageId = "";
      item.imageName = "";
      item.image = "";
      item.updatedAt = now();
      updateProjectTimestamp();
      renderAll();
      markChanged("画像を削除しました");
      toast("画像を削除しました。", "−");
    } catch (error) {
      toast(`画像を削除できませんでした: ${error.message}`, "!");
    }
  }

  function deleteEntityFromInspector(id) {
    const item = getEntityById(id);
    if (!item) return;
    if (!window.confirm(`「${item.title}」を削除しますか？\nこの操作は JSON バックアップからのみ復元できます。`)) return;
    const project = activeProject();
    project.entities = project.entities.filter((candidate) => candidate.id !== id);
    project.entities.forEach((candidate) => {
      candidate.links = candidate.links.filter((link) => link.targetId !== id);
      if (candidate.parentGroupId === id) candidate.parentGroupId = "";
    });
    const url = sessionImageURLs.get(id);
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    sessionImageURLs.delete(id);
    missingImageIds.delete(id);
    if (item.imageId) {
      void deleteStoredImage(item.imageId).catch((error) =>
        console.warn("LoreGrid: image could not be deleted.", error),
      );
    }
    state.activeEntityId = null;
    updateProjectTimestamp();
    renderAll();
    markChanged("項目を削除しました");
    toast(`「${item.title}」を削除しました。`, "−");
  }

  const vim = {
    mode: "normal",
    pending: "",
    clipboard: "",
    undoStack: [],
    searchBuffer: "",
    lastSearch: "",
    lastJAt: 0,

    reset() {
      this.mode = "normal";
      this.pending = "";
      this.searchBuffer = "";
      this.undoStack = [];
      this.lastJAt = 0;
      this.updateStatus();
    },

    setMode(mode) {
      this.mode = mode;
      this.pending = "";
      this.searchBuffer = "";
      this.updateStatus();
    },

    updateStatus(command = "") {
      $("#vim-editor").dataset.mode = this.mode;
      $("#vim-mode").textContent =
        this.mode === "insert" ? "-- INSERT --" : this.mode === "search" ? "-- SEARCH --" : this.mode === "ex" ? "-- COMMAND --" : "-- NORMAL --";
      $("#vim-command").textContent =
        command ||
        (this.mode === "search" ? `/${this.searchBuffer}` : this.mode === "ex" ? `:${this.searchBuffer}` : this.pending);
      updateVimPosition();
    },

    pushUndo() {
      const value = dom.bodyEditor.value;
      if (this.undoStack.at(-1) !== value) {
        this.undoStack.push(value);
        if (this.undoStack.length > 80) this.undoStack.shift();
      }
    },

    lineBounds(position = dom.bodyEditor.selectionStart) {
      const value = dom.bodyEditor.value;
      const start = value.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
      const nextBreak = value.indexOf("\n", position);
      const end = nextBreak === -1 ? value.length : nextBreak;
      return { start, end };
    },

    setCursor(position, end = position) {
      const max = dom.bodyEditor.value.length;
      dom.bodyEditor.setSelectionRange(Math.max(0, Math.min(max, position)), Math.max(0, Math.min(max, end)));
      updateVimPosition();
    },

    moveVertical(delta) {
      const value = dom.bodyEditor.value;
      const position = dom.bodyEditor.selectionStart;
      const bounds = this.lineBounds(position);
      const column = position - bounds.start;
      if (delta < 0) {
        if (bounds.start === 0) return;
        const previousEnd = bounds.start - 1;
        const previousStart = value.lastIndexOf("\n", Math.max(0, previousEnd - 1)) + 1;
        this.setCursor(Math.min(previousEnd, previousStart + column));
      } else {
        if (bounds.end >= value.length) return;
        const nextStart = bounds.end + 1;
        const nextEndIndex = value.indexOf("\n", nextStart);
        const nextEnd = nextEndIndex === -1 ? value.length : nextEndIndex;
        this.setCursor(Math.min(nextEnd, nextStart + column));
      }
    },

    moveWord(direction) {
      const value = dom.bodyEditor.value;
      const position = dom.bodyEditor.selectionStart;
      if (direction > 0) {
        const match = value.slice(position + 1).match(/[\p{L}\p{N}_]+/u);
        this.setCursor(match ? position + 1 + match.index : value.length);
      } else {
        const before = value.slice(0, position).replace(/\s+$/u, "");
        const matches = [...before.matchAll(/[\p{L}\p{N}_]+/gu)];
        this.setCursor(matches.length ? matches.at(-1).index : 0);
      }
    },

    deleteLine() {
      this.pushUndo();
      const value = dom.bodyEditor.value;
      const { start, end } = this.lineBounds();
      const deleteEnd = end < value.length ? end + 1 : end;
      this.clipboard = value.slice(start, deleteEnd);
      dom.bodyEditor.value = value.slice(0, start) + value.slice(deleteEnd);
      this.setCursor(Math.min(start, dom.bodyEditor.value.length));
      updateEditorGutter();
    },

    yankLine() {
      const value = dom.bodyEditor.value;
      const { start, end } = this.lineBounds();
      this.clipboard = value.slice(start, end) + "\n";
      this.updateStatus("1 line yanked");
    },

    paste() {
      if (!this.clipboard) return;
      this.pushUndo();
      const value = dom.bodyEditor.value;
      const position = dom.bodyEditor.selectionStart;
      dom.bodyEditor.value = value.slice(0, position) + this.clipboard + value.slice(position);
      this.setCursor(position + this.clipboard.length);
      updateEditorGutter();
    },

    undo() {
      const previous = this.undoStack.pop();
      if (previous === undefined) return;
      dom.bodyEditor.value = previous;
      this.setCursor(Math.min(dom.bodyEditor.selectionStart, previous.length));
      updateEditorGutter();
      this.updateStatus("undo");
    },

    findNext(query = this.lastSearch) {
      if (!query) return;
      const value = dom.bodyEditor.value.toLocaleLowerCase("ja");
      const needle = query.toLocaleLowerCase("ja");
      let index = value.indexOf(needle, dom.bodyEditor.selectionEnd);
      if (index === -1) index = value.indexOf(needle);
      if (index !== -1) {
        dom.bodyEditor.setSelectionRange(index, index + query.length);
        this.updateStatus(`/${query}`);
      } else {
        this.updateStatus(`pattern not found: ${query}`);
      }
    },

    handleSearchKey(event) {
      event.preventDefault();
      if (event.key === "Escape") {
        this.setMode("normal");
      } else if (event.key === "Enter") {
        this.lastSearch = this.searchBuffer;
        this.setMode("normal");
        this.findNext();
      } else if (event.key === "Backspace") {
        this.searchBuffer = this.searchBuffer.slice(0, -1);
        this.updateStatus();
      } else if (event.key.length === 1) {
        this.searchBuffer += event.key;
        this.updateStatus();
      }
    },

    handleExKey(event) {
      event.preventDefault();
      if (event.key === "Escape") {
        this.setMode("normal");
      } else if (event.key === "Enter") {
        const command = this.searchBuffer.trim();
        if (["w", "write"].includes(command)) {
          submitEntity(new Event("submit", { cancelable: true }));
        } else if (["q", "quit"].includes(command)) {
          closeEntityModal();
        } else if (["wq", "x"].includes(command)) {
          submitEntity(new Event("submit", { cancelable: true }));
        } else if (["noh", "nohlsearch"].includes(command)) {
          this.lastSearch = "";
          this.setMode("normal");
        } else {
          this.setMode("normal");
          this.updateStatus(`not an editor command: ${command}`);
        }
      } else if (event.key === "Backspace") {
        this.searchBuffer = this.searchBuffer.slice(0, -1);
        this.updateStatus();
      } else if (event.key.length === 1) {
        this.searchBuffer += event.key;
        this.updateStatus();
      }
    },

    handleInsertKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        this.setMode("normal");
        return;
      }
      if (event.key === "j") {
        const currentTime = Date.now();
        const position = dom.bodyEditor.selectionStart;
        if (
          currentTime - this.lastJAt < 550 &&
          position > 0 &&
          dom.bodyEditor.value[position - 1] === "j"
        ) {
          event.preventDefault();
          dom.bodyEditor.value =
            dom.bodyEditor.value.slice(0, position - 1) + dom.bodyEditor.value.slice(position);
          this.setCursor(position - 1);
          this.setMode("normal");
          updateEditorGutter();
          this.lastJAt = 0;
          return;
        }
        this.lastJAt = currentTime;
      } else {
        this.lastJAt = 0;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        this.pushUndo();
        const start = dom.bodyEditor.selectionStart;
        const end = dom.bodyEditor.selectionEnd;
        dom.bodyEditor.value =
          dom.bodyEditor.value.slice(0, start) + "  " + dom.bodyEditor.value.slice(end);
        this.setCursor(start + 2);
      }
    },

    handleNormalKey(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key;
      const position = dom.bodyEditor.selectionStart;
      const value = dom.bodyEditor.value;
      const bounds = this.lineBounds(position);
      const handled = [
        "h", "j", "k", "l", "w", "b", "0", "$", "g", "G", "i", "a", "I", "A",
        "o", "O", "x", "d", "y", "p", "u", "/", ":", "n", "Escape",
      ].includes(key);
      if (handled) event.preventDefault();

      if (this.pending === "d") {
        this.pending = "";
        if (key === "d") this.deleteLine();
        this.updateStatus();
        return;
      }
      if (this.pending === "y") {
        this.pending = "";
        if (key === "y") this.yankLine();
        this.updateStatus();
        return;
      }
      if (this.pending === "g") {
        this.pending = "";
        if (key === "g") this.setCursor(0);
        this.updateStatus();
        return;
      }

      switch (key) {
        case "h": this.setCursor(position - 1); break;
        case "l": this.setCursor(position + 1); break;
        case "j": this.moveVertical(1); break;
        case "k": this.moveVertical(-1); break;
        case "w": this.moveWord(1); break;
        case "b": this.moveWord(-1); break;
        case "0": this.setCursor(bounds.start); break;
        case "$": this.setCursor(bounds.end); break;
        case "g": this.pending = "g"; this.updateStatus(); break;
        case "G": this.setCursor(value.length); break;
        case "i": this.pushUndo(); this.setMode("insert"); break;
        case "a": this.pushUndo(); this.setCursor(position + 1); this.setMode("insert"); break;
        case "I": this.pushUndo(); this.setCursor(bounds.start); this.setMode("insert"); break;
        case "A": this.pushUndo(); this.setCursor(bounds.end); this.setMode("insert"); break;
        case "o":
          this.pushUndo();
          dom.bodyEditor.value = value.slice(0, bounds.end) + "\n" + value.slice(bounds.end);
          this.setCursor(bounds.end + 1);
          this.setMode("insert");
          updateEditorGutter();
          break;
        case "O":
          this.pushUndo();
          dom.bodyEditor.value = value.slice(0, bounds.start) + "\n" + value.slice(bounds.start);
          this.setCursor(bounds.start);
          this.setMode("insert");
          updateEditorGutter();
          break;
        case "x":
          if (position < value.length) {
            this.pushUndo();
            this.clipboard = value[position];
            dom.bodyEditor.value = value.slice(0, position) + value.slice(position + 1);
            this.setCursor(position);
            updateEditorGutter();
          }
          break;
        case "d": this.pending = "d"; this.updateStatus(); break;
        case "y": this.pending = "y"; this.updateStatus(); break;
        case "p": this.paste(); break;
        case "u": this.undo(); break;
        case "/": this.setMode("search"); break;
        case ":": this.setMode("ex"); break;
        case "n": this.findNext(); break;
        case "Escape": this.pending = ""; this.updateStatus(); break;
      }
    },

    handleKeydown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        dom.entityForm.requestSubmit();
        return;
      }
      if (this.mode === "search") return this.handleSearchKey(event);
      if (this.mode === "ex") return this.handleExKey(event);
      if (this.mode === "insert") return this.handleInsertKey(event);
      this.handleNormalKey(event);
    },
  };

  function updateEditorGutter() {
    const count = Math.max(1, dom.bodyEditor.value.split("\n").length);
    $("#editor-gutter").textContent = Array.from({ length: count }, (_, index) => index + 1).join("\n");
    updateVimPosition();
  }

  function updateVimPosition() {
    const value = dom.bodyEditor.value;
    const position = dom.bodyEditor.selectionStart;
    const before = value.slice(0, position);
    const line = before.split("\n").length;
    const lastBreak = before.lastIndexOf("\n");
    const column = position - lastBreak;
    $("#vim-position").textContent = `${line}:${column}`;
  }

  dom.projectList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-project-id]");
    if (button) switchProject(button.dataset.projectId);
  });

  dom.tableBody.addEventListener("click", (event) => {
    if (event.target.closest("[data-db-field]")) return;
    const edit = event.target.closest("[data-edit-entity]");
    if (edit) {
      event.stopPropagation();
      selectEntity(edit.dataset.editEntity, { focus: true });
      return;
    }
    const row = event.target.closest("[data-entity-id]");
    if (row) selectEntity(row.dataset.entityId);
  });

  dom.tableBody.addEventListener("dblclick", (event) => {
    if (event.target.closest("[data-db-field]")) return;
    const row = event.target.closest("[data-entity-id]");
    if (row) selectEntity(row.dataset.entityId, { focus: true });
  });
  dom.tableBody.addEventListener("focusin", (event) => {
    const field = event.target.closest("[data-db-field]");
    if (!field) return;
    state.activeEntityId = field.dataset.dbEntity;
    $$("tr[data-entity-id]", dom.tableBody).forEach((row) =>
      row.classList.toggle("is-selected", row.dataset.entityId === state.activeEntityId),
    );
    renderInspector();
    markChanged("項目を選択");
  });
  dom.tableBody.addEventListener("input", (event) => {
    if (
      event.target.matches("[data-db-field]") &&
      event.target.tagName !== "SELECT" &&
      event.target.type !== "checkbox"
    ) {
      updateDatabaseCell(event.target);
    }
  });
  dom.tableBody.addEventListener("change", (event) => {
    if (
      event.target.matches("select[data-db-field], input[type='checkbox'][data-db-field]")
    ) {
      updateDatabaseCell(event.target);
    }
  });

  dom.boardCards.addEventListener("pointerdown", (event) => {
    const resizeHandle = event.target.closest("[data-group-resize]");
    if (resizeHandle) {
      beginGroupResize(event, resizeHandle);
      return;
    }
    const handle = event.target.closest("[data-connector-handle]");
    if (handle) {
      beginRelationDrag(event, handle);
      return;
    }
    const card = event.target.closest("[data-board-id]");
    if (card) beginBoardDrag(event, card);
  });

  dom.relationLines.addEventListener("click", (event) => {
    const relation = event.target.closest("[data-relation-source][data-relation-target]");
    if (relation) {
      openRelationModal(relation.dataset.relationSource, relation.dataset.relationTarget);
    }
  });

  dom.boardCards.addEventListener("dblclick", (event) => {
    const card = event.target.closest("[data-board-id]");
    if (card) selectEntity(card.dataset.boardId, { focus: true });
  });
  dom.boardViewport.addEventListener("pointerdown", beginBoardPan);
  dom.boardViewport.addEventListener("wheel", handleBoardWheelZoom, { passive: false });

  dom.inspectorContent.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close-inspector]");
    const removeImage = event.target.closest("[data-remove-inspector-image]");
    const related = event.target.closest("[data-related-id]");
    const organisationColor = event.target.closest("[data-organisation-color]");
    if (close) closeInspector();
    else if (removeImage) void removeInspectorImage(removeImage.dataset.removeInspectorImage);
    else if (related) selectEntity(related.dataset.relatedId);
    else if (organisationColor) setOrganisationColor(organisationColor.dataset.organisationColor);
  });
  dom.inspectorContent.addEventListener("input", (event) => {
    if (
      event.target.matches("[data-inspector-field], [data-inspector-custom]") &&
      event.target.tagName !== "SELECT" &&
      event.target.type !== "checkbox"
    ) {
      updateInspectorValue(event.target);
    }
  });
  dom.inspectorContent.addEventListener("change", (event) => {
    if (event.target.matches("[data-inspector-organisation]")) {
      updateInspectorOrganisation(event.target.checked);
    } else if (
      event.target.matches(
        "select[data-inspector-field], select[data-inspector-custom], input[type='checkbox'][data-inspector-custom]",
      )
    ) {
      updateInspectorValue(event.target);
    } else if (event.target.matches("[data-inspector-image-file]")) {
      void handleInspectorImageFile(event.target.files[0]);
    }
  });
  ["dragenter", "dragover"].forEach((name) =>
    dom.inspectorContent.addEventListener(name, (event) => {
      const dropzone = event.target.closest("[data-inspector-image-drop]");
      if (!dropzone) return;
      event.preventDefault();
      dropzone.classList.add("is-dragover");
    }),
  );
  dom.inspectorContent.addEventListener("dragleave", (event) => {
    const dropzone = event.target.closest("[data-inspector-image-drop]");
    if (!dropzone) return;
    dropzone.classList.remove("is-dragover");
  });
  dom.inspectorContent.addEventListener("drop", (event) => {
    const dropzone = event.target.closest("[data-inspector-image-drop]");
    if (!dropzone) return;
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
    void handleInspectorImageFile(event.dataTransfer.files[0]);
  });

  $$(".view-button").forEach((button) =>
    button.addEventListener("click", () => setView(button.dataset.view)),
  );
  $("#add-row-button").addEventListener("click", createEntityInInspector);
  $("#new-project-button").addEventListener("click", () => openProjectModal());
  $("#edit-project-button").addEventListener("click", () => openProjectModal(state.activeProjectId));
  $("#project-banner-file").addEventListener("change", (event) => {
    handleProjectBannerFile(event.target.files[0]);
    event.target.value = "";
  });
  ["dragenter", "dragover"].forEach((name) =>
    dom.projectBannerDrop.addEventListener(name, (event) => {
      event.preventDefault();
      dom.projectBannerDrop.classList.add("is-dragover");
    }),
  );
  ["dragleave", "drop"].forEach((name) =>
    dom.projectBannerDrop.addEventListener(name, (event) => {
      event.preventDefault();
      dom.projectBannerDrop.classList.remove("is-dragover");
    }),
  );
  dom.projectBannerDrop.addEventListener("drop", (event) => {
    handleProjectBannerFile(event.dataTransfer.files[0]);
  });
  dom.workspaceHeader.addEventListener("dragenter", (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
    event.preventDefault();
    workspaceBannerDragDepth += 1;
    dom.workspaceHeader.classList.add("is-banner-dragover");
  });
  dom.workspaceHeader.addEventListener("dragover", (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dom.workspaceHeader.classList.add("is-banner-dragover");
  });
  dom.workspaceHeader.addEventListener("dragleave", () => {
    workspaceBannerDragDepth = Math.max(0, workspaceBannerDragDepth - 1);
    if (!workspaceBannerDragDepth) {
      dom.workspaceHeader.classList.remove("is-banner-dragover");
    }
  });
  dom.workspaceHeader.addEventListener("drop", (event) => {
    event.preventDefault();
    workspaceBannerDragDepth = 0;
    dom.workspaceHeader.classList.remove("is-banner-dragover");
    void applyProjectBannerFromWorkspace(event.dataTransfer.files[0]);
  });
  $("#remove-project-banner").addEventListener("click", removePendingProjectBanner);
  $("#theme-button").addEventListener("click", toggleTheme);
  $("#settings-button").addEventListener("click", openSettings);
  $("#complete-reset-button").addEventListener("click", () => void resetAllData());
  $("#help-button").addEventListener("click", openHelp);
  $("#command-trigger").addEventListener("click", () => openCommand());
  $("#export-button").addEventListener("click", exportJSON);
  $("#import-header-button").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", (event) => importJSON(event.target.files[0]));
  $("#clear-search").addEventListener("click", () => {
    state.settings.query = "";
    renderFilters();
    renderDatabase();
    renderBoard();
    markChanged("検索を解除");
  });
  $("#sort-button").addEventListener("click", cycleSort);
  $("#zoom-in").addEventListener("click", () => setBoardZoom(0.1));
  $("#zoom-out").addEventListener("click", () => setBoardZoom(-0.1));

  dom.search.addEventListener("input", () => {
    state.settings.query = dom.search.value;
    renderDatabase();
    renderBoard();
    markChanged("検索中");
  });

  dom.tableHead.addEventListener("click", (event) => {
      const addColumn = event.target.closest("[data-add-db-column]");
      const editColumn = event.target.closest("[data-edit-db-column]");
      const moveColumn = event.target.closest("[data-move-db-column]");
      if (addColumn) {
        addDatabaseColumn();
        return;
      }
      if (editColumn) {
        openDatabaseColumnModal(editColumn.dataset.editDbColumn);
        return;
      }
      if (moveColumn) {
        moveDatabaseColumn(
          moveColumn.dataset.moveDbColumn,
          Number(moveColumn.dataset.moveDirection),
        );
        return;
      }
      const header = event.target.closest("th[data-sort]");
      if (!header) return;
      const key = header.dataset.sort;
      const current = String(state.settings.sort);
      const direction = current.startsWith(key) && current.endsWith("asc") ? "desc" : "asc";
      state.settings.sort = `${key}-${direction}`;
      renderHeader();
      renderDatabase();
      renderBoard();
      markChanged("並び順を変更");
  });
  dom.tableHead.addEventListener("dragstart", (event) => {
    const header = event.target.closest("[data-column-id]");
    if (!header) return;
    draggedDatabaseColumnId = header.dataset.columnId;
    header.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedDatabaseColumnId);
  });
  dom.tableHead.addEventListener("dragover", (event) => {
    const header = event.target.closest("[data-column-id]");
    if (!header || header.dataset.columnId === draggedDatabaseColumnId) return;
    event.preventDefault();
    $$(".custom-column-header", dom.tableHead).forEach((candidate) =>
      candidate.classList.toggle("is-drop-target", candidate === header),
    );
  });
  dom.tableHead.addEventListener("drop", (event) => {
    const header = event.target.closest("[data-column-id]");
    if (!header || !draggedDatabaseColumnId) return;
    event.preventDefault();
    const rect = header.getBoundingClientRect();
    reorderDatabaseColumn(
      draggedDatabaseColumnId,
      header.dataset.columnId,
      event.clientX > rect.left + rect.width / 2,
    );
    draggedDatabaseColumnId = "";
  });
  dom.tableHead.addEventListener("dragend", () => {
    draggedDatabaseColumnId = "";
    $$(".custom-column-header", dom.tableHead).forEach((header) =>
      header.classList.remove("is-dragging", "is-drop-target"),
    );
  });

  dom.entityForm.addEventListener("submit", submitEntity);
  dom.projectForm.addEventListener("submit", submitProject);
  dom.columnForm.addEventListener("submit", submitDatabaseColumn);
  dom.relationForm.addEventListener("submit", submitRelation);
  $("#delete-entity-button").addEventListener("click", deleteCurrentEntity);
  $("#delete-column-button").addEventListener("click", () => {
    const id = $("#column-id").value;
    if (id) deleteDatabaseColumn(id);
  });
  $("#delete-relation-button").addEventListener("click", deleteCurrentRelation);
  $("#column-kind").addEventListener("change", updateColumnListSettingsVisibility);
  $("#add-list-option").addEventListener("click", () => addListOptionEditorRow());
  $("#column-list-options").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-list-option]");
    const color = event.target.closest("[data-list-option-color]");
    if (remove) {
      remove.closest("[data-list-option-row]")?.remove();
    } else if (color) {
      const row = color.closest("[data-list-option-row]");
      const selected = normalizePaletteColor(color.dataset.listOptionColor);
      row.style.setProperty("--list-color", selected);
      $(".list-option-color-value", row).value = selected;
      $(".list-option-badge-preview", row)?.style.setProperty("--list-color", selected);
      $(".list-option-color-picker summary", row)?.style.setProperty("--list-color", selected);
      $(".list-option-color-picker", row)?.removeAttribute("open");
    }
  });

  $$("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", () => {
      const modal = element.dataset.closeModal;
      if (modal === "entity") closeEntityModal();
      if (modal === "project") closeProjectModal();
      if (modal === "column") closeDatabaseColumnModal();
      if (modal === "settings") closeSettings();
      if (modal === "relation") closeRelationModal();
      if (modal === "command") closeCommand();
      if (modal === "help") closeHelp();
    });
  });

  dom.commandInput.addEventListener("input", () => {
    commandSelection = 0;
    renderCommandResults();
  });
  dom.commandInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      commandSelection = Math.min(commandItems.length - 1, commandSelection + 1);
      renderCommandResults();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      commandSelection = Math.max(0, commandSelection - 1);
      renderCommandResults();
    } else if (event.key === "Enter") {
      event.preventDefault();
      runCommand();
    } else if (event.key === "Escape") {
      closeCommand();
    }
  });
  dom.commandResults.addEventListener("click", (event) => {
    const result = event.target.closest("[data-command-index]");
    if (result) runCommand(Number(result.dataset.commandIndex));
  });

  dom.dropzone.addEventListener("click", (event) => {
    if (event.target !== $("#image-file")) $("#image-file").click();
  });
  dom.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      $("#image-file").click();
    }
  });
  $("#image-file").addEventListener("change", (event) => handleImageFile(event.target.files[0]));
  ["dragenter", "dragover"].forEach((name) =>
    dom.dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dom.dropzone.classList.add("is-dragover");
    }),
  );
  ["dragleave", "drop"].forEach((name) =>
    dom.dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dom.dropzone.classList.remove("is-dragover");
    }),
  );
  dom.dropzone.addEventListener("drop", (event) => handleImageFile(event.dataTransfer.files[0]));
  dom.imagePath.addEventListener("input", () => {
    setImagePreview($("#entity-id").value || null, dom.imagePath.value.trim());
  });

  dom.bodyEditor.addEventListener("keydown", (event) => vim.handleKeydown(event));
  dom.bodyEditor.addEventListener("input", updateEditorGutter);
  dom.bodyEditor.addEventListener("click", updateVimPosition);
  dom.bodyEditor.addEventListener("keyup", updateVimPosition);
  dom.bodyEditor.addEventListener("focus", () => {
    $("#mode-chip").textContent = vim.mode.toUpperCase();
  });
  dom.bodyEditor.addEventListener("blur", () => {
    $("#mode-chip").textContent = state.settings.view === "database" ? "NORMAL" : "BOARD";
  });

  $("#sidebar-toggle").addEventListener("click", toggleSidebar);
  dom.sidebarBackdrop.addEventListener("click", closeMobileSidebar);

  document.addEventListener("click", (event) => {
    const clear = event.target.closest("#empty-clear-filter");
    const add = event.target.closest("#empty-add-entity");
    if (clear) clearFilters();
    if (add) createEntityInInspector();
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping =
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (!dom.commandModal.classList.contains("is-hidden")) closeCommand();
      else openCommand();
      return;
    }
    // The Vim editor owns its Escape and save behavior. Do not let the
    // bubbled event close the whole editor modal.
    if (target === dom.bodyEditor) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!dom.entityModal.classList.contains("is-hidden")) dom.entityForm.requestSubmit();
      else {
        saveImmediately();
        toast("この端末に保存しました。");
      }
      return;
    }
    if (event.key === "Escape") {
      if (isModalOpen()) {
        closeAllModals();
        return;
      }
      if (dom.sidebar.classList.contains("is-open")) {
        closeMobileSidebar();
        return;
      }
      const currentTime = Date.now();
      if (currentTime - lastGlobalEscape < 500) clearFilters();
      lastGlobalEscape = currentTime;
      return;
    }
    if (isTyping || isModalOpen() || event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "j") moveSelection(1);
    else if (event.key === "k") moveSelection(-1);
    else if (event.key === "Enter" && state.activeEntityId) focusInspectorTitle();
    else if (event.key.toLowerCase() === "n") createEntityInInspector();
    else if (event.key.toLowerCase() === "d") setView("database");
    else if (event.key.toLowerCase() === "b") setView("board");
    else if (event.key === "/") {
      event.preventDefault();
      dom.search.focus();
      dom.search.select();
    } else if (event.key === ":") {
      event.preventDefault();
      openCommand(":");
    } else if (event.key === "?") {
      event.preventDefault();
      openHelp();
    }
  });

  window.addEventListener("beforeunload", saveImmediately);
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      state = normalizeState(JSON.parse(event.newValue));
      renderAll();
      toast("別のタブでの変更を反映しました。", "↻");
    } catch {
      // Ignore invalid cross-tab payloads.
    }
  });

  renderAll();
  saveImmediately();
})();
