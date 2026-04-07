/**
 * CoordAdapter — coordinate-system bridge for ItemCanvas.
 *
 * Each mode (grid, free) provides an adapter that converts between:
 *  - Mouse/screen pixels
 *  - "Adapter coordinates" (grid: cell indices; free: mm positions)
 *  - Item store fields (posX/posY in mm, footprintW/H in mm)
 */

import type React from 'react'
import type { Item } from '@/lib/types'

/** Pixel rect used for rendering divs. */
export interface ItemRect {
  left:   number
  top:    number
  width:  number
  height: number
}

/** Adapter-internal coordinate — cells for grid, mm for free. */
export interface ACoord {
  x: number
  y: number
}

/** Adapter-internal size — cells for grid, mm for free. */
export interface ASize {
  w: number
  h: number
}

/**
 * Transient state while the user has pressed mousedown but hasn't moved far
 * enough to commit to a full drag. Cleared on mouseup or when drag is promoted.
 */
export interface PendingDrag {
  item: Item
  startClientX: number
  startClientY: number
  grabPxX: number
  grabPxY: number
}

/** Drag state stored in ItemCanvas (adapter-opaque). */
export interface CanvasDragState {
  /** Anchor (dragged) item id. */
  itemId: string
  /** Grab offset within the anchor item (px). */
  grabPxX: number
  grabPxY: number
  /** Footprint of anchor item (adapter units). */
  anchorSize: ASize
  /** All items being dragged, with relative offset from anchor (adapter units). */
  offsets: { id: string; dx: number; dy: number }[]
  /** Opaque adapter data for computing drops (clamping bounds, etc.). */
  adapterData: unknown
}

export interface ResizeState {
  itemId: string
  handle: 'e' | 's' | 'se'
  startMouseX: number
  startMouseY: number
  /** Initial dims in adapter units. */
  startDims: ASize
  /** Live preview dims in adapter units. */
  previewDims: ASize
}

export interface DrawState {
  startX: number
  startY: number
  endX:   number
  endY:   number
}

export interface ItemRenderCtx {
  isSelected:    boolean
  isDragging:    boolean
  isResizing:    boolean
  isSearchMatch: boolean
  /** Pixel dimensions of the item card. */
  cardRect: { width: number; height: number }
}

export interface CoordAdapter {
  /** Pixel rect for an item (position + size). */
  itemRect(item: Item): ItemRect

  /**
   * Prepare drag: compute offsets and any adapter-specific clamping data.
   * Returns `null` if the item should not be draggable (e.g. locked).
   */
  initDrag(
    item: Item,
    items: Item[],
    selectedIds: Set<string>,
  ): Pick<CanvasDragState, 'anchorSize' | 'offsets' | 'adapterData'>

  /**
   * Compute drop position from current mouse coordinates.
   * Returns `null` if the mouse is outside the valid drop zone.
   */
  computeDrop(
    clientX: number,
    clientY: number,
    grabPxX: number,
    grabPxY: number,
    dragState: CanvasDragState,
    containerEl: HTMLElement,
  ): ACoord | null

  /** Ghost overlay pixel rect for a co-dragged item at the given drop position. */
  ghostRect(item: Item, drop: ACoord, offset: { dx: number; dy: number }): ItemRect

  /** Convert confirmed drop position to store update fields. */
  applyDrop(item: Item, drop: ACoord, offset: { dx: number; dy: number }): { posX: number; posY: number }

  /** Initial resize dimensions in adapter units from item's current footprint. */
  initResizeDims(item: Item): ASize

  /** Compute live resize preview from accumulated mouse delta (px). */
  computeResizePreview(handle: 'e' | 's' | 'se', startDims: ASize, dxPx: number, dyPx: number): ASize

  /** Ghost overlay rect for the resize preview. */
  resizeGhostRect(item: Item, previewDims: ASize): ItemRect

  /** Human-readable size label shown in the resize popover (e.g. "84 × 42mm" or "2 × 1 cells"). */
  resizeLabel(dims: ASize): string

  /** Convert confirmed resize preview to item update fields. */
  applyResize(item: Item, previewDims: ASize): Partial<Item>

  /**
   * Convert a mouse position (client coords) to an adapter cell/coord.
   * Used for box-select anchor and draw-mode anchor.
   */
  mouseToCoord(clientX: number, clientY: number, containerEl: HTMLElement): ACoord

  /** Clamp a coord to the valid range (e.g. grid bounds). */
  clampCoord(coord: ACoord): ACoord

  /** Box-select: items whose footprint overlaps the selection rectangle. */
  boxSelectItems(items: Item[], start: ACoord, end: ACoord): Item[]

  /** Box-select overlay pixel rect. */
  boxSelectRect(start: ACoord, end: ACoord): ItemRect

  /** Check if a coord is already occupied (for draw-mode: don't start on occupied cell). */
  isOccupied(coord: ACoord, occupancyMap: Map<string, string>): boolean

  /** Build the occupancy map for background rendering and drag exclusion. */
  buildOccupancyMap(items: Item[], excludeIds?: Set<string>): Map<string, string>

  /**
   * Convert a draw-mode cell range (start–end coords) to the args passed to
   * `onDrawComplete(posX, posY, cols, rows)`.
   */
  drawRangeToArgs(start: ACoord, end: ACoord): { posX: number; posY: number; cols: number; rows: number }

  /**
   * CSS properties for the canvas container div.
   * Grid mode: display:grid with template columns/rows.
   * Free mode: fixed pixel size with position:relative.
   */
  containerStyle(): React.CSSProperties

  /**
   * Optional overlay rendered on top of items during an active drag.
   * Used by FreeAdapter to render snap guide lines.
   * Called after every computeDrop; return null when there is nothing to show.
   */
  getOverlay?(): React.ReactNode

  /**
   * Render the canvas background (grid cells, dot pattern, etc.).
   * Receives the occupancy map so cells can show occupied state.
   */
  renderBackground(
    occupancyMap: Map<string, string>,
    drawState: DrawState | null,
  ): React.ReactNode
}
