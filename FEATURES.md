# Gridfinity Drawer Planner — Feature Reference

## Table of Contents

1. [Overview](#1-overview)
2. [Layout](#2-layout)
3. [Drawers](#3-drawers)
4. [Items](#4-items)
5. [Grid View](#5-grid-view)
6. [Sidebar Tree](#6-sidebar-tree)
7. [Keyboard Shortcuts](#7-keyboard-shortcuts)
8. [Undo / Redo](#8-undo--redo)
9. [Settings](#9-settings)
10. [Sidebar Stats](#10-sidebar-stats)
11. [Delete Confirmation Dialog](#11-delete-confirmation-dialog)
12. [Units and Dimension Handling](#12-units-and-dimension-handling)
13. [Data Persistence, Export, and Import](#13-data-persistence-export-and-import)

---

## 1. Overview

The Gridfinity Drawer Planner is a browser-based tool for planning the layout of [Gridfinity](https://gridfinity.xyz/) modular bins inside physical drawers. It lets you:

- Define one or more physical drawers by their internal dimensions.
- Automatically compute how many Gridfinity cells fit in each drawer (accounting for cell size and tolerance).
- Add items (tools, parts, etc.) with real physical dimensions and assign them to drawers.
- Arrange items inside the grid view by dragging, resizing, or drawing new items directly on the canvas.
- Detect problems — overlapping items and items taller than their drawer — with inline visual warnings.
- Track every mutating action with unlimited undo/redo (50-step history).
- Persist the entire plan in the browser's local storage and export/import it as JSON.

All dimensions are stored internally in **millimetres** and converted to the chosen display unit only for presentation.

---

## 2. Layout

The application is a full-screen single-page layout divided into three regions.

### 2.1 Sidebar (left panel, 256 px wide)

The sidebar has two sections stacked vertically:

- **Organization area** (scrollable) — contains the drawer tree (section 6).
- **Drawer Stats panel** (pinned to the bottom of the sidebar) — shows statistics for the currently selected drawer (section 10).

The sidebar can be collapsed to zero width via the **PanelLeftClose** button in its header. When collapsed, a **PanelLeft** button appears in the main header to reopen it. The transition is animated (300 ms).

### 2.2 Header (top bar)

The header is always visible and contains, from left to right:

- **Sidebar toggle** — only shown when the sidebar is collapsed.
- **Page title / drawer name** — shows "Gridfinity Drawer Planner" when no drawer is selected; otherwise shows the selected drawer's name followed by its physical dimensions (W × D × H) formatted in the current display unit.
- **Undo button** (Undo2 icon) — disabled when there is nothing to undo.
- **Redo button** (Redo2 icon) — disabled when there is nothing to redo.
- **Settings button** — opens the settings popover (section 9).
- **Add Drawer button** — opens the drawer creation dialog.
- **Add Item button** — opens the item creation dialog; disabled when no drawer is selected.

### 2.3 Main content area

When no drawer is selected, the content area shows a centred empty-state card with a call-to-action button to add the first drawer. Once a drawer is selected, the area renders the **Grid View** (section 5).

---

## 3. Drawers

A drawer represents a single physical storage drawer. Each drawer has:

| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated unique identifier |
| `name` | string | User-supplied label |
| `width` | number (mm) | Internal width |
| `height` | number (mm) | Internal height (vertical clearance) |
| `depth` | number (mm) | Internal depth (front-to-back) |
| `gridCols` | number | Calculated: `floor((width − tolerance×2) / cellSize)` |
| `gridRows` | number | Calculated: `floor((depth − tolerance×2) / cellSize)` |

### 3.1 Creating a drawer

Triggered by the **Add Drawer** button in the header, the **+** button in the sidebar tree header, or the context menu on the grid background. Opens the **Drawer Form** dialog.

**Drawer Form fields:**

- **Name** (text, required) — descriptive label.
- **Width** (number, step 0.1, required) — in the current display unit.
- **Height** (number, step 0.1, required) — in the current display unit.
- **Depth** (number, step 0.1, required) — in the current display unit.

**Live grid preview** — as width and depth are typed, a preview section appears showing the computed grid dimensions (columns × rows and total cell count), and a note confirming the cell size and tolerance used.

On submission, all values are converted from the display unit to millimetres, the grid is calculated, a unique ID is generated, and the new drawer is immediately selected and visible in the grid view. The action is pushed to the undo stack.

### 3.2 Editing a drawer

Triggered by double-clicking the drawer row in the sidebar tree, selecting **Edit** from the drawer's `...` dropdown or right-click context menu in the sidebar, or right-clicking the grid background and selecting **Edit drawer**. Opens the same Drawer Form pre-populated with the existing values.

On save, the grid dimensions are recalculated from the new physical size. The action is pushed to the undo stack.

### 3.3 Duplicating a drawer

Available from the drawer's `...` dropdown, its right-click context menu in the sidebar, and the right-click context menu on the grid background. Creates a full copy of the drawer with the name `"<name> (copy)"`, copies all items assigned to the original into the new drawer (preserving their positions and properties, but giving them new IDs), and immediately selects the new drawer. The action is pushed to the undo stack.

### 3.4 Deleting a drawer

Triggers the **Delete Confirmation Dialog** (section 11). On confirmation, the drawer is removed and the selection is cleared. The action is pushed to the undo stack.

### 3.5 Grid dimension calculation

Grid dimensions are derived deterministically from physical dimensions and the Gridfinity configuration:

```
effectiveSpace = physicalDimension − (tolerance × 2)
gridCells      = floor(effectiveSpace / cellSize)
```

This is applied independently for width (→ `gridCols`) and depth (→ `gridRows`). Height is not gridded; it is used only to check whether an item fits vertically. Whenever the configuration changes (cell size or tolerance), all drawer grid dimensions are recalculated automatically.

---

## 4. Items

An item represents a physical object to be stored. Each item has:

| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated unique identifier |
| `name` | string | User-supplied label |
| `width` | number (mm) | Physical width |
| `height` | number (mm) | Physical height |
| `depth` | number (mm) | Physical depth |
| `color` | string (hex) | Colour for grid visualisation |
| `rotation` | `'normal'` \| `'layDown'` \| `'rotated'` | Orientation (see below) |
| `drawerId` | string \| null | Assigned drawer, or null if unassigned |
| `gridX` | number | Column position within the drawer grid (0-based) |
| `gridY` | number | Row position within the drawer grid (0-based) |

### 4.1 Creating an item

Triggered by the **Add Item** button (requires a drawer to be selected), or by drawing on the grid (section 5.4), which pre-populates the position and dimensions. Opens the **Item Form** dialog.

**Item Form fields:**

- **Name** (text, required).
- **Drawer** (select) — choose an existing drawer or "Unassigned". Defaults to the currently selected drawer.
- **Width** (number, step 0.1, required) — in the current display unit, in the item's original orientation.
- **Height** (number, step 0.1, required) — in the current display unit, in the item's original orientation.
- **Depth** (number, step 0.1, required) — in the current display unit, in the item's original orientation.
- **Color** — a palette of 8 preset colours (blue, emerald, amber, red, violet, pink, cyan, lime). A random colour is selected by default for new items.
- **Rotation** — select from Normal, Lay Down, or Rotated 90deg.

**Live grid preview** — when all three dimensions are non-zero, a preview panel shows:
- Grid footprint: `<W> x <D>` cells (after applying rotation).
- Height: the effective height in mm and the corresponding number of height units (U).
- The active rotation label.

On submission, values are converted to mm and stored. The action is pushed to the undo stack. The new item is immediately selected.

### 4.2 Editing an item

Triggered by double-clicking an item in the grid view, double-clicking an item row in the sidebar tree, pressing `E` while an item is selected, or selecting **Edit** from any context menu or `...` dropdown. Opens the Item Form pre-populated with existing values.

### 4.3 Duplicating an item

Available from the right-click context menu on the grid, the item's `...` dropdown in the sidebar, and its right-click context menu in the sidebar. The duplicate:

- Gets the name `"<name> (copy)"`.
- Is placed at the first available empty position in the same drawer (row-major scan). If no free position exists, it is placed at the same grid coordinates as the original, and a toast notification is shown: **"No space available — Item was placed at the same position as the original."**
- The action is pushed to the undo stack.

### 4.4 Deleting an item

Triggered by pressing `Delete`/`Backspace` while an item is selected and no form is open, or by selecting **Delete** from any context menu or `...` dropdown. All deletion paths route through the **Delete Confirmation Dialog** (section 11) or execute immediately (keyboard shortcut deletes immediately without a dialog). The action is pushed to the undo stack.

### 4.5 Item colours

Eight colours are available:

| Label | Hex |
|---|---|
| Blue | `#3b82f6` |
| Emerald | `#10b981` |
| Amber | `#f59e0b` |
| Red | `#ef4444` |
| Violet | `#8b5cf6` |
| Pink | `#ec4899` |
| Cyan | `#06b6d4` |
| Lime | `#84cc16` |

The selected colour is shown with a ring outline in the picker.

### 4.6 Rotation modes

Rotation affects how the item's physical dimensions map onto the grid and into the drawer height. The three modes are:

| Mode | Grid footprint (W × D) | Effective height |
|---|---|---|
| `normal` | `item.width × item.depth` | `item.height` |
| `layDown` | `item.width × item.height` | `item.depth` |
| `rotated` | `item.depth × item.width` | `item.height` |

After rotation, the grid cells occupied are computed as:
```
gridWidth = ceil(effectiveWidth  / cellSize)   (minimum 1)
gridDepth = ceil(effectiveDepth  / cellSize)   (minimum 1)
```

The height units displayed in the preview are `ceil(effectiveHeight / heightUnit)`.

Rotation can be changed:
- Via the **Rotation** select in the Item Form.
- Via the **rotate button** (circular arrow) that appears in the top-right corner of a selected item in the grid view.
- Via the `R` keyboard shortcut when an item is selected. Each press cycles through `normal → layDown → rotated → normal`.

### 4.7 Assigning items to drawers

An item can be assigned or reassigned to a drawer:
- In the Item Form's **Drawer** dropdown (setting "Unassigned" removes the assignment).
- By dragging the item row in the sidebar tree onto a drawer row or onto the Unassigned Items drop zone.
- Via the **Move to** submenu in the item's right-click context menu (available in both the grid and the sidebar tree). The submenu lists all drawers; the current drawer is disabled. Drawers where the item would be oversized show a warning icon. An "Unassigned" option is also present (disabled if the item is already unassigned).
- By dropping the item card in the grid view onto the grid of a different drawer (the grid view only manages the currently displayed drawer, but the sidebar drag-and-drop handles cross-drawer reassignment).

---

## 5. Grid View

The grid view is shown in the main content area when a drawer is selected. It renders the selected drawer's Gridfinity grid and all items assigned to it.

### 5.1 Grid rendering

The grid is rendered as a CSS grid with `gridCols` columns and `gridRows` rows, each cell being 40 px wide and 40 px tall with a 1 px gap. The resulting cell step is 41 px. Empty cells show a faint border background that darkens slightly on hover. Occupied cells show a muted background. The grid scrolls if it exceeds the available viewport area.

### 5.2 Item cards

Each item is rendered as an absolutely-positioned `div` overlaid on the grid. Its position and size in pixels are computed from `gridX`, `gridY`, `gridWidth`, and `gridDepth`:

```
left   = gridX * 41 + 1
top    = gridY * 41 + 1
width  = gridWidth  * 40 + (gridWidth  − 1)
height = gridDepth  * 40 + (gridDepth  − 1)
```

The card shows:
- The item name (truncated, white text with drop shadow).
- The grid footprint in `W×D` notation (white/80 text, 10 px).

**Visual states:**

| State | Visual cue |
|---|---|
| Default | Thin dark border, item colour fill |
| Selected | Blue ring (`ring-1 ring-primary`) with offset, z-index elevated to 10 |
| Dragging | 50% opacity |
| Resizing | 40% opacity |
| Overlapping (non-oversized) | Amber border, 60% opacity, amber warning badge (top-left) |
| Oversized | Red (destructive) border, red warning badge (top-right, clickable dropdown) |

### 5.3 Selecting an item

Clicking an item card selects it (updates `selectedItemId` in the store; does not push to undo). The item receives a visible selection ring. Clicking the grid background does not deselect (selection is cleared only on undo/redo if the item no longer exists, or explicitly).

### 5.4 Draw-to-create

On an empty cell (not occupied, no drag or resize in progress), pressing the mouse button begins a draw gesture:

1. The cursor changes to `crosshair`.
2. Dragging the mouse over adjacent cells highlights the spanned rectangle in green (`bg-emerald-500/25`).
3. Releasing the mouse (`mouseup`) calculates the rectangle:
   - `gridX = min(startX, endX)`, `gridY = min(startY, endY)`
   - `width = cols × cellSize`, `depth = rows × cellSize` (in mm)
4. The Item Form opens with the position and dimensions pre-filled.

The draw gesture is cancelled if the mouse leaves the grid element (`mouseleave`).

### 5.5 Drag to move

An item card is draggable (when no resize is active). Dragging uses the HTML5 Drag-and-Drop API:

1. `dragstart` records the item ID, the pixel offset within the card where the drag started (`grabPxX`, `grabPxY`), and the item's grid dimensions.
2. As the drag moves over the grid (`dragover`), the drop target position is calculated by:
   ```
   cellX = round((clientX − gridLeft − grabPxX) / cellStep)
   cellY = round((clientY − gridTop  − grabPxY) / cellStep)
   ```
   The result is clamped so the item stays within the drawer bounds. The cells that would be covered are highlighted in blue (`bg-primary/20`).
3. On `drop`, `moveItem` is called with the new position. The action is pushed to the undo stack.
4. The dragging item is rendered at 50% opacity during the drag.
5. If the drag leaves the grid container, the drop preview is cleared.

### 5.6 Resize handles

When an item is selected, three resize handles appear on its edges:

| Handle | Position | Cursor | Controls |
|---|---|---|---|
| **East (E)** | Centre of right edge | `e-resize` | Width only |
| **South (S)** | Centre of bottom edge | `s-resize` | Depth only |
| **Southeast (SE)** | Bottom-right corner | `se-resize` | Width and depth |

**Resize behaviour:**

1. `mousedown` on a handle records the starting mouse position and the item's current grid dimensions.
2. `mousemove` on the grid element computes the delta in cells:
   ```
   dx = round((clientX − startMouseX) / cellStep)
   dy = round((clientY − startMouseY) / cellStep)
   ```
   New preview dimensions are `max(1, startWidth + dx)` for width and `max(1, startDepth + dy)` for depth, with each handle only affecting its relevant axis.
3. A **resize ghost overlay** is rendered over the original item as a dashed-border rectangle at the preview size, with a tooltip label showing `<previewWidth> × <previewDepth>`.
4. On `mouseup`, the resize is committed. The new pixel dimensions are converted back to physical mm dimensions respecting the item's rotation:
   - `normal`: `width = previewWidth × cellSize`, `depth = previewDepth × cellSize`
   - `rotated`: `depth = previewWidth × cellSize`, `width = previewDepth × cellSize`
   - `layDown`: `width = previewWidth × cellSize`, `height = previewDepth × cellSize`
5. The action is pushed to the undo stack.
6. Resize is cancelled if the mouse leaves the grid element.

### 5.7 Double-click to edit

Double-clicking an item card opens the Item Form for that item.

### 5.8 Rotate button

When an item is selected, a circular-arrow button appears in its top-right corner (underneath the oversized warning badge if one is present). Clicking it cycles the rotation to the next mode (`normal → layDown → rotated → normal`). The action is pushed to the undo stack.

### 5.9 Overlap warning

If an item occupies any grid cell also occupied by another item, it receives:
- An amber (`amber-500`) border.
- 60% opacity.
- A small amber triangle badge in the top-left corner with the tooltip "Overlapping with another item".

The overlap check is performed using axis-aligned bounding-box intersection on grid coordinates. Overlapping is detected for both items involved.

### 5.10 Oversized warning

If an item's effective height (after rotation) exceeds the drawer's height, it receives:
- A red (`destructive`) border.
- A red triangle badge in the top-right corner that opens a dropdown on click.

The dropdown shows:
- The exact heights involved: `<itemHeight> > <drawerHeight>`.
- A list of other drawers where the item would fit (filtered to drawers whose height is ≥ the item's effective height, excluding the current drawer). Clicking a drawer name moves the item to that drawer at position (0, 0).
- If no suitable drawer exists: "No suitable drawers available. Try rotating."

### 5.11 Context menu (right-click on grid)

Right-clicking on an **item** shows a 4-option context menu:
- **Edit** — opens the Item Form.
- **Duplicate** — duplicates the item (with no-space toast if needed).
- **Move to** (submenu) — lists all drawers and the "Unassigned" option.
- **Delete** — opens the Delete Confirmation Dialog.

Right-clicking on the **grid background** (not on an item) shows a 3-option context menu:
- **Edit drawer** — opens the Drawer Form.
- **Duplicate drawer** — duplicates the drawer and all its items.
- **Delete drawer** — opens the Delete Confirmation Dialog.

---

## 6. Sidebar Tree

The sidebar tree is a scrollable panel that organises all drawers and items hierarchically.

### 6.1 Drawer list

Each drawer is shown as a collapsible row containing:
- A chevron toggle (expand/collapse) that does not propagate the click to the row itself.
- A folder icon.
- The drawer name (truncated).
- An alert triangle icon (red) if any item in the drawer exceeds the drawer's height (tooltip: "Contains items that exceed drawer height").
- The item count (number).
- A `...` (MoreHorizontal) button visible on hover, opening the drawer dropdown menu.

**Clicking a drawer row** selects that drawer (shows it in the grid view). A second click within 400 ms (double-click simulation) opens the Drawer Form for editing.

**Expanding a drawer** reveals its items indented under a left border. An empty drawer shows "No items" in italic.

### 6.2 Item list per drawer

Each item within an expanded drawer is shown as a row containing:
- A small coloured square matching the item's colour.
- A box icon (red if oversized in this drawer).
- The item name (truncated).
- An alert triangle icon (red) with a tooltip showing the exact height comparison if the item is oversized.
- A `...` button visible on hover, opening the item dropdown menu.

**Clicking an item row** selects the drawer and the item. A second click within 400 ms opens the Item Form.

### 6.3 Unassigned items drop zone

Below the drawer list is a section labelled "Unassigned Items". It contains a dashed-border drop zone that:
- Shows "Drop items here to unassign" when empty.
- Lists unassigned items using the same TreeItem component (without the oversized check, since there is no drawer).
- Highlights with a blue border and light background when a drag is in progress.

Dropping an item from the sidebar tree onto this zone calls `moveItem(itemId, null, 0, 0)`, unassigning the item.

### 6.4 Drag to reassign

Any item row in the sidebar tree is draggable. Dragging uses the HTML5 API:
- The item ID is set as drag data.
- The item row fades to 50% opacity during drag.
- Drawer rows accept drops: dropping an item onto a drawer row moves the item to that drawer at position (0, 0).
- The Unassigned Items drop zone also accepts drops.

### 6.5 Expand/collapse

The `Collapsible` component tracks which drawers are expanded in local component state (`expandedDrawers: Set<string>`). Expand state is not persisted across page reloads. Clicking the chevron button toggles expansion without selecting the drawer.

### 6.6 Double-click to edit

Both drawer rows and item rows implement a manual double-click detector with a 400 ms window using a ref (`lastClickRef`). A single click performs selection; two clicks within the window open the Edit form.

### 6.7 Right-click context menus

Both drawer rows and item rows support right-click context menus with the same actions as their respective `...` dropdown menus (Edit, Duplicate, Move to [items only], Delete). The menus are implemented with the `ContextMenu` primitive and share the same action components (`DrawerMenuActions`, `ItemMenuActions`).

### 6.8 `...` dropdown menu

The three-dot (`MoreHorizontal`) button on each drawer and item row is hidden (`opacity-0`) by default and becomes visible (`opacity-100`) on group hover. It opens a `DropdownMenu` anchored to the end of the row. Clicking it stops event propagation to prevent the row click handler from firing.

**Drawer dropdown actions:** Edit, Duplicate, (separator), Delete.

**Item dropdown actions:** Edit, Duplicate, Move to (submenu with all drawers + Unassigned), (separator), Delete.

---

## 7. Keyboard Shortcuts

All shortcuts are registered on the `window` `keydown` event and are suppressed when focus is inside an `<input>` or `<textarea>`.

| Shortcut | Action | Conditions |
|---|---|---|
| `Ctrl+Z` / `Cmd+Z` | Undo | Always active |
| `Ctrl+Y` / `Cmd+Y` | Redo | Always active |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo | Always active |
| `Delete` / `Backspace` | Delete selected item immediately | Item selected, no form open |
| `E` | Edit selected item (opens Item Form) | Item selected, no form open, no Ctrl/Cmd modifier |
| `R` | Cycle rotation of selected item | Item selected, no form open, no Ctrl/Cmd modifier |

**Notes:**
- The Delete/Backspace shortcut bypasses the Delete Confirmation Dialog and deletes immediately. This is undoable via Ctrl+Z.
- The `R` shortcut cycles `normal → layDown → rotated → normal` on each press.
- Shortcuts are inactive while the Drawer Form or Item Form is open (`drawerFormOpen` or `itemFormOpen` state is true).

---

## 8. Undo / Redo

### 8.1 Mechanism

The store maintains two arrays, `past` and `future`, each holding **snapshots** of the full state: `{ drawers, items, config }`.

Before every mutating action, the current state is pushed onto `past` (with `future` cleared) via the internal `push()` function. The `past` array is capped at 50 entries — older snapshots are dropped.

**Undo** pops the last entry from `past`, sets it as the current state, and pushes the current state onto `future` (capped at 50).

**Redo** takes the first entry from `future`, sets it as the current state, and pushes the current state back onto `past`.

After undo or redo, the `selectedDrawerId` and `selectedItemId` are preserved if they still exist in the restored state; otherwise they are set to null.

### 8.2 Actions tracked (push to undo stack)

Every state mutation pushes a snapshot:
- `addDrawer`
- `updateDrawer`
- `deleteDrawer`
- `duplicateDrawer`
- `addItem`
- `updateItem`
- `deleteItem`
- `duplicateItem`
- `moveItem`
- `updateConfig`
- `importData`

### 8.3 Actions NOT tracked (do not push to undo stack)

- `selectDrawer` — selecting a drawer does not create an undo entry.
- `selectItem` — selecting an item does not create an undo entry.

**Consequence:** undo/redo restores data state (drawers, items, config) but does not restore selection state beyond what is implied by whether the previously selected ID still exists.

### 8.4 Undo/Redo availability

- The **Undo** button in the header is disabled when `past.length === 0`.
- The **Redo** button is disabled when `future.length === 0`.
- Both buttons also respond to keyboard shortcuts at all times (even when a form is open).

### 8.5 50-step limit

The `past` array stores at most 50 snapshots (`past.slice(-49)` before appending). The `future` array is also capped to 50 (`future.slice(0, 49)` during undo). Actions beyond the 50-step limit silently discard the oldest entry.

---

## 9. Settings

The settings panel is accessible via the **Settings** button (gear icon) in the header. It opens as a popover anchored to the end of the header.

### 9.1 Display Unit

Controls how all dimensions are displayed throughout the application.

| Option | Value |
|---|---|
| mm | Millimetres (default) |
| cm | Centimetres |

Changing the display unit immediately re-renders all dimension labels, form placeholders, and the item/drawer form inputs. All stored values remain in mm; only the presentation changes.

### 9.2 Gridfinity Parameters

These four parameters directly affect grid calculations and are always stored in mm regardless of the display unit setting.

#### Cell Size

- **Default:** 42 mm
- **Input:** number, step 0.1, min 1
- The nominal width and depth of one Gridfinity cell. The standard Gridfinity spec uses 42 mm.
- Changing this value triggers recalculation of `gridCols` and `gridRows` for every drawer.

#### Height Unit

- **Default:** 7 mm (= 1U)
- **Input:** number, step 0.1, min 1
- The height increment for one Gridfinity height unit. Items display their height as `ceil(effectiveHeight / heightUnit)` U.
- Changing this value affects only the height-unit display in the Item Form preview; it does not change drawer grid dimensions.

#### Tolerance

- **Default:** 0.5 mm
- **Input:** number, step 0.1, min 0
- Applied as a gap on both sides of the drawer in each horizontal dimension before calculating the grid:
  ```
  effectiveSpace = dimension − (tolerance × 2)
  ```
- Changing tolerance triggers recalculation of all drawer grids.

#### Wall Thickness

- **Default:** 1.2 mm
- **Input:** number, step 0.1, min 0
- Represents the Gridfinity bin wall thickness. Stored in config but not currently used in layout calculations (available for future use or custom integrations).

### 9.3 Reset to Defaults

A **"Reset to defaults"** button restores all four Gridfinity parameters and the display unit to the defaults specified in `DEFAULT_CONFIG`. This action is pushed to the undo stack.

### 9.4 Immediate Application

A note at the bottom of the popover states: "Changes apply immediately and recalculate all drawer grids." All config changes call `updateConfig`, which is pushed to the undo stack and causes all drawer grid dimensions to be recalculated synchronously.

---

## 10. Sidebar Stats

The stats panel is pinned to the bottom of the sidebar. When no drawer is selected, it shows "Select a drawer to view stats". When a drawer is selected, it shows the following metrics for that drawer.

### 10.1 Grid Cells

- **Display:** `<availableCells>/<totalCells>`
- **Progress bar:** filled proportionally to `usedCells / totalCells` (percentage).
- `totalCells = gridCols × gridRows`
- `usedCells` = number of distinct grid coordinates occupied by at least one item (using a `Set` to de-duplicate overlapping cells).
- `availableCells = totalCells − usedCells`

### 10.2 Volume Utilisation

- **Display:** percentage (0–100%), rounded to the nearest integer.
- **Progress bar:** filled to the percentage.
- `volumeUtilisation = (sum of all item volumes / drawer volume) × 100`
- Item volume = `effectiveWidth × effectiveHeight × effectiveDepth` (after rotation).
- Drawer volume = `width × height × depth`.
- Capped at 100%.

### 10.3 Dead Room

- **Display:** formatted dimension in the current display unit (e.g., `25mm`).
- **Tooltip:** "Unused height (drawer height − tallest item)"
- `deadRoom = max(0, drawer.height − tallestItemHeight)`
- `tallestItemHeight` = the highest effective height among all items in the drawer (after rotation). Zero if the drawer is empty.

### 10.4 Height Warnings

- **Display:** count of items with height exceeding the drawer height, shown with a red alert triangle icon.
- **Tooltip:** `"<n> item(s) exceed drawer height"`
- Only shown when `heightWarnings > 0`.

### 10.5 Item Count

- **Display:** `"<n> item(s) in drawer"` (grammatically correct singular/plural).

### 10.6 Grid Dimensions and Cell Size

- **Grid:** `<gridCols> × <gridRows>` (raw cell count).
- **Cell size:** formatted in the current display unit (e.g., `42mm`).

---

## 11. Delete Confirmation Dialog

A modal alert dialog (`AlertDialog`) is shown before any deletion to prevent accidental data loss. It is triggered from context menus, dropdown menus, and the sidebar tree for both drawers and items.

### 11.1 Item deletion

- **Title:** "Delete item?"
- **Description:** `"<name>" will be permanently deleted.`
- **Buttons:** Cancel | Delete (destructive styling).
- No additional options.
- On confirm: `deleteItem(id)` is called. The action is pushed to the undo stack.

### 11.2 Drawer deletion

- **Title:** "Delete drawer?"
- **Description** (dynamic, updates as the checkbox changes):
  - Unchecked: `"<name>" will be removed and its items will become unassigned.`
  - Checked: `"<name>" will be removed along with all its items.`
- **Checkbox:** "Also delete all items in this drawer" — defaults to unchecked each time the dialog opens.
- **Buttons:** Cancel | Delete (destructive styling).
- On confirm:
  - If checkbox is unchecked: the drawer is deleted and all its items have `drawerId` set to null and `gridX`/`gridY` reset to 0 (they move to the Unassigned pool).
  - If checkbox is checked: the drawer and all its items are permanently deleted.
- The action is pushed to the undo stack.

### 11.3 Keyboard shortcut bypass

The `Delete`/`Backspace` keyboard shortcut for items does **not** show this dialog — it deletes the selected item immediately. This is intentional (quick workflow) and is fully undoable.

---

## 12. Units and Dimension Handling

### 12.1 Internal storage

All dimensions — for both drawers and items — are stored in **millimetres** in the Zustand store and in local storage. The display unit is a view-layer concern only.

### 12.2 Display units

The `DimensionUnit` type is `'mm' | 'cm'`. Conversion functions:

| Function | Logic |
|---|---|
| `toDisplayUnit(mm, unit)` | `unit === 'cm' ? mm / 10 : mm` |
| `fromDisplayUnit(value, unit)` | `unit === 'cm' ? value * 10 : value` |
| `formatDimension(mm, unit)` | Converts then appends unit suffix: `"42mm"` or `"4.2cm"` |

### 12.3 Form behaviour

- Drawer Form and Item Form read `config.displayUnit` and label all inputs with the active unit.
- On open, existing mm values are converted to the display unit for the input fields.
- On submit, display-unit values are converted back to mm before storage.
- Form placeholders adjust to the active unit (e.g., width placeholder is `"40"` for cm, `"400"` for mm).

### 12.4 Dimensions displayed in the UI

| Location | Dimension shown |
|---|---|
| Header (drawer selected) | W × D × H of the drawer |
| Sidebar stats — Dead Room | mm value formatted in display unit |
| Sidebar stats — Cell size | Cell size formatted in display unit |
| Item Form preview — Height | Always shown in raw mm plus U count |
| Oversized dropdown | Item height and drawer height formatted in display unit |
| Oversized tooltip in sidebar tree | Item height and drawer height formatted in display unit |

---

## 13. Data Persistence, Export, and Import

### 13.1 Local storage persistence

The store uses Zustand's `persist` middleware with the key `"gridfinity-drawer-planner"`. The persisted fields are `config`, `drawers`, and `items`. Selection state (`selectedDrawerId`, `selectedItemId`) and undo/redo history (`past`, `future`) are not persisted — they reset on page reload.

### 13.2 Export

The **Export** button in the Settings panel triggers a browser file download named `gridfinity-planner-<YYYY-MM-DD>.json`. The file is a JSON object with the following structure:

```json
{
  "version": "1.0",
  "exportDate": "<ISO 8601 timestamp>",
  "config": { ... },
  "drawers": [ ... ],
  "items": [ ... ]
}
```

All values in `drawers` and `items` are in millimetres.

### 13.3 Import

The **Import** button opens a native file picker filtered to `.json` files. On selection, the file is read via `FileReader`, parsed as JSON, and validated (must have `version`, `drawers`, and `items` fields). On success:
- The imported `config` is merged with `DEFAULT_CONFIG` (missing keys fall back to defaults).
- `drawers` and `items` replace the current state entirely.
- `selectedDrawerId` and `selectedItemId` are reset to null.
- A snapshot is pushed to the undo stack before the import is applied, making it undoable.

If the file cannot be parsed, an `alert()` is shown: "Failed to import: Invalid file format".
