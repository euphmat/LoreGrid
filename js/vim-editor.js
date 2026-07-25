"use strict";

// Vim-style textarea state machine and editor status rendering.

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
