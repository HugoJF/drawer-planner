# TODO

## Planned features

### Copy / Paste (Ctrl+C / Ctrl+V)
Duplicate selected items via clipboard-style shortcut.
- No system clipboard needed — just local React state (a `copiedItemIds: string[]` held in component or store)
- Ctrl+C: snapshot the current `selectedItemIds`
- Ctrl+V: for each copied item, call `duplicateItem` (or a new `pasteItems` store action for single undo step)
- Paste should attempt `findAvailablePosition` for each; fall back to `(0, 0)` if no space
- Nice to have: offset paste position by +1,+1 if pasting into the same drawer

### Category expansion: "just open" vs "always open"
The current expansion setting (None / Categorized / All) always forces the open state — manual toggles have no effect in Categorized/All modes. Split the behavior into two axes:
- **Which categories expand**: None / Categorized / All (existing)
- **How**: "Just open" — applies on load/setting change, user can still collapse manually; "Always open" — config locks the state, toggle clicks do nothing (current behavior)

Implementation sketch:
- Add a second config field, e.g. `categoryExpansionMode: 'just-open' | 'always-open'`
- In `isCategoryGroupOpen` (`drawer-tree.tsx`): for 'just-open', seed `expandedCategoryGroups` via `useEffect` on config change instead of computing deterministically
- The `useEffect` would set all matching keys into `expandedCategoryGroups`; subsequent manual toggles work normally since `expandedCategoryGroups.has(key)` is the source of truth

### Groups (quick-win via multi-select)
Items can belong to a named group (`groupId: string | null` on `Item`). The key behaviors:

- **Click a grouped item** → instantly multi-selects the entire group (all items sharing that `groupId`)
- **Click again (on an already-selected grouped item)** → narrows selection to just that one item
- **Multi-select drag** already moves all selected items together — no Ctrl needed once the group is selected

Likely quick to implement because:
- Multi-select, group drag, and `selectedItemIds` already exist
- The click handler in `drawer-grid.tsx` / `drawer-tree.tsx` just needs a branch: if the clicked item has a `groupId` and is not yet selected → `selectAll(groupMembers)`, if already selected → `selectItem(id)` (single)
- Groups need UI to assign (could be a field in the item form, or a "group selected" bulk action)
- No new drag logic needed — existing `repositionItems` handles it

Open questions:
- How to create/name groups (item form field vs. "group selected items" button in bulk context menu?)
- Show group membership visually on the grid (e.g. shared border/outline color)?
- Sidebar: show group as a sub-level, or just a badge on the item row?

### Improve rotation options
The current three rotation modes (normal, lay down, rotated 90°) don't cover all real-world placements — e.g. a graduated cylinder (proveta) standing upright vs. on its side at various angles. Consider:
- More rotation variants, or a free numeric rotation field
- Distinguishing which physical axis maps to which grid axis per rotation
- Possibly a visual rotation picker instead of the cycle button

### Resizable sidebar
Let the user drag the sidebar edge to resize it.
- Add a drag handle on the right edge of the sidebar (`cursor-col-resize`)
- Track width in component state, clamped to a sensible min/max (e.g. 180px – 480px)
- Persist the chosen width to `localStorage` so it survives reloads
- Replace the fixed `w-72` class with an inline `style={{ width }}` when the sidebar is open

---

## Context — recent work (session ending ~2026-03-31)

Already implemented:
- **Grid color driver** (`gridColorMode: 'category' | 'height'`) — toggle in settings, heatmap in `drawer-grid.tsx`
- **Ctrl+A select all** — selects all items in current drawer
- **Arrow key movement** — nudges selected item(s) one cell, multi-select uses `repositionItems`
- **Keyboard shortcuts cheatsheet** — `ShortcutsDialog` triggered by `?` key
- **History panel** — `history-panel.tsx`, human-readable action list with jump-to support
- **D to duplicate** — duplicates single selected item, toasts if no space found
- **Multi-selection** — `selectedItemIds: Set<string>`, Ctrl+click toggle, bulk drag/delete/lock/move
- **Search** — Ctrl+F, highlights matches in grid by dimming non-matches
- `useKeyboardShortcut({ key, ctrl?, shift?, alt? }, callback)` hook in `hooks/use-keyboard-shortcut.ts`

Key files:
- `lib/store.ts` — Zustand store, all state and actions
- `app/page.tsx` — keyboard shortcut handler, top-level layout
- `components/drawer-planner/drawer-grid.tsx` — main grid view, drag/drop/resize
- `components/drawer-planner/drawer-tree.tsx` — sidebar tree, search box
- `hooks/use-keyboard-shortcut.ts` — generic keyboard shortcut hook
