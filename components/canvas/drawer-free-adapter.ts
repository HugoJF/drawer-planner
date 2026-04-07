import React from 'react'
import { computeSnap, type SnapGuide } from '@/lib/cabinet-snap'
import { getItemFootprintMm } from '@/lib/gridfinity'
import { FootprintMode } from '@/lib/types'
import type { Item, Drawer, GridfinityConfig } from '@/lib/types'
import type {
  CoordAdapter,
  ItemRect,
  ACoord,
  ASize,
  CanvasDragState,
  DrawState,
} from './coord-adapter'
import { CELL_SIZE } from './grid-adapter'

/** Clamping data stored as adapterData in CanvasDragState. */
interface DrawerFreeAdapterData {
  minDx: number
  minDy: number
}

/**
 * CoordAdapter for free mm-based positioning inside a single drawer.
 * ACoord is in mm. Scale converts mm → px (same visual density as GridAdapter).
 *
 * Items are clamped to the drawer's physical width × depth bounds.
 * Snap guides appear near other items (same as FreeAdapter).
 */
export class DrawerFreeAdapter implements CoordAdapter {
  private readonly scale: number
  /** Snap guides computed during the last computeDrop call. */
  private _snapGuides: SnapGuide[] = []

  constructor(
    private readonly drawer: Drawer,
    private readonly config: GridfinityConfig,
    /**
     * All items currently on the canvas — used for snap computation.
     * Recreate the adapter when items change.
     */
    private readonly allItems: Item[],
  ) {
    this.scale = CELL_SIZE / config.cellSize  // ~0.952 px/mm at default 42mm cell
  }

  // ---------------------------------------------------------------------------
  // Position / size
  // ---------------------------------------------------------------------------

  itemRect(item: Item): ItemRect {
    const { w, h } = getItemFootprintMm(item)
    return {
      left:   item.posX * this.scale,
      top:    item.posY * this.scale,
      width:  w * this.scale,
      height: h * this.scale,
    }
  }

  // ---------------------------------------------------------------------------
  // Drag
  // ---------------------------------------------------------------------------

  initDrag(item: Item, items: Item[], selectedIds: Set<string>) {
    const anchorX = item.posX
    const anchorY = item.posY
    const coDragged = selectedIds.has(item.id)
      ? items.filter(i => selectedIds.has(i.id) && !i.locked)
      : [item]
    const offsets = coDragged.map(i => ({
      id: i.id,
      dx: i.posX - anchorX,
      dy: i.posY - anchorY,
    }))
    let minDx = 0, minDy = 0
    for (const di of coDragged) {
      minDx = Math.min(minDx, di.posX - anchorX)
      minDy = Math.min(minDy, di.posY - anchorY)
    }
    const { w: anchorW, h: anchorH } = getItemFootprintMm(item)
    return {
      anchorSize: { w: anchorW, h: anchorH },
      offsets,
      adapterData: { minDx, minDy } satisfies DrawerFreeAdapterData,
    }
  }

  computeDrop(
    clientX: number,
    clientY: number,
    grabPxX: number,
    grabPxY: number,
    dragState: CanvasDragState,
    containerEl: HTMLElement,
  ): ACoord | null {
    const { minDx, minDy } = dragState.adapterData as DrawerFreeAdapterData
    const rect = containerEl.getBoundingClientRect()
    const rawX = (clientX - rect.left - grabPxX) / this.scale
    const rawY = (clientY - rect.top  - grabPxY) / this.scale

    // Build preview positions (pre-snap) for snap computation
    const draggedIds = new Set(dragState.offsets.map(o => o.id))
    const preSnapDragged = dragState.offsets.map(({ id, dx, dy }) => {
      const item = this.allItems.find(i => i.id === id)!
      const { w, h } = getItemFootprintMm(item)
      return {
        id,
        label:    item.name,
        widthMm:  w,
        heightMm: h,
        x: rawX + dx,
        y: rawY + dy,
      }
    })
    const statics = [
      // Drawer boundary — always present so items snap to walls even when alone
      { id: '__drawer__', label: '', widthMm: this.drawer.width, heightMm: this.drawer.depth, x: 0, y: 0 },
      ...this.allItems
        .filter(i => !draggedIds.has(i.id))
        .map(i => {
          const { w, h } = getItemFootprintMm(i)
          return {
            id:       i.id,
            label:    i.name,
            widthMm:  w,
            heightMm: h,
            x: i.posX,
            y: i.posY,
          }
        }),
    ]

    const snap = computeSnap(preSnapDragged, statics, this.scale, this.config.cabinetSnapThresholdPx)
    this._snapGuides = snap.guides

    // Clamp so the anchor item stays within drawer bounds
    const snappedX = rawX + snap.deltaXMm
    const snappedY = rawY + snap.deltaYMm
    return {
      x: Math.max(-minDx, Math.min(snappedX, this.drawer.width - dragState.anchorSize.w)),
      y: Math.max(-minDy, Math.min(snappedY, this.drawer.depth - dragState.anchorSize.h)),
    }
  }

  ghostRect(item: Item, drop: ACoord, offset: { dx: number; dy: number }): ItemRect {
    const { w, h } = getItemFootprintMm(item)
    return {
      left:   (drop.x + offset.dx) * this.scale,
      top:    (drop.y + offset.dy) * this.scale,
      width:  w * this.scale,
      height: h * this.scale,
    }
  }

  applyDrop(_item: Item, drop: ACoord, offset: { dx: number; dy: number }) {
    return {
      posX: drop.x + offset.dx,
      posY: drop.y + offset.dy,
    }
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  initResizeDims(item: Item): ASize {
    return getItemFootprintMm(item)
  }

  computeResizePreview(handle: 'e' | 's' | 'se', startDims: ASize, dxPx: number, dyPx: number): ASize {
    return {
      w: Math.max(1, startDims.w + (handle !== 's' ? dxPx / this.scale : 0)),
      h: Math.max(1, startDims.h + (handle !== 'e' ? dyPx / this.scale : 0)),
    }
  }

  resizeLabel(dims: ASize): string {
    return `${Math.round(dims.w)} × ${Math.round(dims.h)} mm`
  }

  resizeGhostRect(item: Item, previewDims: ASize): ItemRect {
    return {
      left:   item.posX * this.scale,
      top:    item.posY * this.scale,
      width:  previewDims.w * this.scale,
      height: previewDims.h * this.scale,
    }
  }

  applyResize(_item: Item, previewDims: ASize): Partial<Item> {
    return {
      footprintW: Math.max(1, Math.round(previewDims.w)),
      footprintH: Math.max(1, Math.round(previewDims.h)),
      footprintMode: FootprintMode.Manual,
    }
  }

  // ---------------------------------------------------------------------------
  // Coordinate utilities
  // ---------------------------------------------------------------------------

  mouseToCoord(clientX: number, clientY: number, containerEl: HTMLElement): ACoord {
    const rect = containerEl.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min((clientX - rect.left) / this.scale, this.drawer.width)),
      y: Math.max(0, Math.min((clientY - rect.top)  / this.scale, this.drawer.depth)),
    }
  }

  clampCoord(coord: ACoord): ACoord {
    return {
      x: Math.max(0, Math.min(coord.x, this.drawer.width)),
      y: Math.max(0, Math.min(coord.y, this.drawer.depth)),
    }
  }

  boxSelectItems(items: Item[], start: ACoord, end: ACoord): Item[] {
    const x1 = Math.min(start.x, end.x)
    const y1 = Math.min(start.y, end.y)
    const x2 = Math.max(start.x, end.x)
    const y2 = Math.max(start.y, end.y)
    return items.filter(i => {
      const { w, h } = getItemFootprintMm(i)
      return (i.posX + w) > x1 && i.posX < x2 && (i.posY + h) > y1 && i.posY < y2
    })
  }

  boxSelectRect(start: ACoord, end: ACoord): ItemRect {
    return {
      left:   Math.min(start.x, end.x) * this.scale,
      top:    Math.min(start.y, end.y) * this.scale,
      width:  Math.abs(end.x - start.x) * this.scale,
      height: Math.abs(end.y - start.y) * this.scale,
    }
  }

  isOccupied(_coord: ACoord, _map: Map<string, string>): boolean {
    return false  // no cell occupancy in free mode
  }

  buildOccupancyMap(_items: Item[], _excludeIds?: Set<string>): Map<string, string> {
    return new Map()  // unused in free mode
  }

  drawRangeToArgs(start: ACoord, end: ACoord) {
    return {
      posX: Math.min(start.x, end.x),
      posY: Math.min(start.y, end.y),
      cols: Math.max(1, Math.round(Math.abs(end.x - start.x))),  // mm
      rows: Math.max(1, Math.round(Math.abs(end.y - start.y))),  // mm
    }
  }

  // ---------------------------------------------------------------------------
  // Container + background
  // ---------------------------------------------------------------------------

  containerStyle(): React.CSSProperties {
    return {
      position: 'relative',
      width:  this.drawer.width * this.scale,
      height: this.drawer.depth * this.scale,
    }
  }

  renderBackground(_occupancyMap: Map<string, string>, _drawState: DrawState | null): React.ReactNode {
    const style = this.containerStyle()
    const w = style.width as number
    const h = style.height as number
    const spacing = 20 * this.scale
    return React.createElement(
      'svg',
      { className: 'absolute inset-0 pointer-events-none', width: w, height: h },
      React.createElement(
        'defs',
        null,
        React.createElement(
          'pattern',
          { id: 'drawer-free-dots', x: 0, y: 0, width: spacing, height: spacing, patternUnits: 'userSpaceOnUse' },
          React.createElement('circle', { cx: spacing / 2, cy: spacing / 2, r: 1, className: 'fill-muted-foreground/20' }),
        ),
      ),
      React.createElement('rect', { width: '100%', height: '100%', fill: 'url(#drawer-free-dots)' }),
      // Drawer physical boundary outline
      React.createElement('rect', {
        x: 0.5, y: 0.5, width: w - 1, height: h - 1,
        fill: 'none', strokeWidth: 1, className: 'stroke-border',
      }),
    )
  }

  // ---------------------------------------------------------------------------
  // Snap overlay
  // ---------------------------------------------------------------------------

  getOverlay(): React.ReactNode {
    if (this._snapGuides.length === 0) {
      return null
    }
    return this._snapGuides.map((guide, i) =>
      guide.axis === 'x'
        ? React.createElement('div', {
            key: `guide-x-${i}`,
            className: 'absolute top-0 bottom-0 w-px bg-blue-400/70 pointer-events-none',
            style: { left: guide.positionPx, zIndex: 50 },
          })
        : React.createElement('div', {
            key: `guide-y-${i}`,
            className: 'absolute left-0 right-0 h-px bg-blue-400/70 pointer-events-none',
            style: { top: guide.positionPx, zIndex: 50 },
          }),
    )
  }
}
