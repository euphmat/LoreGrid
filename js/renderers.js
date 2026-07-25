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
                ${item.epithet
                  ? `<small class="entity-epithet">${escapeHTML(item.epithet)}</small>`
                  : ""}
              </span>
            </div>
          </td>
          ${columns
            .map(
              (column) =>
                `<td class="db-edit-cell">${dbFieldEditorMarkup(column, item)}</td>`,
            )
            .join("")}
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

function dbListPickerMarkup(column, item, value) {
  const current = value === undefined || value === null ? "" : String(value);
  const selectedOption = listOptionForValue(column, current);
  const currentLabel = selectedOption?.label || current || "未選択";
  const currentColor = selectedOption?.color || "#777B85";
  const options = Array.isArray(column.options) ? [...column.options] : [];
  const availableOptions =
    current && !selectedOption
      ? [{ id: current, label: current, color: "#777B85" }, ...options]
      : options;
  const newOptionColor =
    COLOR_PALETTE[(options.length * 3 + 20) % COLOR_PALETTE.length];
  return `
    <div
      class="db-list-picker"
      data-db-list-picker
      data-db-entity="${escapeHTML(item.id)}"
      data-db-field="${escapeHTML(column.id)}"
    >
      <button
        type="button"
        class="db-list-trigger ${current ? "" : "is-empty"}"
        data-db-list-trigger
        data-db-field="${escapeHTML(column.id)}"
        data-db-entity="${escapeHTML(item.id)}"
        value="${escapeHTML(selectedOption?.id || current)}"
        style="--list-color:${escapeHTML(currentColor)}"
        aria-label="${escapeHTML(column.label)}：${escapeHTML(currentLabel)}"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <span class="db-list-color" aria-hidden="true"></span>
        <span class="db-list-current">${escapeHTML(currentLabel)}</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"></path></svg>
      </button>
      <div
        class="db-list-menu is-hidden"
        data-db-list-menu
      >
        <div
          class="db-list-options"
          role="listbox"
          aria-label="${escapeHTML(column.label)}の候補"
        >
          ${availableOptions
            .map(
              (option) => `
                <button
                  type="button"
                  class="db-list-option"
                  data-db-list-option="${escapeHTML(option.id)}"
                  style="--list-color:${escapeHTML(option.color)}"
                  role="option"
                  aria-selected="${String(option.id === (selectedOption?.id || current))}"
                >
                  <span class="db-list-option-dot" aria-hidden="true"></span>
                  <span>${escapeHTML(option.label)}</span>
                  <span class="db-list-option-check" aria-hidden="true">✓</span>
                </button>`,
            )
            .join("")}
          <button
            type="button"
            class="db-list-option db-list-clear"
            data-db-list-option=""
            role="option"
            aria-selected="${String(!current)}"
          >
            <span class="db-list-option-dot" aria-hidden="true"></span>
            <span>未選択に戻す</span>
            <span class="db-list-option-check" aria-hidden="true">✓</span>
          </button>
        </div>
        <form class="db-list-quick-add" data-db-list-quick-add>
          <span class="db-list-quick-add-title">新しい項目を追加</span>
          <div class="db-list-quick-add-controls">
            <div class="db-list-quick-color-picker">
              <button
                type="button"
                class="db-list-quick-color"
                data-db-list-color-trigger
                style="--selected-color:${escapeHTML(newOptionColor)}"
                title="32色から項目の色を選択"
                aria-label="32色から項目の色を選択"
                aria-expanded="false"
              ><span aria-hidden="true"></span></button>
              <div
                class="db-list-quick-palette is-hidden"
                data-db-list-quick-palette
                role="group"
                aria-label="項目カラー32色"
              >
                ${COLOR_PALETTE.map(
                  (color) => `
                    <button
                      type="button"
                      data-db-list-new-color-choice="${escapeHTML(color)}"
                      style="--swatch-color:${escapeHTML(color)}"
                      aria-label="${escapeHTML(color)}を選択"
                      aria-pressed="${String(color === newOptionColor)}"
                    ></button>`,
                ).join("")}
              </div>
              <input
                type="hidden"
                value="${escapeHTML(newOptionColor)}"
                data-db-list-new-color
              />
            </div>
            <input
              type="text"
              maxlength="40"
              placeholder="項目名を入力"
              autocomplete="off"
              data-db-list-new-label
              aria-label="${escapeHTML(column.label)}へ追加する項目名"
            />
            <button type="submit" class="db-list-quick-add-button">追加</button>
          </div>
          <small
            class="db-list-quick-add-error"
            data-db-list-new-error
            aria-live="polite"
          ></small>
        </form>
      </div>
    </div>`;
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
    return dbListPickerMarkup(column, item, value);
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

function boardExtentSize(item) {
  if (item.organisation) {
    return { width: item.groupWidth, height: item.groupHeight };
  }
  return {
    width: BOARD_CARD_WIDTH,
    height: item.imageId || item.image
      ? BOARD_CARD_IMAGE_HEIGHT
      : BOARD_CARD_HEIGHT,
  };
}

function calculateBoardCanvasMetrics() {
  const zoom = Number(state.settings.boardZoom) || 1;
  const paddingX = Math.max(
    BOARD_EDGE_PADDING_X,
    (Number(dom.boardViewport.clientWidth) || 0) / zoom,
  );
  const paddingY = Math.max(
    BOARD_EDGE_PADDING_Y,
    (Number(dom.boardViewport.clientHeight) || 0) / zoom,
  );
  const entities = activeProject().entities;
  let minimumX = 0;
  let minimumY = 0;
  let maximumX = BOARD_MIN_WIDTH;
  let maximumY = BOARD_MIN_HEIGHT;
  if (entities.length) {
    minimumX = Number.POSITIVE_INFINITY;
    minimumY = Number.POSITIVE_INFINITY;
    maximumX = Number.NEGATIVE_INFINITY;
    maximumY = Number.NEGATIVE_INFINITY;
    entities.forEach((item) => {
      const size = boardExtentSize(item);
      minimumX = Math.min(minimumX, item.x);
      minimumY = Math.min(minimumY, item.y);
      maximumX = Math.max(maximumX, item.x + size.width);
      maximumY = Math.max(maximumY, item.y + size.height);
    });
  }
  const originX =
    Math.floor((minimumX - paddingX) / BOARD_GRID_SIZE) * BOARD_GRID_SIZE;
  const originY =
    Math.floor((minimumY - paddingY) / BOARD_GRID_SIZE) * BOARD_GRID_SIZE;
  const focusItem = activeEntity() || entities[0] || null;
  return {
    originX,
    originY,
    width: ceilToBoardGrid(maximumX + paddingX - originX),
    height: ceilToBoardGrid(maximumY + paddingY - originY),
    focusX: focusItem ? focusItem.x - 120 : 0,
    focusY: focusItem ? focusItem.y - 90 : 0,
  };
}

function updateBoardCanvasMetrics() {
  const previousOriginX = boardOriginX;
  const previousOriginY = boardOriginY;
  const projectChanged = boardMetricsProjectId !== state.activeProjectId;
  const metrics = calculateBoardCanvasMetrics();
  boardOriginX = metrics.originX;
  boardOriginY = metrics.originY;
  boardCanvasWidth = metrics.width;
  boardCanvasHeight = metrics.height;
  dom.boardCanvas.style.width = `${boardCanvasWidth}px`;
  dom.boardCanvas.style.height = `${boardCanvasHeight}px`;
  dom.boardCards.style.transform =
    `translate3d(${-boardOriginX}px, ${-boardOriginY}px, 0)`;
  const zoom = Number(state.settings.boardZoom) || 1;
  if (projectChanged) {
    dom.boardViewport.scrollLeft = Math.max(
      0,
      (metrics.focusX - boardOriginX) * zoom,
    );
    dom.boardViewport.scrollTop = Math.max(
      0,
      (metrics.focusY - boardOriginY) * zoom,
    );
  } else {
    dom.boardViewport.scrollLeft += (previousOriginX - boardOriginX) * zoom;
    dom.boardViewport.scrollTop += (previousOriginY - boardOriginY) * zoom;
  }
  boardMetricsProjectId = state.activeProjectId;
}

const RELATION_ANCHORS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const DIAGONAL_RELATION_ANCHORS = new Set(["nw", "ne", "se", "sw"]);
const ORTHOGONAL_RELATION_ANCHORS = ["n", "e", "s", "w"];

function anchorPoint(item, anchor) {
  const { width, height } = boardExtentSize(item);
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

function closestRelationAnchorPair(
  source,
  target,
  preferredSourceAnchor = "e",
  preferredTargetAnchor = "w",
) {
  const initialSourceAnchor = ORTHOGONAL_RELATION_ANCHORS.includes(preferredSourceAnchor)
    ? preferredSourceAnchor
    : "e";
  const initialTargetAnchor = ORTHOGONAL_RELATION_ANCHORS.includes(preferredTargetAnchor)
    ? preferredTargetAnchor
    : "w";
  const initialSourcePoint = anchorPoint(source, initialSourceAnchor);
  const initialTargetPoint = anchorPoint(target, initialTargetAnchor);
  const initialDx = initialTargetPoint.x - initialSourcePoint.x;
  const initialDy = initialTargetPoint.y - initialSourcePoint.y;
  let closest = {
    sourceAnchor: initialSourceAnchor,
    targetAnchor: initialTargetAnchor,
    distanceSquared: initialDx * initialDx + initialDy * initialDy,
    diagonalCount:
      Number(DIAGONAL_RELATION_ANCHORS.has(initialSourceAnchor)) +
      Number(DIAGONAL_RELATION_ANCHORS.has(initialTargetAnchor)),
    preservesPreferredPair: true,
  };
  ORTHOGONAL_RELATION_ANCHORS.forEach((sourceAnchor) => {
    const sourcePoint = anchorPoint(source, sourceAnchor);
    ORTHOGONAL_RELATION_ANCHORS.forEach((targetAnchor) => {
      const targetPoint = anchorPoint(target, targetAnchor);
      const dx = targetPoint.x - sourcePoint.x;
      const dy = targetPoint.y - sourcePoint.y;
      const distanceSquared = dx * dx + dy * dy;
      const diagonalCount =
        Number(DIAGONAL_RELATION_ANCHORS.has(sourceAnchor)) +
        Number(DIAGONAL_RELATION_ANCHORS.has(targetAnchor));
      if (
        distanceSquared < closest.distanceSquared ||
        (
          distanceSquared === closest.distanceSquared &&
          !closest.preservesPreferredPair &&
          diagonalCount < closest.diagonalCount
        )
      ) {
        closest = {
          sourceAnchor,
          targetAnchor,
          distanceSquared,
          diagonalCount,
          preservesPreferredPair: false,
        };
      }
    });
  });
  return closest;
}

function compactOrthogonalPoints(points) {
  const compact = [];
  points.forEach((point) => {
    const previous = compact.at(-1);
    if (previous?.x === point.x && previous?.y === point.y) return;
    compact.push({ x: point.x, y: point.y });
    if (compact.length < 3) return;
    const a = compact.at(-3);
    const b = compact.at(-2);
    const c = compact.at(-1);
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
      compact.splice(compact.length - 2, 1);
    }
  });
  return compact;
}

function orthogonalSegments(points) {
  return points.slice(1).map((point, index) => ({
    a: points[index],
    b: point,
  }));
}

function segmentLength(segment) {
  return Math.abs(segment.b.x - segment.a.x) + Math.abs(segment.b.y - segment.a.y);
}

function segmentIntersectsRect(segment, rect) {
  if (segment.a.x === segment.b.x) {
    const x = segment.a.x;
    const top = Math.min(segment.a.y, segment.b.y);
    const bottom = Math.max(segment.a.y, segment.b.y);
    return (
      x > rect.left &&
      x < rect.right &&
      bottom > rect.top &&
      top < rect.bottom
    );
  }
  const y = segment.a.y;
  const left = Math.min(segment.a.x, segment.b.x);
  const right = Math.max(segment.a.x, segment.b.x);
  return (
    y > rect.top &&
    y < rect.bottom &&
    right > rect.left &&
    left < rect.right
  );
}

function relationObstacleRects(items) {
  return items
    .filter((item) => !item.organisation)
    .map((item) => {
      const rect = boardRectFor(item);
      const clearance = BOARD_GRID_SIZE / 2;
      return {
        item,
        left: rect.left - clearance,
        top: rect.top - clearance,
        right: rect.right + clearance,
        bottom: rect.bottom + clearance,
      };
    });
}

function pointEquals(first, second) {
  return first.x === second.x && first.y === second.y;
}

function segmentIntersectionKind(first, second) {
  const firstHorizontal = first.a.y === first.b.y;
  const secondHorizontal = second.a.y === second.b.y;
  if (firstHorizontal !== secondHorizontal) {
    const horizontal = firstHorizontal ? first : second;
    const vertical = firstHorizontal ? second : first;
    const x = vertical.a.x;
    const y = horizontal.a.y;
    const withinHorizontal =
      x >= Math.min(horizontal.a.x, horizontal.b.x) &&
      x <= Math.max(horizontal.a.x, horizontal.b.x);
    const withinVertical =
      y >= Math.min(vertical.a.y, vertical.b.y) &&
      y <= Math.max(vertical.a.y, vertical.b.y);
    return withinHorizontal && withinVertical
      ? { kind: "cross", point: { x, y } }
      : null;
  }
  const firstAxis = firstHorizontal ? first.a.y : first.a.x;
  const secondAxis = secondHorizontal ? second.a.y : second.a.x;
  if (firstAxis !== secondAxis) return null;
  const firstStart = firstHorizontal
    ? Math.min(first.a.x, first.b.x)
    : Math.min(first.a.y, first.b.y);
  const firstEnd = firstHorizontal
    ? Math.max(first.a.x, first.b.x)
    : Math.max(first.a.y, first.b.y);
  const secondStart = secondHorizontal
    ? Math.min(second.a.x, second.b.x)
    : Math.min(second.a.y, second.b.y);
  const secondEnd = secondHorizontal
    ? Math.max(second.a.x, second.b.x)
    : Math.max(second.a.y, second.b.y);
  const overlapStart = Math.max(firstStart, secondStart);
  const overlapEnd = Math.min(firstEnd, secondEnd);
  if (overlapStart > overlapEnd) return null;
  const point = firstHorizontal
    ? { x: overlapStart, y: firstAxis }
    : { x: firstAxis, y: overlapStart };
  return {
    kind: overlapStart === overlapEnd ? "touch" : "overlap",
    point,
  };
}

function sharedRelationEndpoint(point, candidate, routed) {
  const candidateEndpoints = [candidate[0], candidate.at(-1)];
  const routedEndpoints = [routed.points[0], routed.points.at(-1)];
  return (
    candidateEndpoints.some((endpoint) => pointEquals(endpoint, point)) &&
    routedEndpoints.some((endpoint) => pointEquals(endpoint, point))
  );
}

function relationRouteScore(points, source, target, obstacles, routedRoutes) {
  const segments = orthogonalSegments(points);
  let obstacleHits = 0;
  segments.forEach((segment, segmentIndex) => {
    obstacles.forEach((obstacle) => {
      if (
        (obstacle.item.id === source.id && segmentIndex === 0) ||
        (obstacle.item.id === target.id && segmentIndex === segments.length - 1)
      ) {
        return;
      }
      if (segmentIntersectsRect(segment, obstacle)) obstacleHits += 1;
    });
  });
  let crossings = 0;
  let overlaps = 0;
  routedRoutes.forEach((routed) => {
    segments.forEach((segment) => {
      routed.segments.forEach((otherSegment) => {
        const intersection = segmentIntersectionKind(segment, otherSegment);
        if (
          !intersection ||
          (
            intersection.kind !== "overlap" &&
            sharedRelationEndpoint(intersection.point, points, routed)
          )
        ) {
          return;
        }
        if (intersection.kind === "overlap") overlaps += 1;
        else crossings += 1;
      });
    });
  });
  const length = segments.reduce((sum, segment) => sum + segmentLength(segment), 0);
  const bends = Math.max(0, points.length - 2);
  return (
    obstacleHits * 1_000_000_000 +
    crossings * 10_000_000 +
    overlaps * 20_000_000 +
    bends * BOARD_GRID_SIZE * 2 +
    length
  );
}

function limitedRoutingChannels(values, center, minimum, maximum, routeIndex) {
  const unique = [...new Set(values.map(snapToBoardGrid))];
  const nearby = unique
    .sort((a, b) => Math.abs(a - center) - Math.abs(b - center))
    .slice(0, 12);
  const laneOffset = (routeIndex + 2) * BOARD_GRID_SIZE;
  return [
    ...new Set([
      ...nearby,
      snapToBoardGrid(minimum - laneOffset),
      snapToBoardGrid(maximum + laneOffset),
      snapToBoardGrid(minimum - laneOffset - BOARD_GRID_SIZE),
      snapToBoardGrid(maximum + laneOffset + BOARD_GRID_SIZE),
    ]),
  ];
}

function relationRouteGridNodes(points) {
  const nodes = [];
  orthogonalSegments(points).forEach((segment) => {
    const dx = Math.sign(segment.b.x - segment.a.x) * BOARD_GRID_SIZE;
    const dy = Math.sign(segment.b.y - segment.a.y) * BOARD_GRID_SIZE;
    let x = segment.a.x;
    let y = segment.a.y;
    nodes.push({ x, y });
    while (x !== segment.b.x || y !== segment.b.y) {
      x += dx;
      y += dy;
      nodes.push({ x, y });
    }
  });
  return nodes;
}

function pushRouteQueue(queue, entry) {
  queue.push(entry);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (queue[parent].priority <= entry.priority) break;
    queue[index] = queue[parent];
    index = parent;
  }
  queue[index] = entry;
}

function popRouteQueue(queue) {
  const first = queue[0];
  const last = queue.pop();
  if (!queue.length) return first;
  let index = 0;
  queue[0] = last;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    if (
      left < queue.length &&
      queue[left].priority < queue[smallest].priority
    ) {
      smallest = left;
    }
    if (
      right < queue.length &&
      queue[right].priority < queue[smallest].priority
    ) {
      smallest = right;
    }
    if (smallest === index) break;
    [queue[index], queue[smallest]] = [queue[smallest], queue[index]];
    index = smallest;
  }
  return first;
}

function reconstructGridRoute(cameFrom, states, endKey) {
  const points = [];
  let key = endKey;
  while (key) {
    const state = states.get(key);
    if (!state) break;
    points.push({ x: state.x, y: state.y });
    key = cameFrom.get(key);
  }
  return points.reverse();
}

function findCrossingFreeGridRoute(
  source,
  target,
  items,
  routedRoutes,
  routeIndex,
) {
  const obstacles = relationObstacleRects(items);
  const occupied = new Set();
  routedRoutes.forEach((route) => {
    relationRouteGridNodes(route.points).forEach((point) =>
      occupied.add(`${point.x}:${point.y}`),
    );
  });
  const extentPoints = [
    ...items.flatMap((item) => {
      const rect = boardRectFor(item);
      return [
        { x: rect.left, y: rect.top },
        { x: rect.right, y: rect.bottom },
      ];
    }),
    ...routedRoutes.flatMap((route) => route.points),
  ];
  const margin = (12 + routeIndex * 2) * BOARD_GRID_SIZE;
  const minimumX =
    Math.min(...extentPoints.map((point) => point.x)) - margin;
  const maximumX =
    Math.max(...extentPoints.map((point) => point.x)) + margin;
  const minimumY =
    Math.min(...extentPoints.map((point) => point.y)) - margin;
  const maximumY =
    Math.max(...extentPoints.map((point) => point.y)) + margin;
  const directions = [
    { id: "n", dx: 0, dy: -BOARD_GRID_SIZE },
    { id: "e", dx: BOARD_GRID_SIZE, dy: 0 },
    { id: "s", dx: 0, dy: BOARD_GRID_SIZE },
    { id: "w", dx: -BOARD_GRID_SIZE, dy: 0 },
  ];
  let best = null;
  ORTHOGONAL_RELATION_ANCHORS.forEach((sourceAnchor) => {
    ORTHOGONAL_RELATION_ANCHORS.forEach((targetAnchor) => {
      const start = anchorPoint(source, sourceAnchor);
      const end = anchorPoint(target, targetAnchor);
      const sourceVector = anchorVector(sourceAnchor);
      const targetVector = anchorVector(targetAnchor);
      const startPort = {
        x: start.x + sourceVector[0] * BOARD_GRID_SIZE,
        y: start.y + sourceVector[1] * BOARD_GRID_SIZE,
      };
      const endPort = {
        x: end.x + targetVector[0] * BOARD_GRID_SIZE,
        y: end.y + targetVector[1] * BOARD_GRID_SIZE,
      };
      if (
        occupied.has(`${startPort.x}:${startPort.y}`) ||
        occupied.has(`${endPort.x}:${endPort.y}`)
      ) {
        return;
      }
      const queue = [];
      const costs = new Map();
      const cameFrom = new Map();
      const states = new Map();
      const startKey = `${startPort.x}:${startPort.y}:start`;
      costs.set(startKey, 0);
      states.set(startKey, { ...startPort, direction: "start" });
      pushRouteQueue(queue, {
        key: startKey,
        priority:
          (Math.abs(endPort.x - startPort.x) +
            Math.abs(endPort.y - startPort.y)) /
          BOARD_GRID_SIZE,
      });
      let completedKey = "";
      while (queue.length) {
        const currentEntry = popRouteQueue(queue);
        const current = states.get(currentEntry.key);
        const currentCost = costs.get(currentEntry.key);
        if (current.x === endPort.x && current.y === endPort.y) {
          completedKey = currentEntry.key;
          break;
        }
        directions.forEach((direction) => {
          const next = {
            x: current.x + direction.dx,
            y: current.y + direction.dy,
            direction: direction.id,
          };
          if (
            next.x < minimumX ||
            next.x > maximumX ||
            next.y < minimumY ||
            next.y > maximumY
          ) {
            return;
          }
          const coordinateKey = `${next.x}:${next.y}`;
          if (occupied.has(coordinateKey)) return;
          if (
            obstacles.some(
              (rect) =>
                next.x > rect.left &&
                next.x < rect.right &&
                next.y > rect.top &&
                next.y < rect.bottom,
            )
          ) {
            return;
          }
          const turnCost =
            current.direction === "start" ||
            current.direction === direction.id
              ? 0
              : 0.4;
          const nextCost = currentCost + 1 + turnCost;
          const nextKey = `${next.x}:${next.y}:${direction.id}`;
          if (nextCost >= (costs.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
            return;
          }
          costs.set(nextKey, nextCost);
          cameFrom.set(nextKey, currentEntry.key);
          states.set(nextKey, next);
          const heuristic =
            (Math.abs(endPort.x - next.x) +
              Math.abs(endPort.y - next.y)) /
            BOARD_GRID_SIZE;
          pushRouteQueue(queue, {
            key: nextKey,
            priority: nextCost + heuristic,
          });
        });
      }
      if (!completedKey) return;
      const points = compactOrthogonalPoints([
        start,
        startPort,
        ...reconstructGridRoute(cameFrom, states, completedKey),
        endPort,
        end,
      ]);
      const score = relationRouteScore(
        points,
        source,
        target,
        obstacles,
        routedRoutes,
      );
      if (!best || score < best.score) {
        best = { points, score, sourceAnchor, targetAnchor };
      }
    });
  });
  return best;
}

function routeRelationOrthogonally(
  source,
  target,
  items,
  routedRoutes,
  routeIndex,
) {
  const obstacles = relationObstacleRects(items);
  const allRects = obstacles.length
    ? obstacles
    : [
        {
          left: Math.min(source.x, target.x),
          top: Math.min(source.y, target.y),
          right: Math.max(source.x, target.x),
          bottom: Math.max(source.y, target.y),
        },
      ];
  const minimumX = Math.min(...allRects.map((rect) => rect.left));
  const maximumX = Math.max(...allRects.map((rect) => rect.right));
  const minimumY = Math.min(...allRects.map((rect) => rect.top));
  const maximumY = Math.max(...allRects.map((rect) => rect.bottom));
  let best = null;
  ORTHOGONAL_RELATION_ANCHORS.forEach((sourceAnchor) => {
    ORTHOGONAL_RELATION_ANCHORS.forEach((targetAnchor) => {
      const start = anchorPoint(source, sourceAnchor);
      const end = anchorPoint(target, targetAnchor);
      const startVector = anchorVector(sourceAnchor);
      const endVector = anchorVector(targetAnchor);
      const startPort = {
        x: start.x + startVector[0] * BOARD_GRID_SIZE,
        y: start.y + startVector[1] * BOARD_GRID_SIZE,
      };
      const endPort = {
        x: end.x + endVector[0] * BOARD_GRID_SIZE,
        y: end.y + endVector[1] * BOARD_GRID_SIZE,
      };
      const centerX = (startPort.x + endPort.x) / 2;
      const centerY = (startPort.y + endPort.y) / 2;
      const xChannels = limitedRoutingChannels(
        [
          startPort.x,
          endPort.x,
          centerX,
          ...obstacles.flatMap((rect) => [
            rect.left - BOARD_GRID_SIZE / 2,
            rect.right + BOARD_GRID_SIZE / 2,
          ]),
        ],
        centerX,
        minimumX,
        maximumX,
        routeIndex,
      );
      const yChannels = limitedRoutingChannels(
        [
          startPort.y,
          endPort.y,
          centerY,
          ...obstacles.flatMap((rect) => [
            rect.top - BOARD_GRID_SIZE / 2,
            rect.bottom + BOARD_GRID_SIZE / 2,
          ]),
        ],
        centerY,
        minimumY,
        maximumY,
        routeIndex,
      );
      const candidates = [];
      if (startPort.x === endPort.x || startPort.y === endPort.y) {
        candidates.push([start, startPort, endPort, end]);
      }
      xChannels.forEach((x) => {
        candidates.push([
          start,
          startPort,
          { x, y: startPort.y },
          { x, y: endPort.y },
          endPort,
          end,
        ]);
      });
      yChannels.forEach((y) => {
        candidates.push([
          start,
          startPort,
          { x: startPort.x, y },
          { x: endPort.x, y },
          endPort,
          end,
        ]);
      });
      xChannels.forEach((x) => {
        yChannels.forEach((y) => {
          candidates.push([
            start,
            startPort,
            { x, y: startPort.y },
            { x, y },
            { x: endPort.x, y },
            endPort,
            end,
          ]);
          candidates.push([
            start,
            startPort,
            { x: startPort.x, y },
            { x, y },
            { x, y: endPort.y },
            endPort,
            end,
          ]);
        });
      });
      candidates.forEach((candidate) => {
        const points = compactOrthogonalPoints(candidate);
        const score = relationRouteScore(
          points,
          source,
          target,
          obstacles,
          routedRoutes,
        );
        if (!best || score < best.score) {
          best = { points, score, sourceAnchor, targetAnchor };
        }
      });
    });
  });
  if (best?.score >= 10_000_000 && routedRoutes.length) {
    const gridRoute = findCrossingFreeGridRoute(
      source,
      target,
      items,
      routedRoutes,
      routeIndex,
    );
    if (gridRoute && gridRoute.score < best.score) best = gridRoute;
  }
  return best;
}

function orthogonalPathData(points, radius = 8) {
  if (points.length < 2) return "";
  let path = `M${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (!next) {
      path += ` L${current.x} ${current.y}`;
      continue;
    }
    const previous = points[index - 1];
    const incomingLength = Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
    );
    const outgoingLength = Math.hypot(
      next.x - current.x,
      next.y - current.y,
    );
    const cornerRadius = Math.min(radius, incomingLength / 2, outgoingLength / 2);
    const before = {
      x: current.x - ((current.x - previous.x) / incomingLength) * cornerRadius,
      y: current.y - ((current.y - previous.y) / incomingLength) * cornerRadius,
    };
    const after = {
      x: current.x + ((next.x - current.x) / outgoingLength) * cornerRadius,
      y: current.y + ((next.y - current.y) / outgoingLength) * cornerRadius,
    };
    path += ` L${before.x} ${before.y} Q${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  return path;
}

function relationLabelPoint(points) {
  const segments = orthogonalSegments(points);
  const preferred = segments.slice(1, -1);
  const interior = preferred.length ? preferred : segments;
  const horizontal = interior.filter(
    (segment) => segment.a.y === segment.b.y,
  );
  const pool = horizontal.length ? horizontal : interior;
  const longest = pool.reduce(
    (best, segment) =>
      !best || segmentLength(segment) > segmentLength(best) ? segment : best,
    null,
  );
  return longest
    ? {
        x: (longest.a.x + longest.b.x) / 2,
        y: (longest.a.y + longest.b.y) / 2,
      }
    : points[0];
}

function renderRelationLines(items) {
  const links = getAllRenderableLinks(items);
  const routedRoutes = [];
  dom.relationLines.setAttribute(
    "viewBox",
    `${boardOriginX} ${boardOriginY} ${boardCanvasWidth} ${boardCanvasHeight}`,
  );
  dom.relationLines.innerHTML = `
    <defs>
      <marker id="relation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z"></path>
      </marker>
    </defs>
    ${links.map(({ source, target, link }, routeIndex) => {
      const route = routeRelationOrthogonally(
        source,
        target,
        items,
        routedRoutes,
        routeIndex,
      );
      if (!route) return "";
      link.sourceAnchor = route.sourceAnchor;
      link.targetAnchor = route.targetAnchor;
      const pathData = orthogonalPathData(route.points);
      const labelPoint = relationLabelPoint(route.points);
      const mx = labelPoint.x;
      const my = labelPoint.y;
      routedRoutes.push({
        points: route.points,
        segments: orthogonalSegments(route.points),
      });
      const combinedLabel = link.memo || "Memoを追加";
      const safeLabel = combinedLabel.replace(/\s+/g, " ").slice(0, 28);
      const labelWidth = Math.max(68, safeLabel.length * 9 + 24);
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
          <path class="relation-line-clearance" d="${pathData}" />
          <path class="relation-line-hit" d="${pathData}" />
          <path class="relation-line" d="${pathData}" ${markerStart} ${markerEnd} />
          <rect class="relation-label-bg" x="${mx - labelWidth / 2}" y="${my - 12}" width="${labelWidth}" height="24" rx="12" />
          <text class="relation-label-text" x="${mx}" y="${my + 3}" text-anchor="middle">${escapeHTML(safeLabel)}</text>
        </g>`;
    }).join("")}`;
}

function connectorHandlesMarkup(item) {
  return ORTHOGONAL_RELATION_ANCHORS
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
        ${item.epithet
          ? `<span class="board-group-epithet">${escapeHTML(item.epithet)}</span>`
          : ""}
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
  const layoutChanged = normalizeBoardLayout();
  updateBoardCanvasMetrics();
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
        <article class="board-card ${item.imageId || item.image ? "has-image" : ""} ${item.id === state.activeEntityId ? "is-selected" : ""}"
          data-board-id="${escapeHTML(item.id)}"
          style="left:${item.x}px;top:${item.y}px;--entity-color:${escapeHTML(activeProject().accent)}">
          ${imageMarkup(item, "board-card-image")}
          <div class="board-card-body">
            ${item.epithet
              ? `<p class="board-card-epithet">${escapeHTML(item.epithet)}</p>`
              : ""}
            <h3>${escapeHTML(item.title)}</h3>
            ${item.body?.trim()
              ? `<p class="board-card-description">${escapeHTML(item.body)}</p>`
              : ""}
            ${boardListBadgesMarkup(item)}
          </div>
          ${connectorHandlesMarkup(item)}
        </article>`;
    })
    .join("");
  renderRelationLines(items);
  if (!dom.relationEditor.classList.contains("is-hidden")) {
    const { source, target, link } = relationBeingEdited();
    if (source && target && link) positionRelationEditor(source, target, link);
  }
  const zoom = Math.min(1.4, Math.max(0.6, Number(state.settings.boardZoom) || 1));
  dom.boardCanvas.style.zoom = zoom;
  $("#zoom-label").textContent = `${Math.round(zoom * 100)}%`;
  addImageFallbacks(dom.boardView);
  if (layoutChanged) markChanged("ボード配置をグリッドへ整列しました");
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

function organisationMembershipMarkup(item) {
  const organisations = activeProject().entities.filter(
    (candidate) => candidate.organisation,
  );
  if (!organisations.length) return "";
  const excludedIds = item.organisation ? groupDescendantIds(item.id) : new Set();
  const choices = organisations
    .filter(
      (candidate) =>
        candidate.id !== item.id &&
        !excludedIds.has(candidate.id),
    )
    .sort((a, b) => groupDepth(a) - groupDepth(b) || a.title.localeCompare(b.title, "ja"));
  return `
    <section class="inspector-section organisation-membership">
      <label class="inspector-field">
        <span>所属</span>
        <select data-inspector-membership>
          <option value="">所属なし</option>
          ${choices
            .map(
              (group) => `
                <option
                  value="${escapeHTML(group.id)}"
                  ${item.parentGroupId === group.id ? "selected" : ""}
                >${escapeHTML(`${"— ".repeat(groupDepth(group))}${group.title}`)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <p>選択したグループ内に固定されます。外へ出す場合は「所属なし」を選択してください。</p>
    </section>`;
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
      <div class="inspector-name-editor">
        <label class="inspector-field">
          <span>名称</span>
          <input data-inspector-field="title" value="${escapeHTML(item.title)}" maxlength="80" />
        </label>
        <label
          class="inspector-field inspector-epithet-field ${item.epithet ? "" : "is-hidden"}"
          data-inspector-epithet-field
        >
          <span class="inspector-optional-heading">
            <span>二つ名 <small>任意</small></span>
            <button type="button" data-remove-inspector-epithet>削除</button>
          </span>
          <input
            data-inspector-field="epithet"
            value="${escapeHTML(item.epithet || "")}"
            maxlength="80"
            placeholder="例：灰燼の魔術師"
          />
        </label>
        <button
          type="button"
          class="inspector-optional-add ${item.epithet ? "is-hidden" : ""}"
          data-add-inspector-epithet
        >＋ 二つ名を追加</button>
      </div>
      ${organisationMembershipMarkup(item)}
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
  $("#board-add-entity-button").classList.toggle("is-hidden", database);
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
  return `
    <div class="list-filter-control ${selected.length ? "is-active" : ""}">
      <span class="list-filter-column-label">${escapeHTML(column.label)}</span>
      <div
        class="list-filter-option-buttons"
        role="group"
        aria-label="${escapeHTML(column.label)}で絞り込む"
      >
        <button
          type="button"
          class="list-filter-button is-all ${selected.length ? "" : "is-selected"}"
          data-list-filter-all="${escapeHTML(column.id)}"
          aria-pressed="${String(!selected.length)}"
        >すべて</button>
        ${column.options
          .map((option) => {
            const count = activeProject().entities.filter(
              (item) => String(item.fields?.[column.id] ?? "") === option.id,
            ).length;
            return `
              <button
                type="button"
                class="list-filter-button ${selected.includes(option.id) ? "is-selected" : ""}"
                style="--list-color:${escapeHTML(option.color)}"
                data-list-filter-column="${escapeHTML(column.id)}"
                data-list-filter-option="${escapeHTML(option.id)}"
                aria-pressed="${String(selected.includes(option.id))}"
              >
                <span class="list-filter-dot" aria-hidden="true"></span>
                <span>${escapeHTML(option.label)}</span>
                <small>${count}</small>
              </button>`;
          })
          .join("")}
      </div>
    </div>`;
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
