'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useDrawerPlanner } from './drawer-planner-provider'
import { cn } from '@/lib/utils'
import { 
  calculateItemGridDimensions, 
  isItemOversized, 
  isValidPlacement,
  findOverlappingItems,
  getRotatedDimensions,
} from '@/lib/gridfinity'
import { AlertTriangle, RotateCw, Move } from 'lucide-react'
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
import type { Drawer, Item, ItemRotation } from '@/lib/types'
import { formatDimension } from '@/lib/types'

interface DrawerGridProps {
  drawer: Drawer
  onEditItem: (item: Item) => void
  onAddItemAtCell: (gridX: number, gridY: number) => void
}

interface DragState {
  itemId: string
  startX: number
  startY: number
  currentX: number
  currentY: number
  offsetX: number
  offsetY: number
  gridWidth: number
  gridDepth: number
}

export function DrawerGrid({ drawer, onEditItem, onAddItemAtCell }: DrawerGridProps) {
  const { 
    state, 
    getItemsInDrawer, 
    moveItem, 
    updateItem,
    selectItem 
  } = useDrawerPlanner()

  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dropTarget, setDropTarget] = useState<{ x: number; y: number } | null>(null)
  const gridRef = React.useRef<HTMLDivElement>(null)

  const items = getItemsInDrawer(drawer.id)
  const cellSize = 40 // px for visualization

  // Create grid occupancy map
  const occupancyMap = useMemo(() => {
    const map = new Map<string, string>() // "x,y" -> itemId
    
    items.forEach(item => {
      if (dragState?.itemId === item.id) return // Skip dragging item
      
      const dims = calculateItemGridDimensions(item, state.config)
      for (let x = item.gridX; x < item.gridX + dims.gridWidth; x++) {
        for (let y = item.gridY; y < item.gridY + dims.gridDepth; y++) {
          map.set(`${x},${y}`, item.id)
        }
      }
    })
    
    return map
  }, [items, state.config, dragState])

  const handleGridDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear when leaving the grid container entirely
    if (!gridRef.current?.contains(e.relatedTarget as Node)) {
      setDropTarget(null)
    }
  }, [])

  const handleCellDragOver = useCallback((e: React.DragEvent, cellX: number, cellY: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget({ x: cellX, y: cellY })
  }, [])

  const handleCellDrop = useCallback((e: React.DragEvent, cellX: number, cellY: number) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData('text/plain')
    
    if (itemId) {
      const item = state.items.find(i => i.id === itemId)
      if (item) {
        const dims = calculateItemGridDimensions(item, state.config)
        // Adjust position to account for item size (center on cursor)
        const adjustedX = Math.max(0, Math.min(cellX, drawer.gridCols - dims.gridWidth))
        const adjustedY = Math.max(0, Math.min(cellY, drawer.gridRows - dims.gridDepth))
        moveItem(itemId, drawer.id, adjustedX, adjustedY)
      }
    }
    
    setDropTarget(null)
    setDragState(null)
  }, [state.items, state.config, drawer, moveItem])

  const handleItemDragStart = useCallback((e: React.DragEvent, item: Item) => {
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.effectAllowed = 'move'
    
    // Get cursor position relative to item
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const offsetX = Math.floor((e.clientX - rect.left) / cellSize)
    const offsetY = Math.floor((e.clientY - rect.top) / cellSize)
    const dims = calculateItemGridDimensions(item, state.config)
    
    setDragState({
      itemId: item.id,
      startX: item.gridX,
      startY: item.gridY,
      currentX: item.gridX,
      currentY: item.gridY,
      offsetX,
      offsetY,
      gridWidth: dims.gridWidth,
      gridDepth: dims.gridDepth,
    })
  }, [cellSize, state.config])

  const handleDragEnd = useCallback(() => {
    setDragState(null)
    setDropTarget(null)
  }, [])

  const handleRotate = useCallback((item: Item) => {
    const rotations: ItemRotation[] = ['normal', 'layDown', 'rotated']
    const currentIndex = rotations.indexOf(item.rotation)
    const nextRotation = rotations[(currentIndex + 1) % rotations.length]
    updateItem({ ...item, rotation: nextRotation })
  }, [updateItem])

  const handleMoveToDrawer = useCallback((item: Item, targetDrawerId: string) => {
    moveItem(item.id, targetDrawerId, 0, 0)
  }, [moveItem])

  // Get suitable drawers for an oversized item
  const getSuitableDrawers = useCallback((item: Item) => {
    return state.drawers.filter(d => {
      const rotatedDims = getRotatedDimensions(item)
      return d.height >= rotatedDims.height && d.id !== drawer.id
    })
  }, [state.drawers, drawer.id])

  return (
    <div className="relative">
      {/* Grid container */}
      <div 
        className="relative bg-secondary/30 rounded-lg p-2 overflow-auto"
        style={{ 
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 300px)',
        }}
      >
        <div
          ref={gridRef}
          className="relative"
          onDragLeave={handleGridDragLeave}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${drawer.gridCols}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${drawer.gridRows}, ${cellSize}px)`,
            gap: '1px',
            width: 'fit-content',
          }}
        >
          {/* Render grid cells */}
          {Array.from({ length: drawer.gridRows }).map((_, y) =>
            Array.from({ length: drawer.gridCols }).map((_, x) => {
              const isOccupied = occupancyMap.has(`${x},${y}`)
              
              // Check if this cell is part of the multi-cell drop preview
              const isInDropPreview = dropTarget && dragState && (
                x >= dropTarget.x && 
                x < dropTarget.x + dragState.gridWidth &&
                y >= dropTarget.y && 
                y < dropTarget.y + dragState.gridDepth
              )
              
              return (
                <div
                  key={`${x}-${y}`}
                  className={cn(
                    "border border-border/30 rounded-sm transition-colors",
                    isOccupied ? "bg-muted/20" : "bg-background/50",
                    isInDropPreview && "bg-primary/20 border-primary/50",
                    !isOccupied && !isInDropPreview && "hover:bg-accent/30"
                  )}
                  onDragOver={(e) => handleCellDragOver(e, x, y)}
                  onDrop={(e) => handleCellDrop(e, x, y)}
                  onDoubleClick={() => {
                    if (!isOccupied) {
                      onAddItemAtCell(x, y)
                    }
                  }}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    cursor: isOccupied ? 'default' : 'pointer',
                  }}
                />
              )
            })
          )}

          {/* Render items */}
          {items.map(item => {
            const dims = calculateItemGridDimensions(item, state.config)
            const oversized = isItemOversized(item, drawer)
            const isSelected = state.selectedItemId === item.id
            const isDragging = dragState?.itemId === item.id
            const overlapping = findOverlappingItems(item, items, state.config)
            const hasOverlap = overlapping.length > 0
            const suitableDrawers = oversized ? getSuitableDrawers(item) : []

            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleItemDragStart(e, item)}
                onDragEnd={handleDragEnd}
                onClick={() => selectItem(item.id)}
                onDoubleClick={() => onEditItem(item)}
                className={cn(
                  "absolute rounded-md cursor-move transition-all",
                  "flex flex-col items-center justify-center gap-0.5",
                  "border-2 shadow-sm",
                  isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  oversized && "border-destructive",
                  hasOverlap && !oversized && "border-amber-500",
                  !oversized && !hasOverlap && "border-transparent",
                  isDragging && "opacity-50 scale-95"
                )}
                style={{
                  left: item.gridX * (cellSize + 1) + 1,
                  top: item.gridY * (cellSize + 1) + 1,
                  width: dims.gridWidth * cellSize + (dims.gridWidth - 1),
                  height: dims.gridDepth * cellSize + (dims.gridDepth - 1),
                  backgroundColor: item.color,
                  zIndex: isSelected ? 10 : 1,
                  pointerEvents: dragState && dragState.itemId !== item.id ? 'none' : undefined,
                }}
              >
                {/* Item content */}
                <span className="text-xs font-medium text-white drop-shadow-md truncate px-1 max-w-full">
                  {item.name}
                </span>
                <span className="text-[10px] text-white/80 drop-shadow-md">
                  {dims.gridWidth}x{dims.gridDepth}
                </span>

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
                          Item is too tall for this drawer ({formatDimension(getRotatedDimensions(item).height, state.config.displayUnit)} {">"} {formatDimension(drawer.height, state.config.displayUnit)})
                        </div>
                        {suitableDrawers.length > 0 ? (
                          <>
                            <div className="px-2 py-1 text-xs font-medium">Move to:</div>
                            {suitableDrawers.map(d => (
                              <DropdownMenuItem
                                key={d.id}
                                onClick={() => handleMoveToDrawer(item, d.id)}
                              >
                                <Move className="h-4 w-4 mr-2" />
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

                {/* Rotate button - show on hover for selected items */}
                {isSelected && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRotate(item)
                        }}
                        className="absolute -bottom-1 -right-1 z-20 p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                      >
                        <RotateCw className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      Rotate ({item.rotation})
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Grid legend */}
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          Grid: {drawer.gridCols} x {drawer.gridRows} cells ({drawer.gridCols * drawer.gridRows} total)
        </span>
        <span>
          Cell: {formatDimension(state.config.cellSize, state.config.displayUnit)}
        </span>
      </div>
    </div>
  )
}
