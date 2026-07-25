"use strict";

// Project, entity, column, image, import, and export operations.

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
  if (!dom.relationEditor.classList.contains("is-hidden")) closeRelationEditor();
  state.activeProjectId = id;
  state.activeEntityId = null;
  state.settings.query = "";
  state.settings.listFilters = {};
  closeMobileSidebar();
  renderAll();
  markChanged("プロジェクトを切り替えました");
}

function setView(view) {
  if (!["database", "board"].includes(view)) return;
  if (view !== "board" && !dom.relationEditor.classList.contains("is-hidden")) {
    closeRelationEditor();
  }
  state.settings.view = view;
  renderHeader();
  renderViewState();
  if (view === "board") renderBoard();
  markChanged(view === "database" ? "データベース表示" : "ボード表示");
}

function clearFilters() {
  state.settings.query = "";
  state.settings.listFilters = {};
  renderAll();
  markChanged("絞り込みを解除しました");
}

function updateListFilter(columnId, optionId, checked) {
  const column = activeProject().columns.find(
    (candidate) => candidate.id === columnId && candidate.kind === "list",
  );
  if (!column?.options.some((option) => option.id === optionId)) return;
  const filters =
    state.settings.listFilters && typeof state.settings.listFilters === "object"
      ? state.settings.listFilters
      : {};
  const selected = new Set(Array.isArray(filters[columnId]) ? filters[columnId] : []);
  if (checked) selected.add(optionId);
  else selected.delete(optionId);
  if (selected.size) filters[columnId] = [...selected];
  else delete filters[columnId];
  state.settings.listFilters = filters;
  renderFilters();
  $(
    `[data-list-filter-column="${CSS.escape(columnId)}"]`,
    dom.listFilterBar,
  )?.closest("details")?.setAttribute("open", "");
  renderDatabase();
  renderBoard();
  markChanged("リストで絞り込みました");
}

function clearListFilters() {
  state.settings.listFilters = {};
  renderFilters();
  renderDatabase();
  renderBoard();
  markChanged("リストの絞り込みを解除しました");
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

function addListOptionEditorRow(option = {}, { focus = true } = {}) {
  $("#column-list-options").insertAdjacentHTML("beforeend", listOptionEditorRowMarkup(option));
  const row = $("#column-list-options").lastElementChild;
  databaseColumnEditorDirty = true;
  syncListOptionEditorEmptyState();
  if (focus) $(".list-option-name", row)?.focus();
}

function syncListOptionEditorEmptyState() {
  $("#column-list-empty").classList.toggle(
    "is-hidden",
    Boolean($("[data-list-option-row]", $("#column-list-options"))),
  );
}

function columnEditorKind() {
  return $('input[name="column-kind"]:checked', $("#column-kind"))?.value || "text";
}

function updateColumnListSettingsVisibility() {
  const kind = columnEditorKind();
  $("#column-list-settings").classList.toggle("is-hidden", kind !== "list");
  $("#column-kind-help").textContent =
    {
      text: "各項目に1行の文字を直接入力します。",
      list: "候補を作成すると、DB と Board の両方で絞り込めます。",
    }[kind] || "";
  syncListOptionEditorEmptyState();
}

function renderColumnManagerList(activeId = "") {
  const columns = activeProject().columns;
  $("#column-manager-list").innerHTML = columns.length
    ? columns
        .map(
          (column, index) => `
            <div class="column-manager-item ${column.id === activeId ? "is-active" : ""}">
              <button
                type="button"
                class="column-manager-select"
                data-select-managed-column="${escapeHTML(column.id)}"
                aria-label="${escapeHTML(column.label)}を編集"
              >
                <strong>${escapeHTML(column.label)}</strong>
                <small>${escapeHTML(columnKindLabel(column.kind))}</small>
              </button>
              <button
                type="button"
                class="column-manager-move"
                data-move-managed-column="${escapeHTML(column.id)}"
                data-move-direction="-1"
                aria-label="${escapeHTML(column.label)}を前へ移動"
                title="前へ移動"
                ${index === 0 ? "disabled" : ""}
              >↑</button>
              <button
                type="button"
                class="column-manager-move"
                data-move-managed-column="${escapeHTML(column.id)}"
                data-move-direction="1"
                aria-label="${escapeHTML(column.label)}を後へ移動"
                title="後へ移動"
                ${index === columns.length - 1 ? "disabled" : ""}
              >↓</button>
            </div>`,
        )
        .join("")
    : `<p class="column-manager-empty">列はまだありません。<br />右上の ＋ から追加できます。</p>`;
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
  $("#column-modal-title").textContent = "列を管理";
  $("#column-editor-eyebrow").textContent = column ? "EDIT COLUMN" : "NEW COLUMN";
  $("#column-editor-heading").textContent = column ? `「${column.label}」を編集` : "新しい列を追加";
  $("#delete-column-button").classList.toggle("is-hidden", !column);
  renderColumnManagerList(column?.id || "");
  updateColumnListSettingsVisibility();
  databaseColumnEditorDirty = false;
  dom.columnModal.classList.remove("is-hidden");
  window.setTimeout(() => $("#column-name").focus(), 30);
}

function closeDatabaseColumnModal() {
  dom.columnModal.classList.add("is-hidden");
}

function submitDatabaseColumn(event) {
  event.preventDefault();
  saveDatabaseColumnEditor({ close: true });
}

function saveDatabaseColumnEditor({ close = false, quiet = false } = {}) {
  const project = activeProject();
  const id = $("#column-id").value;
  const existing = id
    ? project.columns.find((candidate) => candidate.id === id)
    : null;
  const label = $("#column-name").value.trim();
  if (!label) {
    $("#column-name").reportValidity();
    return false;
  }
  const requestedKind = columnEditorKind();
  const kind = requestedKind === "list" ? "list" : "text";
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
  $("#column-id").value = column.id;
  $("#column-editor-eyebrow").textContent = "EDIT COLUMN";
  $("#column-editor-heading").textContent = `「${label}」を編集`;
  $("#delete-column-button").classList.remove("is-hidden");

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
  const validOptionIds = new Set(options.map((option) => option.id));
  const selectedFilters = state.settings.listFilters?.[column.id];
  if (kind !== "list" || !Array.isArray(selectedFilters)) {
    if (state.settings.listFilters) delete state.settings.listFilters[column.id];
  } else {
    const validFilters = selectedFilters.filter((optionId) => validOptionIds.has(optionId));
    if (validFilters.length) state.settings.listFilters[column.id] = validFilters;
    else delete state.settings.listFilters[column.id];
  }
  updateProjectTimestamp();
  databaseColumnEditorDirty = false;
  if (close) closeDatabaseColumnModal();
  renderAll();
  markChanged(existing ? "DB列を更新しました" : "DB列を追加しました");
  if (!quiet) {
    toast(existing ? `列「${label}」を更新しました。` : `列「${label}」を追加しました。`);
  }
  return true;
}

function switchDatabaseColumnEditor(id = null) {
  if (databaseColumnEditorDirty && !saveDatabaseColumnEditor({ quiet: true })) return;
  openDatabaseColumnModal(id);
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
  if (!dom.columnModal.classList.contains("is-hidden")) {
    renderColumnManagerList($("#column-id").value);
  }
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

function deleteDatabaseColumn(id, { keepEditorOpen = false } = {}) {
  const project = activeProject();
  const deletedIndex = project.columns.findIndex((candidate) => candidate.id === id);
  const column = project.columns.find((candidate) => candidate.id === id);
  if (!column) return false;
  if (!window.confirm(`列「${column.label || "名称未設定"}」を削除しますか？\nこの列に入力した値も削除されます。`)) return false;
  project.columns = project.columns.filter((candidate) => candidate.id !== id);
  if (state.settings.listFilters) delete state.settings.listFilters[id];
  project.entities.forEach((item) => {
    delete item.fields[id];
  });
  updateProjectTimestamp();
  if (!keepEditorOpen) closeDatabaseColumnModal();
  renderAll();
  if (keepEditorOpen) {
    const nextColumn = project.columns[Math.min(deletedIndex, project.columns.length - 1)];
    openDatabaseColumnModal(nextColumn?.id || null);
  }
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
  $("#relation-memo-default").value = "";
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
  const relationMemo = $("#relation-memo-default").value.trim();
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
        memo: relationMemo || oldLink?.memo || "",
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

function deleteEntityById(id, { closeEntityEditor = false } = {}) {
  const item = getEntityById(id);
  if (!item) return false;
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
  if (closeEntityEditor) closeEntityModal();
  if (
    dom.relationEditor.dataset.sourceId === id ||
    dom.relationEditor.dataset.targetId === id
  ) {
    closeRelationEditor();
  }
  renderAll();
  markChanged("項目を削除しました");
  toast(`「${item.title}」を削除しました。`, "−");
  return true;
}

function deleteCurrentEntity() {
  deleteEntityById($("#entity-id").value, { closeEntityEditor: true });
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
