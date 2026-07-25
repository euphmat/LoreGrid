# JavaScript structure

LoreGrid stays build-free: `index.html` loads these classic scripts from top to
bottom. They intentionally share the browser's global lexical scope, so the
order below is part of the application contract.

1. `core.js` — constants, shared state, normalization, persistence, IndexedDB,
   and common helpers.
2. `renderers.js` — DOM output for every application view.
3. `data-actions.js` — project, entity, column, image, import, and export
   mutations.
4. `ui-actions.js` — commands, modal state, settings, navigation, sorting, and
   zoom controls.
5. `board-interactions.js` — pointer-based board interactions.
6. `inspector-actions.js` — inline inspector edits and inspector images.
7. `vim-editor.js` — the textarea's Vim-style state machine.
8. `events.js` — event listeners and application startup; this must stay last.

## Editing guidance

- Put data shape, migration, or persistence changes in `core.js`.
- Keep renderers free of event listener registration.
- Put a mutation beside the feature that owns it, then call existing render and
  persistence helpers explicitly.
- Register delegated and global listeners in `events.js`.
- Do not redeclare a top-level `const` or `let` name in another file.
- When adding a file, document and preserve its load position in `index.html`.

This arrangement avoids a build step while keeping each task small enough to
inspect independently. If module boundaries become necessary later, the shared
state in `core.js` is the natural starting point for an ES module store.
