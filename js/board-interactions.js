"use strict";

// Board zooming, connections, dragging, grouping, resizing, and panning.

function handleBoardWheelZoom(event) {
  event.preventDefault();
  const delta =
    Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      ? event.deltaY
      : event.deltaX;
  if (delta === 0) return;
  const before = Number(state.settings.boardZoom) || 1;
  const rect = dom.boardViewport.getBoundingClientRect();
  const pointerX = event.clientX - rect.left;
  const pointerY = event.clientY - rect.top;
  const logicalX =
    boardOriginX + (dom.boardViewport.scrollLeft + pointerX) / before;
  const logicalY =
    boardOriginY + (dom.boardViewport.scrollTop + pointerY) / before;
  const magnitude = Math.min(0.1, Math.max(0.01, Math.abs(delta) * 0.0015));
  const next = Math.min(
    1.4,
    Math.max(
      0.6,
      Math.round((before + (delta < 0 ? magnitude : -magnitude)) * 100) / 100,
    ),
  );
  if (next === before) return;
  state.settings.boardZoom = next;
  renderBoard();
  dom.boardViewport.scrollLeft = (logicalX - boardOriginX) * next - pointerX;
  dom.boardViewport.scrollTop = (logicalY - boardOriginY) * next - pointerY;
  markChanged("ホイールでボードをズーム");
}

function boardPointFromClient(clientX, clientY) {
  const rect = dom.boardCanvas.getBoundingClientRect();
  const zoom = Number(state.settings.boardZoom) || 1;
  return {
    x: boardOriginX + (clientX - rect.left) / zoom,
    y: boardOriginY + (clientY - rect.top) / zoom,
  };
}

function newEntityBoardCoordinates(index = 0) {
  const zoom = Number(state.settings.boardZoom) || 1;
  const desiredX = snapToBoardGrid(
    boardOriginX +
    (dom.boardViewport.scrollLeft + dom.boardViewport.clientWidth / 2) / zoom -
    BOARD_CARD_WIDTH / 2 +
    (index % 5) * BOARD_GRID_SIZE,
  );
  const desiredY = snapToBoardGrid(
    boardOriginY +
    (dom.boardViewport.scrollTop + dom.boardViewport.clientHeight / 2) / zoom -
    BOARD_CARD_HEIGHT / 2 +
    (index % 5) * BOARD_GRID_SIZE,
  );
  return findNearestAvailableBoardPosition(
    {
      id: "",
      organisation: false,
      image: "",
      imageId: "",
      parentGroupId: "",
    },
    desiredX,
    desiredY,
    "",
  );
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
  dom.relationDraftLines.setAttribute(
    "viewBox",
    `${boardOriginX} ${boardOriginY} ${boardCanvasWidth} ${boardCanvasHeight}`,
  );
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
      openRelationEditor(sourceId, completedTarget.dataset.boardId, sourceAnchor, targetAnchor);
    }
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end, { once: true });
}

function itemBoardSize(item) {
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

function boardRectFor(item, x = item.x, y = item.y) {
  const size = itemBoardSize(item);
  return {
    left: x,
    top: y,
    right: x + size.width,
    bottom: y + size.height,
  };
}

function boardRectsOverlap(first, second, gap = BOARD_GRID_GAP) {
  return (
    first.left < second.right + gap &&
    first.right + gap > second.left &&
    first.top < second.bottom + gap &&
    first.bottom + gap > second.top
  );
}

function boardPositionIsAvailable(item, x, y, parentGroupId = item.parentGroupId) {
  const candidateRect = boardRectFor(item, x, y);
  const ignoredIds = item.organisation ? groupDescendantIds(item.id) : new Set();
  return !activeProject().entities.some((other) => {
    if (
      other === item ||
      other.id === item.id ||
      ignoredIds.has(other.id) ||
      (other.parentGroupId || "") !== (parentGroupId || "")
    ) {
      return false;
    }
    return boardRectsOverlap(candidateRect, boardRectFor(other));
  });
}

function itemMovementBoundsForParent(item, parentGroupId = item.parentGroupId) {
  const size = itemBoardSize(item);
  const parent = getEntityById(parentGroupId);
  if (!parent?.organisation || parent.id === item.id) {
    return {
      minX: Number.NEGATIVE_INFINITY,
      minY: Number.NEGATIVE_INFINITY,
      maxX: Number.POSITIVE_INFINITY,
      maxY: Number.POSITIVE_INFINITY,
    };
  }
  const minX = parent.x + BOARD_GROUP_INSET;
  const minY =
    parent.y + BOARD_GROUP_HEADER_HEIGHT + BOARD_GROUP_INSET;
  return {
    minX,
    minY,
    maxX: Math.max(
      minX,
      parent.x + parent.groupWidth - BOARD_GROUP_INSET - size.width,
    ),
    maxY: Math.max(
      minY,
      parent.y + parent.groupHeight - BOARD_GROUP_INSET - size.height,
    ),
  };
}

function clampBoardPositionToBounds(x, y, bounds) {
  return {
    x: snapToBoardGrid(Math.max(bounds.minX, Math.min(bounds.maxX, x))),
    y: snapToBoardGrid(Math.max(bounds.minY, Math.min(bounds.maxY, y))),
  };
}

function findNearestAvailableBoardPosition(
  item,
  desiredX,
  desiredY,
  parentGroupId = item.parentGroupId,
  allowParentExpansion = true,
) {
  const bounds = itemMovementBoundsForParent(item, parentGroupId);
  const origin = clampBoardPositionToBounds(
    snapToBoardGrid(desiredX),
    snapToBoardGrid(desiredY),
    bounds,
  );
  const seen = new Set();
  const boundedRadius =
    Number.isFinite(bounds.maxX) && Number.isFinite(bounds.maxY)
      ? Math.ceil(
          Math.max(
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY,
          ) / BOARD_GRID_SIZE,
        ) + 2
      : 80;
  for (let radius = 0; radius <= boundedRadius; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (
          radius &&
          Math.abs(offsetX) !== radius &&
          Math.abs(offsetY) !== radius
        ) {
          continue;
        }
        const candidate = clampBoardPositionToBounds(
          origin.x + offsetX * BOARD_GRID_SIZE,
          origin.y + offsetY * BOARD_GRID_SIZE,
          bounds,
        );
        const key = `${candidate.x}:${candidate.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (boardPositionIsAvailable(item, candidate.x, candidate.y, parentGroupId)) {
          return candidate;
        }
      }
    }
  }
  const parent = getEntityById(parentGroupId);
  if (allowParentExpansion && parent?.organisation) {
    const growth = ceilToBoardGrid(
      Math.max(BOARD_CARD_HEIGHT, itemBoardSize(item).height + BOARD_GRID_GAP),
    );
    parent.groupHeight = ceilToBoardGrid(parent.groupHeight + growth);
    const ancestor = parentGroupFor(parent);
    if (ancestor) ensureGroupCanContain(ancestor, parent);
    return findNearestAvailableBoardPosition(
      item,
      desiredX,
      desiredY,
      parentGroupId,
      false,
    );
  }
  return origin;
}

function normalizeBoardLayout() {
  const entities = activeProject().entities;
  const previousLayout = new Map(
    entities.map((item) => [
      item.id,
      [item.x, item.y, item.groupWidth, item.groupHeight],
    ]),
  );
  entities.forEach((item) => {
    item.x = snapToBoardGrid(item.x);
    item.y = snapToBoardGrid(item.y);
    if (item.organisation) {
      item.groupWidth = Math.max(240, ceilToBoardGrid(item.groupWidth));
      item.groupHeight = Math.max(192, ceilToBoardGrid(item.groupHeight));
    }
  });
  const placePlane = (parentGroupId = "") => {
    entities
      .filter((item) => (item.parentGroupId || "") === parentGroupId)
      .sort((a, b) => Number(b.organisation) - Number(a.organisation))
      .forEach((item) => {
        const position = findNearestAvailableBoardPosition(
          item,
          item.x,
          item.y,
          parentGroupId,
        );
        moveItemAndDescendants(item, position.x, position.y);
      });
    entities
      .filter(
        (item) =>
          item.organisation && (item.parentGroupId || "") === parentGroupId,
      )
      .forEach((group) => placePlane(group.id));
  };
  for (let pass = 0; pass < 3; pass += 1) placePlane();
  return entities.some((item) => {
    const previous = previousLayout.get(item.id);
    return (
      !previous ||
      previous[0] !== item.x ||
      previous[1] !== item.y ||
      previous[2] !== item.groupWidth ||
      previous[3] !== item.groupHeight
    );
  });
}

function parentGroupFor(item) {
  const parent = getEntityById(item.parentGroupId);
  return parent?.organisation && parent.id !== item.id ? parent : null;
}

function itemMovementBounds(item) {
  return itemMovementBoundsForParent(item, item.parentGroupId);
}

function moveItemAndDescendants(item, x, y) {
  const nextX = snapToBoardGrid(x);
  const nextY = snapToBoardGrid(y);
  const offsetX = nextX - item.x;
  const offsetY = nextY - item.y;
  item.x = nextX;
  item.y = nextY;
  if (!item.organisation || (!offsetX && !offsetY)) return;
  groupDescendantIds(item.id).forEach((id) => {
    const descendant = getEntityById(id);
    if (!descendant) return;
    descendant.x = snapToBoardGrid(descendant.x + offsetX);
    descendant.y = snapToBoardGrid(descendant.y + offsetY);
  });
}

function keepItemInsideParent(item) {
  if (!parentGroupFor(item)) return false;
  const bounds = itemMovementBounds(item);
  const nextX = Math.max(bounds.minX, Math.min(bounds.maxX, item.x));
  const nextY = Math.max(bounds.minY, Math.min(bounds.maxY, item.y));
  const changed = nextX !== item.x || nextY !== item.y;
  if (changed) moveItemAndDescendants(item, nextX, nextY);
  return changed;
}

function ensureGroupCanContain(group, member) {
  if (!group?.organisation || !member) return false;
  const memberSize = itemBoardSize(member);
  const nextWidth = Math.min(
    2400,
    ceilToBoardGrid(
      Math.max(group.groupWidth, memberSize.width + BOARD_GROUP_INSET * 2),
    ),
  );
  const nextHeight = Math.min(
    1800,
    ceilToBoardGrid(
      Math.max(
        group.groupHeight,
        memberSize.height + BOARD_GROUP_HEADER_HEIGHT + BOARD_GROUP_INSET * 2,
      ),
    ),
  );
  let changed =
    nextWidth !== group.groupWidth ||
    nextHeight !== group.groupHeight;
  group.groupWidth = nextWidth;
  group.groupHeight = nextHeight;
  const parent = parentGroupFor(group);
  if (parent) {
    changed = ensureGroupCanContain(parent, group) || changed;
    changed = keepItemInsideParent(group) || changed;
  } else {
    const bounds = itemMovementBounds(group);
    const nextX = Math.max(bounds.minX, Math.min(bounds.maxX, group.x));
    const nextY = Math.max(bounds.minY, Math.min(bounds.maxY, group.y));
    if (nextX !== group.x || nextY !== group.y) {
      moveItemAndDescendants(group, nextX, nextY);
      changed = true;
    }
  }
  return changed;
}

function minimumGroupSizeForMembers(group) {
  return activeProject().entities
    .filter((candidate) => candidate.parentGroupId === group.id)
    .reduce(
      (minimum, member) => {
        const size = itemBoardSize(member);
        minimum.width = Math.max(
          minimum.width,
          size.width + BOARD_GROUP_INSET * 2,
        );
        minimum.height = Math.max(
          minimum.height,
          size.height + BOARD_GROUP_HEADER_HEIGHT + BOARD_GROUP_INSET * 2,
        );
        return minimum;
      },
      { width: 240, height: 192 },
    );
}

function keepGroupMembersContained(group) {
  activeProject().entities
    .filter((candidate) => candidate.parentGroupId === group.id)
    .forEach((member) => {
      keepItemInsideParent(member);
      if (member.organisation) keepGroupMembersContained(member);
    });
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
          centerX >= group.x + BOARD_GROUP_INSET &&
          centerX <= group.x + group.groupWidth - BOARD_GROUP_INSET &&
          centerY >=
            group.y + BOARD_GROUP_HEADER_HEIGHT + BOARD_GROUP_INSET &&
          centerY <= group.y + group.groupHeight - BOARD_GROUP_INSET,
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
  if (group) {
    ensureGroupCanContain(group, item);
    keepItemInsideParent(item);
  }
  return changed;
}

function highlightGroupDropTarget(item) {
  const target = parentGroupFor(item) || containingGroupFor(item);
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
  dom.boardViewport.focus({ preventScroll: true });
  if (!dom.relationEditor.classList.contains("is-hidden")) closeRelationEditor();
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
    const rawX = snapToBoardGrid(
      originX + (moveEvent.clientX - startX) / zoom,
    );
    const rawY = snapToBoardGrid(
      originY + (moveEvent.clientY - startY) / zoom,
    );
    let candidateParentId = item.parentGroupId || "";
    if (!candidateParentId) {
      item.x = rawX;
      item.y = rawY;
      candidateParentId = containingGroupFor(item)?.id || "";
    }
    const position = findNearestAvailableBoardPosition(
      item,
      rawX,
      rawY,
      candidateParentId,
    );
    item.x = position.x;
    item.y = position.y;
    card.style.left = `${item.x}px`;
    card.style.top = `${item.y}px`;
    const offsetX = item.x - originX;
    const offsetY = item.y - originY;
    descendants.forEach((entry) => {
      entry.item.x = snapToBoardGrid(entry.x + offsetX);
      entry.item.y = snapToBoardGrid(entry.y + offsetY);
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
    const membershipChanged = parentGroupFor(item)
      ? false
      : updateEntityGroupMembership(item);
    const settledPosition = findNearestAvailableBoardPosition(
      item,
      item.x,
      item.y,
      item.parentGroupId,
    );
    moveItemAndDescendants(item, settledPosition.x, settledPosition.y);
    normalizeBoardLayout();
    item.updatedAt = now();
    updateProjectTimestamp();
    renderBoard();
    markChanged(
      membershipChanged
        ? item.parentGroupId
          ? "項目をOrganisationグループへ移動しました"
          : "項目をOrganisationグループから取り出しました"
        : item.parentGroupId
          ? "所属グループ内の配置を保存しました"
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
  dom.boardViewport.focus({ preventScroll: true });
  if (!dom.relationEditor.classList.contains("is-hidden")) closeRelationEditor();
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
  const minimumSize = minimumGroupSizeForMembers(item);
  const minimumWidth = ceilToBoardGrid(minimumSize.width);
  const minimumHeight = ceilToBoardGrid(minimumSize.height);
  const parent = parentGroupFor(item);
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
      width = Math.min(2400, Math.max(minimumWidth, origin.width + dx));
    }
    if (anchor.includes("s")) {
      height = Math.min(1800, Math.max(minimumHeight, origin.height + dy));
    }
    if (anchor.includes("w")) {
      width = Math.min(2400, Math.max(minimumWidth, origin.width - dx));
      x = origin.x + origin.width - width;
    }
    if (anchor.includes("n")) {
      height = Math.min(1800, Math.max(minimumHeight, origin.height - dy));
      y = origin.y + origin.height - height;
    }
    if (parent) {
      const minX = parent.x + BOARD_GROUP_INSET;
      const minY =
        parent.y + BOARD_GROUP_HEADER_HEIGHT + BOARD_GROUP_INSET;
      const maxRight = parent.x + parent.groupWidth - BOARD_GROUP_INSET;
      const maxBottom = parent.y + parent.groupHeight - BOARD_GROUP_INSET;
      if (x < minX) {
        width -= minX - x;
        x = minX;
      }
      if (y < minY) {
        height -= minY - y;
        y = minY;
      }
      width = Math.min(width, maxRight - x);
      height = Math.min(height, maxBottom - y);
    }
    item.x = snapToBoardGrid(x);
    item.y = snapToBoardGrid(y);
    item.groupWidth = ceilToBoardGrid(width);
    item.groupHeight = ceilToBoardGrid(height);
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
    keepItemInsideParent(item);
    keepGroupMembersContained(item);
    normalizeBoardLayout();
    item.updatedAt = now();
    updateProjectTimestamp();
    renderBoard();
    markChanged("Organisationグループの大きさを保存しました");
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end, { once: true });
}

function beginBoardPan(event) {
  if (
    event.button !== 0 ||
    event.target.closest(
      "[data-board-id], [data-relation-source][data-relation-target], #relation-editor",
    )
  ) return;
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
