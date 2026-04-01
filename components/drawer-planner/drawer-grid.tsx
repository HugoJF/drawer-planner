'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useDrawerStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  calculateItemGridDimensions,
  isItemOversized,
  findOverlappingItems,
  getRotatedDimensions,
  getDistinctRotations,
  getRotationLabel,
  applyNextRotation,
  isItemFootprintOverflow,
} from '@/lib/gridfinity'
import { AlertTriangle, RotateCw, Move, Pencil, Trash2, ArrowRightLeft, FolderOpen, Package, Copy, Maximize2, Lock, Unlock, Tag } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Drawer, Item, GridfinityConfig, Category } from '@/lib/types'
import { formatDimension, getCategoryColor } from '@/lib/types'

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function heightToColor(ratio: number): string {
  const blue = { r: 0, g: 120, b: 255 }
  const red  = { r: 255, g: 60,  b: 60 }

  const r = Math.round(lerp(blue.r, red.r, ratio))
  const g = Math.round(lerp(blue.g, red.g, ratio))
  const b = Math.round(lerp(blue.b, red.b, ratio))

  return `rgb(${r}, ${g}, ${b})`
}

function getItemColor(item: Item, drawer: Drawer, config: GridfinityConfig, categories: Category[]): string {
  if ((config.gridColorMode ?? 'category') === 'height') {
    const { heightUnits } = calculateItemGridDimensions(item, config)
    const maxUnits = Math.ceil(drawer.height / config.heightUnit)
    const ratio = maxUnits > 0 ? Math.min(1, heightUnits / maxUnits) : 0
    return heightToColor(ratio)
  }
  return getCategoryColor(item.categoryId, categories)
}
import { DeleteConfirmDialog } from '@/components/drawer-planner/delete-confirm-dialog'
import { ItemMenuActions } from '@/components/drawer-planner/item-menu-actions'

interface DrawerGridProps {
  drawer: Drawer
  onEditDrawer: (drawer: Drawer) => void
  onEditItem: (item: Item) => void
  onAddItemAtCell: (gridX: number, gridY: number, initialCols: number, initialRows: number) => void
}

interface DrawState {
  startX: number
  startY: number
  endX: number
  endY: number
}

interface ResizeState {
  itemId: string
  handle: 'e' | 's' | 'se'
  startMouseX: number
  startMouseY: number
  startGridWidth: number
  startGridDepth: number
  previewWidth: number
  previewDepth: number
}

interface DragState {
  itemId: string
  grabPxX: number  // pixel offset within the item where the drag started
  grabPxY: number
  gridWidth: number
  gridDepth: number
  itemOffsets: { id: string; dx: number; dy: number }[]
  dragCells: Set<string>  // all occupied cells relative to anchor, as "dx,dy"
  minDx: number  // leftmost offset (for clamping)
  minDy: number
  maxRight: number  // rightmost extent from anchor (for clamping)
  maxBottom: number
}

const CELL_SIZE = 40 // px per grid cell for visualization

export function DrawerGrid({ drawer, onEditDrawer, onEditItem, onAddItemAtCell }: DrawerGridProps) {
  const config = useDrawerStore(s => s.config)
  const drawers = useDrawerStore(s => s.drawers)
  const selectedItemIds = useDrawerStore(s => s.selectedItemIds)
  const allItems = useDrawerStore(s => s.items)
  const categories = useDrawerStore(s => s.categories)
  const items = useMemo(() => allItems.filter(i => i.drawerId === drawer.id), [allItems, drawer.id])
  const moveItem = useDrawerStore(s => s.moveItem)
  const repositionItems = useDrawerStore(s => s.repositionItems)
  const deleteItem = useDrawerStore(s => s.deleteItem)
  const deleteItems = useDrawerStore(s => s.deleteItems)
  const setItemsLocked = useDrawerStore(s => s.setItemsLocked)
  const duplicateItem = useDrawerStore(s => s.duplicateItem)
  const deleteDrawer = useDrawerStore(s => s.deleteDrawer)
  const duplicateDrawer = useDrawerStore(s => s.duplicateDrawer)
  const updateItem = useDrawerStore(s => s.updateItem)
  const selectItem = useDrawerStore(s => s.selectItem)
  const toggleItemSelection = useDrawerStore(s => s.toggleItemSelection)
  const searchTerm = useDrawerStore(s => s.searchQuery).toLowerCase().trim()

  const { toast } = useToast()
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<{ x: number; y: number } | null>(null)
  const [drawState, setDrawState] = useState<DrawState | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [contextItem, setContextItem] = useState<Item | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ type: 'drawer' | 'item'; id: string; ids?: string[]; name: string } | null>(null)
  const gridRef = React.useRef<HTMLDivElement>(null)

  // Create grid occupancy map
  const occupancyMap = useMemo(() => {
    const map = new Map<string, string>() // "x,y" -> itemId
    const draggingIds = new Set(dragState?.itemOffsets.map(o => o.id) ?? [])
    items.forEach(item => {
      if (draggingIds.has(item.id)) return // skip all co-dragged items
      const dims = calculateItemGridDimensions(item, config)
      for (let x = item.gridX; x < item.gridX + dims.gridWidth; x++) {
        for (let y = item.gridY; y < item.gridY + dims.gridDepth; y++) {
          map.set(`${x},${y}`, item.id)
        }
      }
    })
    return map
  }, [items, config, dragState])

  const cellStep = CELL_SIZE + 1 // cell width + 1px gap

  const computeDropPosition = useCallback((clientX: number, clientY: number) => {
    if (!dragState || !gridRef.current) return null
    const gridRect = gridRef.current.getBoundingClientRect()
    const cellX = Math.round((clientX - gridRect.left - dragState.grabPxX) / cellStep)
    const cellY = Math.round((clientY - gridRect.top  - dragState.grabPxY) / cellStep)
    return {
      x: Math.max(-dragState.minDx, Math.min(cellX, drawer.gridCols - dragState.maxRight)),
      y: Math.max(-dragState.minDy, Math.min(cellY, drawer.gridRows - dragState.maxBottom)),
    }
  }, [dragState, drawer.gridCols, drawer.gridRows, cellStep])

  const handleGridDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const pos = computeDropPosition(e.clientX, e.clientY)
    if (pos) setDropTarget(pos)
  }, [computeDropPosition])

  const handleGridDragLeave = useCallback((e: React.DragEvent) => {
    if (!gridRef.current?.contains(e.relatedTarget as Node)) {
      setDropTarget(null)
    }
  }, [])

  const handleGridDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const pos = computeDropPosition(e.clientX, e.clientY)
    if (pos && dragState) {
      if (dragState.itemOffsets.length > 1) {
        repositionItems(dragState.itemOffsets.map(({ id, dx, dy }) => ({
          id,
          drawerId: drawer.id,
          gridX: pos.x + dx,
          gridY: pos.y + dy,
        })))
      } else {
        moveItem(dragState.itemId, drawer.id, pos.x, pos.y)
      }
    }
    setDropTarget(null)
    setDragState(null)
  }, [computeDropPosition, drawer.id, moveItem, repositionItems, dragState])

  const handleItemDragStart = useCallback((e: React.DragEvent, item: Item) => {
    if (item.locked) { e.preventDefault(); return }
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.effectAllowed = 'move'
    // Suppress browser native ghost — we render our own overlays
    const transparent = new Image()
    transparent.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(transparent, 0, 0)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dims = calculateItemGridDimensions(item, config)

    // Gather co-dragged items: all selected, unlocked items in this drawer (including anchor)
    const coDragged = selectedItemIds.has(item.id)
      ? items.filter(i => selectedItemIds.has(i.id) && !i.locked)
      : [item]

    const itemOffsets = coDragged.map(i => ({ id: i.id, dx: i.gridX - item.gridX, dy: i.gridY - item.gridY }))

    // Pre-compute all drag cells relative to anchor and clamping bounds
    const dragCells = new Set<string>()
    let minDx = 0, minDy = 0, maxRight = dims.gridWidth, maxBottom = dims.gridDepth
    for (const di of coDragged) {
      const diDims = calculateItemGridDimensions(di, config)
      const odx = di.gridX - item.gridX
      const ody = di.gridY - item.gridY
      for (let cx = odx; cx < odx + diDims.gridWidth; cx++) {
        for (let cy = ody; cy < ody + diDims.gridDepth; cy++) {
          dragCells.add(`${cx},${cy}`)
        }
      }
      minDx = Math.min(minDx, odx)
      minDy = Math.min(minDy, ody)
      maxRight = Math.max(maxRight, odx + diDims.gridWidth)
      maxBottom = Math.max(maxBottom, ody + diDims.gridDepth)
    }

    setDropTarget({ x: item.gridX, y: item.gridY })
    setDragState({
      itemId: item.id,
      grabPxX: e.clientX - rect.left,
      grabPxY: e.clientY - rect.top,
      gridWidth: dims.gridWidth,
      gridDepth: dims.gridDepth,
      itemOffsets,
      dragCells,
      minDx,
      minDy,
      maxRight,
      maxBottom,
    })
  }, [config, items, selectedItemIds])

  const handleDragEnd = useCallback(() => {
    setDragState(null)
    setDropTarget(null)
  }, [])

  const handleRotate = useCallback((item: Item) => {
    updateItem({ ...item, ...applyNextRotation(item) })
  }, [updateItem])

  const handleMoveToDrawer = useCallback((item: Item, targetDrawerId: string) => {
    moveItem(item.id, targetDrawerId, 0, 0)
  }, [moveItem])

  // Get suitable drawers for an oversized item
  const getSuitableDrawers = useCallback((item: Item) => {
    return drawers.filter(d => {
      const rotatedDims = getRotatedDimensions(item)
      return d.height >= rotatedDims.height && d.id !== drawer.id
    })
  }, [drawers, drawer.id])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    let el = e.target as HTMLElement | null
    while (el && el !== e.currentTarget) {
      if (el.dataset.itemId) {
        const found = items.find(i => i.id === el!.dataset.itemId) ?? null
        setContextItem(found)
        if (found && !selectedItemIds.has(found.id)) selectItem(found.id)
        return
      }
      el = el.parentElement
    }
    setContextItem(null)
  }, [items, selectedItemIds, selectItem])

  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (!resizeState) return
    const dx = Math.round((e.clientX - resizeState.startMouseX) / cellStep)
    const dy = Math.round((e.clientY - resizeState.startMouseY) / cellStep)
    const newW = Math.max(1, resizeState.startGridWidth + (resizeState.handle !== 's' ? dx : 0))
    const newD = Math.max(1, resizeState.startGridDepth + (resizeState.handle !== 'e' ? dy : 0))
    setResizeState(s => s ? { ...s, previewWidth: newW, previewDepth: newD } : null)
  }, [resizeState, cellStep])

  const handleGridMouseUp = useCallback(() => {
    if (resizeState) {
      const item = items.find(i => i.id === resizeState.itemId)
      if (item) {
        updateItem({
          ...item,
          gridMode: 'manual',
          manualGridCols: resizeState.previewWidth,
          manualGridRows: resizeState.previewDepth,
        })
      }
      setResizeState(null)
      return
    }
    if (!drawState) return
    const gx = Math.min(drawState.startX, drawState.endX)
    const gy = Math.min(drawState.startY, drawState.endY)
    const cols = Math.abs(drawState.endX - drawState.startX) + 1
    const rows = Math.abs(drawState.endY - drawState.startY) + 1
    setDrawState(null)
    onAddItemAtCell(gx, gy, cols, rows)
  }, [resizeState, drawState, items, updateItem, onAddItemAtCell])

  const handleGridMouseLeave = useCallback(() => {
    setDrawState(null)
    setResizeState(null)
  }, [])

  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest('[data-gx]') as HTMLElement | null
    if (!target || dragState || resizeState) return
    const gx = parseInt(target.dataset.gx!)
    const gy = parseInt(target.dataset.gy!)
    if (occupancyMap.has(`${gx},${gy}`)) return
    e.preventDefault()
    setDrawState({ startX: gx, startY: gy, endX: gx, endY: gy })
  }, [dragState, resizeState, occupancyMap])

  const handleGridMouseOver = useCallback((e: React.MouseEvent) => {
    if (!drawState) return
    const target = (e.target as HTMLElement).closest('[data-gx]') as HTMLElement | null
    if (!target) return
    const gx = parseInt(target.dataset.gx!)
    const gy = parseInt(target.dataset.gy!)
    setDrawState(s => s ? { ...s, endX: gx, endY: gy } : null)
  }, [drawState])

  const handleResizeStart = useCallback((e: React.MouseEvent, item: Item, handle: ResizeState['handle']) => {
    e.stopPropagation()
    e.preventDefault()
    const dims = calculateItemGridDimensions(item, config)
    setResizeState({
      itemId: item.id,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startGridWidth: dims.gridWidth,
      startGridDepth: dims.gridDepth,
      previewWidth: dims.gridWidth,
      previewDepth: dims.gridDepth,
    })
  }, [config])

  return (
    <div className="relative h-full flex flex-col">
      {/* Grid container */}
      <ContextMenu>
        <ContextMenuTrigger
          className="flex-1 min-h-0 flex flex-col"
          onContextMenu={handleContextMenu}
        >
          <div
            className="flex-1 relative bg-secondary/30 rounded-lg p-2 overflow-auto"
            style={{ maxWidth: '100%' }}
          >
        <div
          ref={gridRef}
          className="relative"
          onDragOver={handleGridDragOver}
          onDrop={handleGridDrop}
          onDragLeave={handleGridDragLeave}
          onMouseMove={handleGridMouseMove}
          onMouseUp={handleGridMouseUp}
          onMouseLeave={handleGridMouseLeave}
          onMouseDown={handleGridMouseDown}
          onMouseOver={handleGridMouseOver}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${drawer.gridCols}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${drawer.gridRows}, ${CELL_SIZE}px)`,
            gap: '1px',
            width: 'fit-content',
          }}
        >
          {/* Render grid cells */}
          {Array.from({ length: drawer.gridRows }).map((_, y) =>
            Array.from({ length: drawer.gridCols }).map((_, x) => {
              const isOccupied = occupancyMap.has(`${x},${y}`)

              const isInDrawPreview = drawState && !isOccupied && (
                x >= Math.min(drawState.startX, drawState.endX) &&
                x <= Math.max(drawState.startX, drawState.endX) &&
                y >= Math.min(drawState.startY, drawState.endY) &&
                y <= Math.max(drawState.startY, drawState.endY)
              )

              return (
                <div
                  key={`${x}-${y}`}
                  data-gx={x}
                  data-gy={y}
                  className={cn(
                    "transition-colors duration-100",
                    isOccupied
                      ? "bg-muted/20"
                      : isInDrawPreview
                        ? "bg-emerald-500/25"
                        : "bg-border/20 hover:bg-border/40",
                  )}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    cursor: isOccupied ? 'default' : drawState ? 'crosshair' : 'cell',
                  }}
                />
              )
            })
          )}

          {/* Drag ghost overlays — all co-dragged items follow the drop target */}
          {dragState && dropTarget && dragState.itemOffsets.map(({ id, dx, dy }) => {
            const di = items.find(i => i.id === id)
            if (!di) return null
            const diDims = calculateItemGridDimensions(di, config)
            const w = diDims.gridWidth * CELL_SIZE + (diDims.gridWidth - 1)
            const h = diDims.gridDepth * CELL_SIZE + (diDims.gridDepth - 1)
            return (
              <div
                key={`ghost-${id}`}
                className="absolute rounded-sm pointer-events-none z-20"
                style={{
                  left: (dropTarget.x + dx) * (CELL_SIZE + 1) + 1,
                  top: (dropTarget.y + dy) * (CELL_SIZE + 1) + 1,
                  width: w,
                  height: h,
                  backgroundColor: getItemColor(di, drawer, config, categories),
                  opacity: 0.7,
                  outline: '2px solid rgba(255,255,255,0.4)',
                }}
              />
            )
          })}

          {/* Resize ghost overlay */}
          {resizeState && (() => {
            const item = items.find(i => i.id === resizeState.itemId)
            if (!item) return null
            const w = resizeState.previewWidth * CELL_SIZE + (resizeState.previewWidth - 1)
            const h = resizeState.previewDepth * CELL_SIZE + (resizeState.previewDepth - 1)
            return (
              <div
                className="absolute rounded-sm pointer-events-none z-30"
                style={{
                  left: item.gridX * (CELL_SIZE + 1) + 1,
                  top: item.gridY * (CELL_SIZE + 1) + 1,
                  width: w,
                  height: h,
                  border: '2px dashed var(--primary)',
                  background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
                }}
              >
                <span
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-primary text-primary-foreground whitespace-nowrap"
                >
                  {resizeState.previewWidth} × {resizeState.previewDepth}
                </span>
              </div>
            )
          })()}

          {items.map(item => {
            const isResizing = resizeState?.itemId === item.id
            const baseDims = calculateItemGridDimensions(item, config)
            // Item stays frozen at original size during resize; the ghost overlay shows the preview
            const visW = baseDims.gridWidth
            const visD = baseDims.gridDepth
            const oversized = isItemOversized(item, drawer)
            const footprintOverflow = isItemFootprintOverflow(item, config)
            const isSelected = selectedItemIds.has(item.id)
            const isDragging = dragState?.itemOffsets.some(o => o.id === item.id) ?? false
            const isSearchMatch = searchTerm !== '' && item.name.toLowerCase().includes(searchTerm)
            const isLocked = item.locked
            const overlapping = findOverlappingItems(item, items, config)
            const hasOverlap = overlapping.length > 0
            const suitableDrawers = oversized ? getSuitableDrawers(item) : []

            // Inset box: physical item dimensions as a fraction of the grid footprint
            const rotatedDims = getRotatedDimensions(item)
            const physW = rotatedDims.width
            const physD = rotatedDims.depth
            const hasRealDims = physW > 0 && physD > 0
            const isManual = item.gridMode === 'manual'
            const itemCardW = visW * CELL_SIZE + (visW - 1)
            const itemCardH = visD * CELL_SIZE + (visD - 1)
            const insetPxW = hasRealDims
              ? Math.min(physW / (visW * config.cellSize), 1) * itemCardW
              : null
            const insetPxH = hasRealDims
              ? Math.min(physD / (visD * config.cellSize), 1) * itemCardH
              : null

            return (
              <div
                key={item.id}
                draggable={!resizeState && !isLocked}
                onDragStart={(e) => handleItemDragStart(e, item)}
                onDragEnd={handleDragEnd}
                onClick={(e) => e.ctrlKey || e.metaKey || isSelected ? toggleItemSelection(item.id) : selectItem(item.id)}
                onDoubleClick={() => onEditItem(item)}
                data-item-id={item.id}
                className={cn(
                  "absolute rounded-sm transition-all",
                  isLocked ? "cursor-default" : "cursor-move",
                  "flex flex-col items-center justify-center gap-0.5",
                  "border",
                  isSelected && !isResizing && "ring-1 ring-primary ring-offset-1 ring-offset-background",
                  searchTerm && !isSearchMatch && "opacity-20",
                  oversized && "border-destructive",
                  hasOverlap && !oversized && "border-amber-500",
                  !oversized && !hasOverlap && "border-black/10",
                  hasOverlap && "opacity-60",
                  isDragging && "opacity-0",
                  !isSelected && !isDragging && selectedItemIds.size > 0 && "opacity-50",
                  isResizing && "opacity-40"
                )}
                style={{
                  left: item.gridX * (CELL_SIZE + 1) + 1,
                  top: item.gridY * (CELL_SIZE + 1) + 1,
                  width: visW * CELL_SIZE + (visW - 1),
                  height: visD * CELL_SIZE + (visD - 1),
                  backgroundColor: getItemColor(item, drawer, config, categories),
                  zIndex: isSelected ? 10 : 1,
                  pointerEvents: drawState || (dragState && dragState.itemId !== item.id) || (resizeState && resizeState.itemId !== item.id) ? 'none' : undefined,
                  transition: isResizing ? 'none' : 'opacity 0.1s',
                }}
              >
                {/* Inset: physical item footprint within allocated grid cells */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-[2px]">
                  {insetPxW !== null && insetPxH !== null ? (
                    <div
                      style={{
                        width: insetPxW,
                        height: insetPxH,
                        minWidth: 3,
                        minHeight: 3,
                        backgroundColor: `color-mix(in oklch, black 28%, ${getItemColor(item, drawer, config, categories)})`,
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.12) 3px, rgba(0,0,0,0.12) 6px)',
                        borderRadius: 2,
                      }}
                    />
                  ) : isManual ? (
                    <span className="text-white/40 text-base font-bold select-none">?</span>
                  ) : null}
                </div>

                {/* Item content */}
                <span className="relative z-10 text-xs font-medium text-white drop-shadow-md truncate px-1 max-w-full">
                  {item.name}
                </span>
                <span className="relative z-10 text-[10px] text-white/80 drop-shadow-md">
                  {visW}×{visD}
                </span>

                {/* Overlap warning */}
                {hasOverlap && !oversized && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute -top-1 -left-1 z-20 p-1 rounded-full bg-amber-500 text-white">
                        <AlertTriangle className="h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">Overlapping with another item</TooltipContent>
                  </Tooltip>
                )}

                {/* Footprint overflow warning (physical item larger than manual grid allocation) */}
                {footprintOverflow && !oversized && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute -bottom-1 -left-1 z-20 p-1 rounded-full bg-orange-500 text-white">
                        <Maximize2 className="h-3 w-3" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Item is physically larger than its grid footprint</TooltipContent>
                  </Tooltip>
                )}

                {/* Oversized warning */}
                {oversized && (
                  <div className="absolute -top-1 -right-1 z-20">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">
                          <AlertTriangle className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Item is too tall for this drawer ({formatDimension(getRotatedDimensions(item).height, config.displayUnit)} {">"} {formatDimension(drawer.height, config.displayUnit)})
                        </div>
                        {suitableDrawers.length > 0 ? (
                          <>
                            <div className="px-2 py-1 text-xs font-medium">Move to:</div>
                            {suitableDrawers.map(d => (
                              <DropdownMenuItem
                                key={d.id}
                                onClick={() => handleMoveToDrawer(item, d.id)}
                              >
                                <Move className="h-4 w-4 " />
                                {d.name}
                              </DropdownMenuItem>
                            ))}
                          </>
                        ) : (
                          <div className="px-2 py-1.5 text-xs text-destructive">
                            No suitable drawers available. Try rotating.
                          </div>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}

                {/* Lock badge */}
                {isLocked && (
                  <div className="absolute -bottom-1 -right-1 z-20 p-1 rounded-full bg-slate-600 text-white pointer-events-none">
                    <Lock className="h-2.5 w-2.5" />
                  </div>
                )}

                {/* Rotate button - visible when selected */}
                {isSelected && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRotate(item)
                        }}
                        className="absolute -top-1 -right-1 z-20 p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                      >
                        <RotateCw className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Rotate ({getRotationLabel(item.rotation, item, config)})
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* Resize handles - visible when selected and not locked */}
                {isSelected && !isLocked && (
                  <>
                    {/* East handle */}
                    <div
                      className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-2 h-6 rounded-sm bg-primary/70 hover:bg-primary cursor-e-resize z-20"
                      onMouseDown={(e) => handleResizeStart(e, item, 'e')}
                    />
                    {/* South handle */}
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-2 w-6 rounded-sm bg-primary/70 hover:bg-primary cursor-s-resize z-20"
                      onMouseDown={(e) => handleResizeStart(e, item, 's')}
                    />
                    {/* Southeast handle */}
                    <div
                      className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3 h-3 rounded-sm bg-primary/70 hover:bg-primary cursor-se-resize z-20"
                      onMouseDown={(e) => handleResizeStart(e, item, 'se')}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
          </div>
        </ContextMenuTrigger>
        {contextItem ? (
          selectedItemIds.size > 1 && selectedItemIds.has(contextItem.id) ? (() => {
            const selectedItems = items.filter(i => selectedItemIds.has(i.id))
            const allLocked = selectedItems.every(i => i.locked)
            return (
            <ContextMenuContent className="w-48">
              <ContextMenuItem disabled className="text-muted-foreground text-xs">
                {selectedItemIds.size} items selected
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setItemsLocked([...selectedItemIds], !allLocked)}>
                {allLocked ? <><Unlock className="h-4 w-4" />Unlock all</> : <><Lock className="h-4 w-4" />Lock all</>}
              </ContextMenuItem>
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <ArrowRightLeft className="h-4 w-4" />Move to
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-60 overflow-auto">
                  <ContextMenuItem onClick={() => repositionItems([...selectedItemIds].map(id => ({ id, drawerId: null, gridX: 0, gridY: 0 })))}>
                    <Package className="h-4 w-4" />Unassigned
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  {drawers.map(d => (
                    <ContextMenuItem key={d.id} onClick={() => repositionItems([...selectedItemIds].map(id => ({ id, drawerId: d.id, gridX: 0, gridY: 0 })))} disabled={d.id === drawer.id}>
                      <FolderOpen className="h-4 w-4" />{d.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onClick={() => setPendingDelete({ type: 'item', id: '__multi__', ids: [...selectedItemIds], name: `${selectedItemIds.size} items` })}>
                <Trash2 className="h-4 w-4" />Delete {selectedItemIds.size} items
              </ContextMenuItem>
            </ContextMenuContent>
            )
          })() : (
          <ContextMenuContent className="w-48">
            <ItemMenuActions
              variant="context"
              item={contextItem}
              allDrawers={drawers}
              categories={categories}
              config={config}
              onEdit={() => onEditItem(contextItem)}
              onDuplicate={() => {
                const placed = duplicateItem(contextItem.id)
                if (!placed) toast({ title: 'No space available', description: 'Item was placed at the same position as the original.' })
              }}
              onToggleLock={() => updateItem({ ...contextItem, locked: !contextItem.locked })}
              onDelete={() => setPendingDelete({ type: 'item', id: contextItem.id, name: contextItem.name })}
              onMoveToDrawer={(drawerId) => moveItem(contextItem.id, drawerId, 0, 0)}
              onMoveToCategory={(categoryId) => updateItem({ ...contextItem, categoryId })}
              onRotateTo={(rotation) => updateItem({ ...contextItem, rotation })}
            />
          </ContextMenuContent>
          )
        ) : (
          <ContextMenuContent className="w-44">
            <ContextMenuItem onClick={() => onEditDrawer(drawer)}>
              <Pencil className="h-4 w-4 " />Edit drawer
            </ContextMenuItem>
            <ContextMenuItem onClick={() => duplicateDrawer(drawer.id)}>
              <Copy className="h-4 w-4 " />Duplicate drawer
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => setPendingDelete({ type: 'drawer', id: drawer.id, name: drawer.name })}>
              <Trash2 className="h-4 w-4 " />Delete drawer
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>

      <DeleteConfirmDialog
        key={pendingDelete?.id ?? 'none'}
        open={pendingDelete !== null}
        type={pendingDelete?.type ?? 'item'}
        name={pendingDelete?.name ?? ''}
        onConfirm={(deleteContents) => {
          if (!pendingDelete) return
          if (pendingDelete.type === 'drawer') deleteDrawer(pendingDelete.id, deleteContents)
          else if (pendingDelete.ids) deleteItems(pendingDelete.ids)
          else deleteItem(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />

    </div>
  )
}
