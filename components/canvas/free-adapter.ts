import React from 'react'
import { computeSnap, type SnapGuide } from '@/lib/cabinet-snap'
import type { Item } from '@/lib/types'
import type {
  CoordAdapter,
  ItemRect,
  ACoord,
  ASize,
  CanvasDragState,
  DrawState,
} from './coord-adapter'

/** Clamping data stored as adapterData in CanvasDragState. */
interface FreeAdapterData {
  minDx: number
  minDy: number
}

/**
 * CoordAdapter for free-positioning (cabinet view).
 * ACoord is in mm. Scale converts mm → px.
 *
 * Items are expected to have posX/posY (mm position) and
 * footprintW/footprintH (mm size, manual mode).
 */
export class FreeAdapter implements CoordAdapter {
  /** Snap guides computed during the last computeDrop call. */
  private _snapGuides: SnapGuide[] = []

  constructor(
    private readonly scale: number,
    private readonly snapThresholdPx: number,
    /**
     * All items currently on the canvas — used for snap computation.
     * Recreate the adapter when items change.
     */
    private readonly allItems: Item[],
  ) {}

  // ---------------------------------------------------------------------------
  // Position / size
  // ---------------------------------------------------------------------------

  itemRect(item: Item): ItemRect {
    return {
      left:   item.posX             * this.scale,
      top:    item.posY             * this.scale,
      width:  (item.footprintW ?? 0) * this.scale,
      height: (item.footprintH ?? 0) * this.scale,
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
    return {
      anchorSize: { w: item.footprintW ?? 0, h: item.footprintH ?? 0 },
      offsets,
      adapterData: { minDx, minDy } satisfies FreeAdapterData,
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
    const { minDx, minDy } = dragState.adapterData as FreeAdapterData
    const rect = containerEl.getBoundingClientRect()
    const rawX = (clientX - rect.left - grabPxX) / this.scale
    const rawY = (clientY - rect.top  - grabPxY) / this.scale

    // Build preview positions (pre-snap) for snap computation
    const draggedIds = new Set(dragState.offsets.map(o => o.id))
    const preSnapDragged = dragState.offsets.map(({ id, dx, dy }) => {
      const item = this.allItems.find(i => i.id === id)!
      return {
        id,
        label:    item.name,
        widthMm:  item.footprintW ?? 0,
        heightMm: item.footprintH ?? 0,
        x: rawX + dx,
        y: rawY + dy,
      }
    })
    const statics = this.allItems
      .filter(i => !draggedIds.has(i.id))
      .map(i => ({
        id:       i.id,
        label:    i.name,
        widthMm:  i.footprintW ?? 0,
        heightMm: i.footprintH ?? 0,
        x: i.posX,
        y: i.posY,
      }))

    const snap = computeSnap(preSnapDragged, statics, this.scale, this.snapThresholdPx)
    this._snapGuides = snap.guides

    return {
      x: Math.max(-minDx, rawX + snap.deltaXMm),
      y: Math.max(-minDy, rawY + snap.deltaYMm),
    }
  }

  ghostRect(item: Item, drop: ACoord, offset: { dx: number; dy: number }): ItemRect {
    return {
      left:   (drop.x + offset.dx) * this.scale,
      top:    (drop.y + offset.dy) * this.scale,
      width:  (item.footprintW ?? 0) * this.scale,
      height: (item.footprintH ?? 0) * this.scale,
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
    return { w: item.footprintW ?? 0, h: item.footprintH ?? 0 }
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
      footprintW: previewDims.w,
      footprintH: previewDims.h,
    }
  }

  // ---------------------------------------------------------------------------
  // Coordinate utilities
  // ---------------------------------------------------------------------------

  mouseToCoord(clientX: number, clientY: number, containerEl: HTMLElement): ACoord {
    const rect = containerEl.getBoundingClientRect()
    return {
      x: Math.max(0, (clientX - rect.left) / this.scale),
      y: Math.max(0, (clientY - rect.top)  / this.scale),
    }
  }

  clampCoord(coord: ACoord): ACoord {
    return { x: Math.max(0, coord.x), y: Math.max(0, coord.y) }
  }

  boxSelectItems(items: Item[], start: ACoord, end: ACoord): Item[] {
    const x1 = Math.min(start.x, end.x)
    const y1 = Math.min(start.y, end.y)
    const x2 = Math.max(start.x, end.x)
    const y2 = Math.max(start.y, end.y)
    return items.filter(i => {
      const r = i.posX + (i.footprintW ?? 0)
      const b = i.posY + (i.footprintH ?? 0)
      return r > x1 && i.posX < x2 && b > y1 && i.posY < y2
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

  drawRangeToArgs(start: ACoord, _end: ACoord) {
    return { posX: start.x, posY: start.y, cols: 1, rows: 1 }  // canDraw=false in free mode
  }

  // ---------------------------------------------------------------------------
  // Container + background
  // ---------------------------------------------------------------------------

  containerStyle(): React.CSSProperties {
    let maxX = 0, maxY = 0
    for (const i of this.allItems) {
      maxX = Math.max(maxX, i.posX + (i.footprintW ?? 0))
      maxY = Math.max(maxY, i.posY + (i.footprintH ?? 0))
    }
    return {
      position: 'relative',
      width:  Math.max(800, (maxX + 100) * this.scale),
      height: Math.max(600, (maxY + 100) * this.scale),
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
          { id: 'cabinet-dot-grid', x: 0, y: 0, width: spacing, height: spacing, patternUnits: 'userSpaceOnUse' },
          React.createElement('circle', { cx: spacing / 2, cy: spacing / 2, r: 1, className: 'fill-muted-foreground/20' }),
        ),
      ),
      React.createElement('rect', { width: '100%', height: '100%', fill: 'url(#cabinet-dot-grid)' }),
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
