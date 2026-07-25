"use strict";

// Commands, modals, settings, navigation, sorting, and zoom actions.

function closeDatabaseListPickers({ restoreFocus = false } = {}) {
  const openPicker = $(".db-list-picker.is-open", dom.tableBody);
  if (!openPicker) return;
  const trigger = $("[data-db-list-trigger]", openPicker);
  openPicker.classList.remove("is-open");
  trigger?.setAttribute("aria-expanded", "false");
  $("[data-db-list-menu]", openPicker)?.classList.add("is-hidden");
  if (restoreFocus) trigger?.focus();
}

function positionDatabaseListMenu(picker) {
  const trigger = $("[data-db-list-trigger]", picker);
  const menu = $("[data-db-list-menu]", picker);
  if (!trigger || !menu) return;
  const rect = trigger.getBoundingClientRect();
  const gutter = 8;
  menu.style.width = `${Math.max(190, rect.width)}px`;
  menu.style.left = `${Math.min(
    window.innerWidth - menu.offsetWidth - gutter,
    Math.max(gutter, rect.left),
  )}px`;
  const below = rect.bottom + 6;
  const above = rect.top - menu.offsetHeight - 6;
  menu.style.top = `${
    below + menu.offsetHeight <= window.innerHeight - gutter
      ? below
      : Math.max(gutter, above)
  }px`;
}

function openDatabaseListPicker(picker, { focusOption = false } = {}) {
  if (!picker) return;
  closeDatabaseListPickers();
  const trigger = $("[data-db-list-trigger]", picker);
  const menu = $("[data-db-list-menu]", picker);
  picker.classList.add("is-open");
  trigger?.setAttribute("aria-expanded", "true");
  menu?.classList.remove("is-hidden");
  positionDatabaseListMenu(picker);
  if (focusOption) {
    ($('[role="option"][aria-selected="true"]', menu) || $('[role="option"]', menu))?.focus();
  }
}

function toggleDatabaseListPicker(picker) {
  if (picker?.classList.contains("is-open")) closeDatabaseListPickers();
  else openDatabaseListPicker(picker);
}

function chooseDatabaseListOption(option) {
  const picker = option?.closest("[data-db-list-picker]");
  const trigger = $("[data-db-list-trigger]", picker);
  if (!picker || !trigger) return;
  const entityId = picker.dataset.dbEntity;
  const fieldId = picker.dataset.dbField;
  trigger.value = option.dataset.dbListOption || "";
  updateDatabaseCell(trigger);
  closeDatabaseListPickers();
  renderDatabase();
  window.setTimeout(() => {
    $(
      `[data-db-list-picker][data-db-entity="${CSS.escape(entityId)}"][data-db-field="${CSS.escape(fieldId)}"] [data-db-list-trigger]`,
      dom.tableBody,
    )?.focus();
  }, 0);
}

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

function relationBeingEdited() {
  const source = getEntityById(dom.relationEditor.dataset.sourceId);
  const targetId = dom.relationEditor.dataset.targetId;
  const link = source?.links.find((candidate) => candidate.targetId === targetId);
  return { source, target: getEntityById(targetId), link };
}

function positionRelationEditor(source, target, link) {
  const sourceAnchor = link.sourceAnchor || automaticAnchor(source, target);
  const targetAnchor = link.targetAnchor || oppositeAnchor(sourceAnchor);
  const start = anchorPoint(source, sourceAnchor);
  const end = anchorPoint(target, targetAnchor);
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const editorWidth = 292;
  const editorHeight = 196;
  const preferredLeft =
    midpoint.x + editorWidth + 24 < BOARD_WIDTH
      ? midpoint.x + 14
      : midpoint.x - editorWidth - 14;
  dom.relationEditor.style.left = `${Math.max(10, Math.min(BOARD_WIDTH - editorWidth - 10, preferredLeft))}px`;
  dom.relationEditor.style.top = `${Math.max(10, Math.min(BOARD_HEIGHT - editorHeight - 10, midpoint.y - 24))}px`;
}

function syncRelationEditorControls(link) {
  $$("[data-relation-arrow]", dom.relationEditor).forEach((button) => {
    const selected = button.dataset.relationArrow === link.arrow;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function openRelationEditor(sourceId, targetId, sourceAnchor = "", targetAnchor = "") {
  const source = getEntityById(sourceId);
  const target = getEntityById(targetId);
  if (!source || !target || source.id === target.id) return;
  let link = source.links.find((candidate) => candidate.targetId === target.id);
  if (!link) {
    const resolvedSourceAnchor = sourceAnchor || automaticAnchor(source, target);
    link = {
      targetId: target.id,
      memo: "",
      arrow: "end",
      sourceAnchor: resolvedSourceAnchor,
      targetAnchor: targetAnchor || oppositeAnchor(resolvedSourceAnchor),
    };
    source.links.push(link);
    source.updatedAt = now();
    updateProjectTimestamp();
    markChanged("関連を作成しました");
  } else {
    const nextSourceAnchor = sourceAnchor || link.sourceAnchor;
    const nextTargetAnchor = targetAnchor || link.targetAnchor;
    if (
      nextSourceAnchor !== link.sourceAnchor ||
      nextTargetAnchor !== link.targetAnchor
    ) {
      link.sourceAnchor = nextSourceAnchor;
      link.targetAnchor = nextTargetAnchor;
      source.updatedAt = now();
      updateProjectTimestamp();
      markChanged("関連線の接続位置を保存しました");
    }
  }
  dom.relationEditor.dataset.sourceId = source.id;
  dom.relationEditor.dataset.targetId = target.id;
  $("#relation-editor-route").textContent = `${source.title} → ${target.title}`;
  dom.relationMemo.value = link.memo || "";
  syncRelationEditorControls(link);
  positionRelationEditor(source, target, link);
  dom.relationEditor.classList.remove("is-hidden");
  renderRelationLines(visibleEntities());
  window.setTimeout(() => {
    dom.relationMemo.focus();
    dom.relationMemo.setSelectionRange(dom.relationMemo.value.length, dom.relationMemo.value.length);
  }, 20);
}

function closeRelationEditor() {
  dom.relationEditor.classList.add("is-hidden");
  delete dom.relationEditor.dataset.sourceId;
  delete dom.relationEditor.dataset.targetId;
  renderRelationLines(visibleEntities());
}

function updateRelationMemo() {
  const { source, link } = relationBeingEdited();
  if (!source || !link) return;
  link.memo = dom.relationMemo.value.slice(0, 240);
  source.updatedAt = now();
  updateProjectTimestamp();
  renderRelationLines(visibleEntities());
  renderInspector();
  markChanged("関連のMemoを自動保存しました");
}

function updateRelationArrow(arrow) {
  if (!["none", "start", "end", "both"].includes(arrow)) return;
  const { source, link } = relationBeingEdited();
  if (!source || !link) return;
  link.arrow = arrow;
  source.updatedAt = now();
  updateProjectTimestamp();
  syncRelationEditorControls(link);
  renderRelationLines(visibleEntities());
  renderInspector();
  markChanged("関連の矢印を保存しました");
}

function deleteCurrentRelation() {
  const { source, target } = relationBeingEdited();
  if (!source || !target) return;
  source.links = source.links.filter((link) => link.targetId !== target.id);
  source.updatedAt = now();
  updateProjectTimestamp();
  closeRelationEditor();
  renderBoard();
  renderInspector();
  markChanged("関連を削除しました");
  toast(`「${source.title} → ${target.title}」の関連を削除しました。`, "−");
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
  closeRelationEditor();
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
