# TODO

## Planned features

### Grid color driver: category vs height heatmap
Add a config option (`gridColorMode: 'category' | 'height'`) to switch what drives item color in the grid view.

- **Category** (current): item color = `getCategoryColor(item.categoryId, categories)`
- **Height**: color is interpolated across a gradient based on `heightUnits` relative to the drawer's max height — e.g. cool → warm (blue → red) as height increases, giving a visual heatmap of vertical space usage

Implementation sketch:
- Add `gridColorMode` to `GridfinityConfig` + `DEFAULT_CONFIG`, add a toggle to settings panel
- In `drawer-grid.tsx`, replace the two `getCategoryColor(...)` calls with a `getItemColor(item, drawer, config, categories)` helper that branches on `gridColorMode`
- For height mode: `ratio = heightUnits / (drawer.height / config.heightUnit)`, map to a CSS color via `oklch` or a fixed palette (e.g. 5 stops: blue → cyan → green → amber → red)

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

### History panel
A sidebar panel (or popover) showing a human-readable list of past actions, with the ability to jump to any point.

**Diff logic** (`lib/history.ts` or similar):
- `diffSnapshots(before: Snapshot, after: Snapshot): SnapshotDiff` — compare two snapshots by item/drawer `id` using set operations
- Infer a label from the diff shape:
  - 1 item added → "Added [name]"
  - 1 item removed → "Deleted [name]"
  - 1 item moved (gridX/gridY changed) → "Moved [name]"
  - 1 item renamed → "Renamed [old] → [new]"
  - N items changed → "Moved N items" / "Deleted N items"
  - drawer added/removed/changed → "Added drawer [name]" etc.
  - config changed → "Updated settings"

**Store changes**:
- Keep `past: Snapshot[]` as-is (already capped at 50)
- Add `pastLabels: string[]` — computed label for each snapshot, pushed alongside `push()`
- Or compute labels lazily in the panel by diffing adjacent snapshots on render

**UI** (`components/drawer-planner/history-panel.tsx`):
- List of entries, most recent at top, current state highlighted
- Each entry shows: label + relative time ("just now", "2 actions ago")
- Clicking an entry calls `undo()` or `redo()` the correct number of times to reach it
- Lives in the right sidebar or as a panel toggled from the header (similar to `SettingsPanel`)

**Undo/redo button labels**:
- Once labels exist, the Undo/Redo buttons in the header (`app/page.tsx`) can show tooltips: "Undo: Moved Bench Vice"

### Keyboard shortcuts cheatsheet
A modal or popover listing all available shortcuts; triggered by `?` key or a `?` button in the header.
- Shortcuts to document: Ctrl+Z/Y (undo/redo), Ctrl+F (search), Delete (delete), E (edit), R (rotate), Ctrl+A (select all), arrows (move), Ctrl+C/V (copy/paste), Escape (clear search/selection)
- Simple static component — no logic, just a formatted table
- Could reuse the existing `Dialog` / Radix UI primitives

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

### Resizable sidebar
Let the user drag the sidebar edge to resize it.
- Add a drag handle on the right edge of the sidebar (`cursor-col-resize`)
- Track width in component state, clamped to a sensible min/max (e.g. 180px – 480px)
- Persist the chosen width to `localStorage` so it survives reloads
- Replace the fixed `w-72` class with an inline `style={{ width }}` when the sidebar is open

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
