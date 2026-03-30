# TODO

## Planned features

### Ctrl+A — Select all
Select all items in the currently visible drawer.
- Hook into the existing `useKeyboardShortcut` hook: `{ key: 'a', ctrl: true }`
- Call `selectItem` for each item in the current drawer in one pass, or add a `selectAll(drawerIds)` store action
- Guard: only fire when no input is focused (same pattern as existing keyboard shortcuts in `app/page.tsx`)

### Arrow key movement
Nudge selected item(s) one grid cell at a time using arrow keys.
- Handler goes in `app/page.tsx` alongside the existing Delete/E/R shortcuts
- For single item: call `moveItem(id, drawerId, gridX ± 1, gridY ± 1)` with bounds clamping
- For multi-select: call `repositionItems(...)` (already exists) so it's a single undo step
- Guard against going out of bounds using `drawer.gridCols` / `drawer.gridRows`

### Copy / Paste (Ctrl+C / Ctrl+V)
Duplicate selected items via clipboard-style shortcut.
- No system clipboard needed — just local React state (a `copiedItemIds: string[]` held in component or store)
- Ctrl+C: snapshot the current `selectedItemIds`
- Ctrl+V: for each copied item, call `duplicateItem` (or a new `pasteItems` store action for single undo step)
- Paste should attempt `findAvailablePosition` for each; fall back to `(0, 0)` if no space
- Nice to have: offset paste position by +1,+1 if pasting into the same drawer

### Keyboard shortcuts cheatsheet
A modal or popover listing all available shortcuts; triggered by `?` key or a `?` button in the header.
- Shortcuts to document: Ctrl+Z/Y (undo/redo), Ctrl+F (search), Delete (delete), E (edit), R (rotate), Ctrl+A (select all), arrows (move), Ctrl+C/V (copy/paste), Escape (clear search/selection)
- Simple static component — no logic, just a formatted table
- Could reuse the existing `Dialog` / Radix UI primitives

---

## Context — recent work (session ending ~2026-03-30)

The last session implemented **multi-selection**:
- `selectedItemIds: Set<string>` in Zustand store (replaces `selectedItemId`)
- `selectItem(id)` for exclusive select, `toggleItemSelection(id)` for Ctrl+click toggle
- Clicking a selected item deselects it
- Multi-item drag: all selected unlocked items move together as a group with ghost overlays
- Bulk store actions: `deleteItems`, `repositionItems`, `setItemsLocked`
- Context menu is multi-select aware (bulk move/lock/delete when 2+ selected)
- Non-selected items dim to 50% opacity when a selection is active
- Search box in tree sidebar (Ctrl+F), highlights matching items in grid by dimming non-matches to 20%
- `useKeyboardShortcut({ key, ctrl?, shift?, alt? }, callback)` hook in `hooks/use-keyboard-shortcut.ts`

Key files:
- `lib/store.ts` — Zustand store, all state and actions
- `app/page.tsx` — keyboard shortcut handler, top-level layout
- `components/drawer-planner/drawer-grid.tsx` — main grid view, drag/drop/resize
- `components/drawer-planner/drawer-tree.tsx` — sidebar tree, search box
- `hooks/use-keyboard-shortcut.ts` — generic keyboard shortcut hook
