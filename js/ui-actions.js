"use strict";

// Commands, modals, settings, navigation, sorting, and zoom actions.

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

