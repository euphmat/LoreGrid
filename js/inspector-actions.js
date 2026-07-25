"use strict";

// Inline inspector editing and inspector image operations.

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

function showInspectorEpithetField() {
  const field = $("[data-inspector-epithet-field]", dom.inspectorContent);
  const addButton = $("[data-add-inspector-epithet]", dom.inspectorContent);
  field?.classList.remove("is-hidden");
  addButton?.classList.add("is-hidden");
  window.setTimeout(
    () => $('[data-inspector-field="epithet"]', field)?.focus(),
    0,
  );
}

function removeInspectorEpithet() {
  const item = activeEntity();
  if (!item) return;
  item.epithet = "";
  item.updatedAt = now();
  updateProjectTimestamp();
  renderDatabase();
  renderBoard();
  renderInspector();
  markChanged("二つ名を削除しました");
}

function updateInspectorOrganisation(enabled) {
  const item = activeEntity();
  if (!item) return;
  item.organisation = enabled;
  if (!enabled) {
    activeProject().entities.forEach((candidate) => {
      if (candidate.parentGroupId === item.id) candidate.parentGroupId = "";
    });
  }
  const parent = parentGroupFor(item);
  if (parent) ensureGroupCanContain(parent, item);
  keepItemInsideParent(item);
  if (enabled) keepGroupMembersContained(item);
  item.updatedAt = now();
  updateProjectTimestamp();
  renderDatabase();
  renderBoard();
  renderInspector();
  markChanged(enabled ? "Organisationを有効にしました" : "Organisationを無効にしました");
}

function updateInspectorMembership(groupId) {
  const item = activeEntity();
  if (!item) return;
  const excludedIds = item.organisation ? groupDescendantIds(item.id) : new Set();
  const group = getEntityById(groupId);
  const nextParentId =
    group?.organisation &&
    group.id !== item.id &&
    !excludedIds.has(group.id)
      ? group.id
      : "";
  item.parentGroupId = nextParentId;
  if (group && nextParentId) {
    ensureGroupCanContain(group, item);
    keepItemInsideParent(item);
  }
  item.updatedAt = now();
  updateProjectTimestamp();
  renderBoard();
  renderInspector();
  markChanged(nextParentId ? "所属グループを変更しました" : "所属を解除しました");
  toast(
    nextParentId
      ? `「${group.title}」に所属しました。`
      : "所属を解除しました。",
  );
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
  return deleteEntityById(id);
}
