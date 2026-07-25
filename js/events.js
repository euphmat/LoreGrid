"use strict";

// Event wiring and application startup.

dom.projectList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-project-id]");
  if (button) switchProject(button.dataset.projectId);
});

dom.tableBody.addEventListener("click", (event) => {
  const listOption = event.target.closest("[data-db-list-option]");
  if (listOption) {
    event.stopPropagation();
    chooseDatabaseListOption(listOption);
    return;
  }
  const listTrigger = event.target.closest("[data-db-list-trigger]");
  if (listTrigger) {
    event.stopPropagation();
    toggleDatabaseListPicker(listTrigger.closest("[data-db-list-picker]"));
    return;
  }
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
dom.tableBody.addEventListener("keydown", (event) => {
  const picker = event.target.closest("[data-db-list-picker]");
  if (!picker) return;
  const trigger = event.target.closest("[data-db-list-trigger]");
  const option = event.target.closest("[data-db-list-option]");
  const menuOptions = $$("[data-db-list-option]", picker);
  if (trigger && ["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    openDatabaseListPicker(picker, { focusOption: true });
    if (event.key === "ArrowUp") menuOptions.at(-1)?.focus();
    return;
  }
  if (!option) {
    if (event.key === "Escape" && picker.classList.contains("is-open")) {
      event.preventDefault();
      event.stopPropagation();
      closeDatabaseListPickers({ restoreFocus: true });
    }
    return;
  }
  const index = menuOptions.indexOf(option);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const offset = event.key === "ArrowDown" ? 1 : -1;
    menuOptions[(index + offset + menuOptions.length) % menuOptions.length]?.focus();
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    menuOptions[event.key === "Home" ? 0 : menuOptions.length - 1]?.focus();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeDatabaseListPickers({ restoreFocus: true });
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
    openRelationEditor(relation.dataset.relationSource, relation.dataset.relationTarget);
  }
});

dom.relationMemo.addEventListener("input", updateRelationMemo);
$("#relation-arrow-controls").addEventListener("click", (event) => {
  const button = event.target.closest("[data-relation-arrow]");
  if (button) updateRelationArrow(button.dataset.relationArrow);
});
$("#close-relation-editor").addEventListener("click", closeRelationEditor);
$("#delete-inline-relation").addEventListener("click", deleteCurrentRelation);

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
  } else if (event.target.matches("[data-inspector-membership]")) {
    updateInspectorMembership(event.target.value);
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
$("#add-entity-button").addEventListener("click", createEntityInInspector);
$("#board-add-entity-button").addEventListener("click", createEntityInInspector);
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
$("#manage-columns-button").addEventListener("click", () => {
  openDatabaseColumnModal(activeProject().columns[0]?.id || null);
});
$("#zoom-in").addEventListener("click", () => setBoardZoom(0.1));
$("#zoom-out").addEventListener("click", () => setBoardZoom(-0.1));

dom.search.addEventListener("input", () => {
  state.settings.query = dom.search.value;
  renderDatabase();
  renderBoard();
  markChanged("検索中");
});

dom.listFilterBar.addEventListener("change", (event) => {
  const checkbox = event.target.closest(
    "[data-list-filter-column][data-list-filter-option]",
  );
  if (!checkbox) return;
  updateListFilter(
    checkbox.dataset.listFilterColumn,
    checkbox.dataset.listFilterOption,
    checkbox.checked,
  );
});
dom.listFilterBar.addEventListener("click", (event) => {
  if (event.target.closest("#clear-list-filters")) {
    clearListFilters();
    return;
  }
  const summary = event.target.closest(".list-filter-control > summary");
  if (!summary) return;
  const current = summary.closest("details");
  $$(".list-filter-control[open]", dom.listFilterBar).forEach((details) => {
    if (details !== current) details.removeAttribute("open");
  });
});

dom.tableHead.addEventListener("click", (event) => {
    const editColumn = event.target.closest("[data-edit-db-column]");
    const moveColumn = event.target.closest("[data-move-db-column]");
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
$("#delete-entity-button").addEventListener("click", deleteCurrentEntity);
$("#delete-column-button").addEventListener("click", () => {
  const id = $("#column-id").value;
  if (id) deleteDatabaseColumn(id, { keepEditorOpen: true });
});
dom.columnForm.addEventListener("input", () => {
  databaseColumnEditorDirty = true;
});
$("#column-kind").addEventListener("change", () => {
  databaseColumnEditorDirty = true;
  updateColumnListSettingsVisibility();
});
$("#add-list-option").addEventListener("click", () => addListOptionEditorRow());
$("#add-managed-column").addEventListener("click", () => switchDatabaseColumnEditor());
$("#column-manager-list").addEventListener("click", (event) => {
  const select = event.target.closest("[data-select-managed-column]");
  const move = event.target.closest("[data-move-managed-column]");
  if (select) {
    if (select.dataset.selectManagedColumn !== $("#column-id").value) {
      switchDatabaseColumnEditor(select.dataset.selectManagedColumn);
    }
  } else if (move) {
    if (databaseColumnEditorDirty && !saveDatabaseColumnEditor({ quiet: true })) return;
    moveDatabaseColumn(
      move.dataset.moveManagedColumn,
      Number(move.dataset.moveDirection),
    );
  }
});
$("#column-list-options").addEventListener("click", (event) => {
  const remove = event.target.closest("[data-remove-list-option]");
  const color = event.target.closest("[data-list-option-color]");
  if (remove) {
    remove.closest("[data-list-option-row]")?.remove();
    databaseColumnEditorDirty = true;
    syncListOptionEditorEmptyState();
  } else if (color) {
    const row = color.closest("[data-list-option-row]");
    const selected = normalizePaletteColor(color.dataset.listOptionColor);
    row.style.setProperty("--list-color", selected);
    $(".list-option-color-value", row).value = selected;
    $(".list-option-badge-preview", row)?.style.setProperty("--list-color", selected);
    $(".list-option-color-picker summary", row)?.style.setProperty("--list-color", selected);
    $(".list-option-color-picker", row)?.removeAttribute("open");
    databaseColumnEditorDirty = true;
  }
});

$$("[data-close-modal]").forEach((element) => {
  element.addEventListener("click", () => {
    const modal = element.dataset.closeModal;
    if (modal === "entity") closeEntityModal();
    if (modal === "project") closeProjectModal();
    if (modal === "column") closeDatabaseColumnModal();
    if (modal === "settings") closeSettings();
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
  if (!event.target.closest("[data-db-list-picker]")) closeDatabaseListPickers();
  if (!event.target.closest(".list-filter-control")) {
    $$(".list-filter-control[open]", dom.listFilterBar).forEach((details) =>
      details.removeAttribute("open"),
    );
  }
  if (
    !dom.relationEditor.classList.contains("is-hidden") &&
    !event.target.closest("#relation-editor") &&
    !event.target.closest("[data-relation-source][data-relation-target]") &&
    !event.target.closest("[data-connector-handle]")
  ) {
    closeRelationEditor();
  }
});

dom.databaseView.addEventListener("scroll", () => closeDatabaseListPickers(), true);
window.addEventListener("resize", () => closeDatabaseListPickers());

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
    else if (!dom.columnModal.classList.contains("is-hidden")) dom.columnForm.requestSubmit();
    else {
      saveImmediately();
      toast("この端末に保存しました。");
    }
    return;
  }
  if (event.key === "Escape") {
    if (!dom.relationEditor.classList.contains("is-hidden")) {
      closeRelationEditor();
      return;
    }
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

  if (
    event.key === "Backspace" &&
    state.activeEntityId &&
    dom.relationEditor.classList.contains("is-hidden")
  ) {
    event.preventDefault();
    deleteEntityById(state.activeEntityId);
  } else if (event.key === "j") moveSelection(1);
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
