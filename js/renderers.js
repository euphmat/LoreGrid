"use strict";

// DOM rendering for projects, database, board, inspector, and view state.

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
  $("#database-column-summary").textContent = columns.length
    ? `${columns.length}列 · ${columns.map((column) => column.label).join("、")}`
    : "列はまだありません";
  dom.tableHead.innerHTML = `
    <tr>
      <th class="col-marker"><span class="sr-only">選択</span></th>
      <th data-sort="title">Name <span class="sort-indicator">↕</span></th>
      ${columns
        .map(
          (column) => `
            <th
              class="custom-column-header"
              data-column-id="${escapeHTML(column.id)}"
            >
              <div class="custom-column-display">
                <span class="column-drag-handle" draggable="true" title="ドラッグして並べ替え">⠿</span>
                <button
                  type="button"
                  class="column-heading-copy"
                  data-edit-db-column="${escapeHTML(column.id)}"
                  title="${escapeHTML(column.label)}を編集"
                >
                  <strong>${escapeHTML(column.label)}</strong>
                  <small>${escapeHTML(columnKindLabel(column.kind))}</small>
                </button>
                <div class="column-header-actions">
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
    const hasFilter = Boolean(state.settings.query) || hasActiveListFilters();
    dom.emptyState.innerHTML = `
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
      <strong>${hasFilter ? "一致する項目がありません" : "最初のロアを記録しましょう"}</strong>
      <p>${hasFilter ? "検索語やリストの選択を変えてみてください。" : "DB列を自分で定義して、項目を整理できます。"}</p>
      <button class="secondary-button" id="${hasFilter ? "empty-clear-filter" : "empty-add-entity"}">
        ${hasFilter ? "絞り込みを解除" : "項目を追加"}
      </button>`;
  }
  addImageFallbacks(dom.databaseView);
}

function columnKindOptions(selected) {
  const activeKind = selected === "list" ? "list" : "text";
  return [
    {
      value: "text",
      label: "テキスト",
      description: "名称、URL、短いメモなどを自由入力",
      icon: "T",
    },
    {
      value: "list",
      label: "リスト",
      description: "色付き候補から選択・フィルター対応",
      icon: "≡",
    },
  ]
    .map(
      ({ value, label, description, icon }) => `
        <label class="column-kind-option">
          <input
            type="radio"
            name="column-kind"
            value="${value}"
            ${activeKind === value ? "checked" : ""}
          />
          <span class="column-kind-icon" aria-hidden="true">${icon}</span>
          <span class="column-kind-copy">
            <strong>${label}</strong>
            <small>${description}</small>
          </span>
          <span class="column-kind-check" aria-hidden="true">✓</span>
        </label>`,
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
      const combinedLabel = link.memo || "Memoを追加";
      const safeLabel = combinedLabel.replace(/\s+/g, " ").slice(0, 28);
      const labelWidth = Math.max(42, safeLabel.length * 9 + 12);
      const markerStart = ["start", "both"].includes(link.arrow)
        ? 'marker-start="url(#relation-arrow)"'
        : "";
      const markerEnd = ["end", "both"].includes(link.arrow)
        ? 'marker-end="url(#relation-arrow)"'
        : "";
      return `
        <g
          class="${
            dom.relationEditor.dataset.sourceId === source.id &&
            dom.relationEditor.dataset.targetId === target.id
              ? "is-editing"
              : ""
          }"
          data-relation-source="${escapeHTML(source.id)}"
          data-relation-target="${escapeHTML(target.id)}"
        >
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
        <span class="board-group-kicker"><i aria-hidden="true"></i>ORGANISATION</span>
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
            ${boardListBadgesMarkup(item)}
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

function boardListBadgesMarkup(item) {
  const badges = activeProject().columns
    .filter((column) => column.kind === "list")
    .map((column) => listOptionForValue(column, item.fields?.[column.id]))
    .filter(Boolean)
    .slice(0, 3);
  if (!badges.length) return "";
  return `<div class="board-card-tags">
    ${badges
      .map(
        (option) =>
          `<span style="--list-color:${escapeHTML(option.color)}">${escapeHTML(option.label)}</span>`,
      )
      .join("")}
  </div>`;
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
          <span class="organisation-badge" aria-hidden="true">
            <i></i><b>ORG</b>
          </span>
          <span class="organisation-copy">
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
  const listColumns = activeProject().columns.filter(
    (column) => column.kind === "list" && column.options?.length,
  );
  if (!listColumns.length) {
    dom.listFilterBar.innerHTML = "";
    dom.listFilterBar.classList.add("is-hidden");
    return;
  }
  dom.listFilterBar.classList.remove("is-hidden");
  dom.listFilterBar.innerHTML = `
    <span class="list-filter-label">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16l-6 7v5l-4 2v-7L4 6Z"></path></svg>
      リスト
    </span>
    <div class="list-filter-controls">
      ${listColumns.map((column) => listFilterControlMarkup(column)).join("")}
    </div>
    <button
      id="clear-list-filters"
      class="clear-list-filters ${hasActiveListFilters() ? "" : "is-hidden"}"
      type="button"
    >すべて解除</button>`;
}

function activeListFilterValues(column) {
  const selected = state.settings.listFilters?.[column.id];
  if (!Array.isArray(selected)) return [];
  const validIds = new Set((column.options || []).map((option) => option.id));
  return selected.filter((optionId) => validIds.has(optionId));
}

function hasActiveListFilters() {
  return activeProject().columns
    .filter((column) => column.kind === "list")
    .some((column) => activeListFilterValues(column).length);
}

function listFilterControlMarkup(column) {
  const selected = activeListFilterValues(column);
  const selectedOptions = column.options.filter((option) => selected.includes(option.id));
  const summary =
    selectedOptions.length === 1
      ? selectedOptions[0].label
      : selectedOptions.length > 1
        ? `${selectedOptions.length}件を選択`
        : "すべて";
  return `
    <details class="list-filter-control ${selected.length ? "is-active" : ""}">
      <summary>
        <span>${escapeHTML(column.label)}</span>
        <strong>${escapeHTML(summary)}</strong>
        <i aria-hidden="true"></i>
      </summary>
      <div class="list-filter-menu">
        <div class="list-filter-menu-heading">
          <strong>${escapeHTML(column.label)}</strong>
          <small>複数選択できます</small>
        </div>
        ${column.options
          .map((option) => {
            const count = activeProject().entities.filter(
              (item) => String(item.fields?.[column.id] ?? "") === option.id,
            ).length;
            return `
              <label class="list-filter-option" style="--list-color:${escapeHTML(option.color)}">
                <input
                  type="checkbox"
                  data-list-filter-column="${escapeHTML(column.id)}"
                  data-list-filter-option="${escapeHTML(option.id)}"
                  ${selected.includes(option.id) ? "checked" : ""}
                />
                <span class="list-filter-dot" aria-hidden="true"></span>
                <span>${escapeHTML(option.label)}</span>
                <small>${count}</small>
              </label>`;
          })
          .join("")}
      </div>
    </details>`;
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
