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
- In `isCategoryGroupOpen` (`drawer-tree/index.tsx`): for 'just-open', seed `expandedCategoryGroups` via `useEffect` on config change instead of computing deterministically
- The `useEffect` would set all matching keys into `expandedCategoryGroups`; subsequent manual toggles work normally since `expandedCategoryGroups.has(key)` is the source of truth

### Groups (quick-win via multi-select)
Items can belong to a named group (`groupId: string | null` on `Item`). The key behaviors:

- **Click a grouped item** → instantly multi-selects the entire group (all items sharing that `groupId`)
- **Click again (on an already-selected grouped item)** → narrows selection to just that one item
- **Multi-select drag** already moves all selected items together — no Ctrl needed once the group is selected

Likely quick to implement because:
- Multi-select, group drag, and `selectedItemIds` already exist
- The click handler in `drawer-grid.tsx` / `drawer-tree/index.tsx` just needs a branch: if the clicked item has a `groupId` and is not yet selected → `selectAll(groupMembers)`, if already selected → `selectItem(id)` (single)
- Groups need UI to assign (could be a field in the item form, or a "group selected" bulk action)
- No new drag logic needed — existing `repositionItems` handles it

Open questions:
- How to create/name groups (item form field vs. "group selected items" button in bulk context menu?)
- Show group membership visually on the grid (e.g. shared border/outline color)?
- Sidebar: show group as a sub-level, or just a badge on the item row?
