# TODO

## Planned features

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
