# CSS structure

Styles are loaded in the order listed below. Cascade order is significant.

1. `base.css` — design tokens, reset, shared controls, top bar, and sidebar.
2. `workspace.css` — main shell, project header, toolbar, and content frame.
3. `database.css` — database table and empty state.
4. `board.css` — board canvas, cards, groups, relations, and status bar.
5. `inspector.css` — inspector panel and its controls.
6. `modals.css` — forms, editors, dialogs, command palette, help, and toasts.
7. `responsive.css` — media-query overrides; this must stay last.

Add component rules to the narrowest matching file. Shared variables and
reusable controls belong in `base.css`; breakpoint overrides belong only in
`responsive.css`. Keep the link order in `index.html` synchronized with this
list.
