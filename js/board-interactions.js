"use strict";

// Board zooming, connections, dragging, grouping, resizing, and panning.

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
