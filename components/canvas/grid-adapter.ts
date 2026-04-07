import React from 'react'
import { cn } from '@/lib/utils'
import { calculateItemGridDimensions } from '@/lib/gridfinity'
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

export const CELL_SIZE = 40 // px per grid cell for visualization
const cellStep = CELL_SIZE + 1

function gridPos(cell: number) { return cell * cellStep + 1 }
function gridSize(cells: number) { return cells * cellStep - 1 }

interface GridAdapterData {
  minDx: number
  minDy: number
  maxRight: number
  maxBottom: number
}

export class GridAdapter implements CoordAdapter {
  constructor(
    private readonly drawer: Drawer,
    private readonly config: GridfinityConfig,
  ) {}

  itemRect(item: Item): ItemRect {
    const dims = calculateItemGridDimensions(item, this.config)
    const cellX = Math.round(item.posX / this.config.cellSize)
    const cellY = Math.round(item.posY / this.config.cellSize)
    return {
      left:   gridPos(cellX),
      top:    gridPos(cellY),
      width:  gridSize(dims.gridWidth),
      height: gridSize(dims.gridDepth),
    }
  }

  initDrag(item: Item, items: Item[], selectedIds: Set<string>) {
    const dims = calculateItemGridDimensions(item, this.config)
    const anchorCellX = Math.round(item.posX / this.config.cellSize)
    const anchorCellY = Math.round(item.posY / this.config.cellSize)
    const coDragged = selectedIds.has(item.id)
      ? items.filter(i => selectedIds.has(i.id) && !i.locked)
      : [item]
    const offsets = coDragged.map(i => ({
      id: i.id,
      dx: Math.round(i.posX / this.config.cellSize) - anchorCellX,
      dy: Math.round(i.posY / this.config.cellSize) - anchorCellY,
    }))
    let minDx = 0, minDy = 0, maxRight = dims.gridWidth, maxBottom = dims.gridDepth
    for (const di of coDragged) {
      const diDims = calculateItemGridDimensions(di, this.config)
      const odx = Math.round(di.posX / this.config.cellSize) - anchorCellX
      const ody = Math.round(di.posY / this.config.cellSize) - anchorCellY
      minDx     = Math.min(minDx,     odx)
      minDy     = Math.min(minDy,     ody)
      maxRight  = Math.max(maxRight,  odx + diDims.gridWidth)
      maxBottom = Math.max(maxBottom, ody + diDims.gridDepth)
    }
    return {
      anchorSize: { w: dims.gridWidth, h: dims.gridDepth },
      offsets,
      adapterData: { minDx, minDy, maxRight, maxBottom } satisfies GridAdapterData,
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
    const { minDx, minDy, maxRight, maxBottom } = dragState.adapterData as GridAdapterData
    const rect = containerEl.getBoundingClientRect()
    const rawX = Math.round((clientX - rect.left - grabPxX) / cellStep)
    const rawY = Math.round((clientY - rect.top  - grabPxY) / cellStep)
    return {
      x: Math.max(-minDx, Math.min(rawX, this.drawer.gridCols - maxRight)),
      y: Math.max(-minDy, Math.min(rawY, this.drawer.gridRows - maxBottom)),
    }
  }

  ghostRect(item: Item, drop: ACoord, offset: { dx: number; dy: number }): ItemRect {
    const dims = calculateItemGridDimensions(item, this.config)
    return {
      left:   gridPos(drop.x + offset.dx),
      top:    gridPos(drop.y + offset.dy),
      width:  gridSize(dims.gridWidth),
      height: gridSize(dims.gridDepth),
    }
  }

  applyDrop(_item: Item, drop: ACoord, offset: { dx: number; dy: number }) {
    return {
      posX: (drop.x + offset.dx) * this.config.cellSize,
      posY: (drop.y + offset.dy) * this.config.cellSize,
    }
  }

  initResizeDims(item: Item): ASize {
    const dims = calculateItemGridDimensions(item, this.config)
    return { w: dims.gridWidth, h: dims.gridDepth }
  }

  computeResizePreview(handle: 'e' | 's' | 'se', startDims: ASize, dxPx: number, dyPx: number): ASize {
    const dxCells = Math.round(dxPx / cellStep)
    const dyCells = Math.round(dyPx / cellStep)
    return {
      w: Math.max(1, startDims.w + (handle !== 's' ? dxCells : 0)),
      h: Math.max(1, startDims.h + (handle !== 'e' ? dyCells : 0)),
    }
  }

  resizeGhostRect(item: Item, previewDims: ASize): ItemRect {
    const cellX = Math.round(item.posX / this.config.cellSize)
    const cellY = Math.round(item.posY / this.config.cellSize)
    return {
      left:   gridPos(cellX),
      top:    gridPos(cellY),
      width:  gridSize(previewDims.w),
      height: gridSize(previewDims.h),
    }
  }

  applyResize(_item: Item, previewDims: ASize): Partial<Item> {
    return {
      footprintMode: FootprintMode.Manual,
      footprintW: previewDims.w * this.config.cellSize,
      footprintH: previewDims.h * this.config.cellSize,
    }
  }

  mouseToCoord(clientX: number, clientY: number, containerEl: HTMLElement): ACoord {
    const rect = containerEl.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(this.drawer.gridCols - 1, Math.floor((clientX - rect.left) / cellStep))),
      y: Math.max(0, Math.min(this.drawer.gridRows - 1, Math.floor((clientY - rect.top)  / cellStep))),
    }
  }

  clampCoord(coord: ACoord): ACoord {
    return {
      x: Math.max(0, Math.min(this.drawer.gridCols - 1, coord.x)),
      y: Math.max(0, Math.min(this.drawer.gridRows - 1, coord.y)),
    }
  }

  boxSelectItems(items: Item[], start: ACoord, end: ACoord): Item[] {
    const x1 = Math.min(start.x, end.x)
    const y1 = Math.min(start.y, end.y)
    const x2 = Math.max(start.x, end.x)
    const y2 = Math.max(start.y, end.y)
    return items.filter(i => {
      const dims = calculateItemGridDimensions(i, this.config)
      const cellX = Math.round(i.posX / this.config.cellSize)
      const cellY = Math.round(i.posY / this.config.cellSize)
      return cellX <= x2 && cellX + dims.gridWidth - 1 >= x1
          && cellY <= y2 && cellY + dims.gridDepth - 1 >= y1
    })
  }

  boxSelectRect(start: ACoord, end: ACoord): ItemRect {
    const x1 = Math.min(start.x, end.x)
    const y1 = Math.min(start.y, end.y)
    const x2 = Math.max(start.x, end.x)
    const y2 = Math.max(start.y, end.y)
    return {
      left:   gridPos(x1),
      top:    gridPos(y1),
      width:  gridSize(x2 - x1 + 1),
      height: gridSize(y2 - y1 + 1),
    }
  }

  isOccupied(coord: ACoord, occupancyMap: Map<string, string>): boolean {
    return occupancyMap.has(`${coord.x},${coord.y}`)
  }

  buildOccupancyMap(items: Item[], excludeIds?: Set<string>): Map<string, string> {
    const map = new Map<string, string>()
    for (const item of items) {
      if (excludeIds?.has(item.id)) {
        continue
      }
      const dims = calculateItemGridDimensions(item, this.config)
      const cellX = Math.round(item.posX / this.config.cellSize)
      const cellY = Math.round(item.posY / this.config.cellSize)
      for (let x = cellX; x < cellX + dims.gridWidth; x++) {
        for (let y = cellY; y < cellY + dims.gridDepth; y++) {
          map.set(`${x},${y}`, item.id)
        }
      }
    }
    return map
  }

  drawRangeToArgs(start: ACoord, end: ACoord) {
    const gx = Math.min(start.x, end.x)
    const gy = Math.min(start.y, end.y)
    return {
      posX: gx * this.config.cellSize,
      posY: gy * this.config.cellSize,
      cols: Math.abs(end.x - start.x) + 1,
      rows: Math.abs(end.y - start.y) + 1,
    }
  }

  containerStyle(): React.CSSProperties {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${this.drawer.gridCols}, ${CELL_SIZE}px)`,
      gridTemplateRows:    `repeat(${this.drawer.gridRows}, ${CELL_SIZE}px)`,
      gap: '1px',
      width: 'fit-content',
    }
  }

  renderBackground(occupancyMap: Map<string, string>, drawState: DrawState | null): React.ReactNode {
    return Array.from({ length: this.drawer.gridRows }).flatMap((_, y) =>
      Array.from({ length: this.drawer.gridCols }).map((_, x) => {
        const occupied = occupancyMap.has(`${x},${y}`)
        const inDrawPreview = drawState !== null && !occupied
          && x >= Math.min(drawState.startX, drawState.endX)
          && x <= Math.max(drawState.startX, drawState.endX)
          && y >= Math.min(drawState.startY, drawState.endY)
          && y <= Math.max(drawState.startY, drawState.endY)
        return React.createElement('div', {
          key: `${x}-${y}`,
          'data-gx': x,
          'data-gy': y,
          className: cn(
            'transition-colors duration-100',
            occupied
              ? 'bg-muted/20'
              : inDrawPreview
                ? 'bg-emerald-500/25'
                : 'bg-border/20 hover:bg-border/40',
          ),
          style: {
            width: CELL_SIZE,
            height: CELL_SIZE,
            cursor: occupied ? 'default' : drawState ? 'crosshair' : 'cell',
          },
        })
      })
    )
  }
}
