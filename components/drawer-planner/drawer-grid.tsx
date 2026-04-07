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
  getItemFootprintMm,
  getDistinctRotations,
  getRotationLabel,
  applyNextRotation,
  isItemFootprintOverflow,
  getItemColor,
} from '@/lib/gridfinity'
import { AlertTriangle, RotateCw, Move, Pencil, Trash2, ArrowRightLeft, FolderOpen, Package, Copy, Maximize2, Lock, Unlock } from 'lucide-react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
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
import type { Drawer, Item } from '@/lib/types'
import { formatDimension, FootprintMode } from '@/lib/types'
import { DeleteConfirmDialog } from '@/components/drawer-planner/delete-confirm-dialog'
import { ItemMenuActions } from '@/components/drawer-planner/item-menu-actions'
import { ItemCanvas } from '@/components/canvas/item-canvas'
import { GridAdapter } from '@/components/canvas/grid-adapter'
import { DrawerFreeAdapter } from '@/components/canvas/drawer-free-adapter'
import type { ItemRenderCtx } from '@/components/canvas/coord-adapter'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DrawerGridProps {
  drawer: Drawer
  onEditDrawer: (drawer: Drawer) => void
  onEditItem: (item: Item) => void
  onAddItemAtCell: (posX: number, posY: number, initialCols: number, initialRows: number) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DrawerGrid({ drawer, onEditDrawer, onEditItem, onAddItemAtCell }: DrawerGridProps) {
  const config          = useDrawerStore(s => s.config)
  const drawers         = useDrawerStore(s => s.drawers)
  const selectedItemIds = useDrawerStore(s => s.selectedItemIds)
  const allItems        = useDrawerStore(s => s.items)
  const categories      = useDrawerStore(s => s.categories)
  const items           = useMemo(() => allItems.filter(i => i.drawerId === drawer.id), [allItems, drawer.id])

  const moveItem         = useDrawerStore(s => s.moveItem)
  const repositionItems  = useDrawerStore(s => s.repositionItems)
  const deleteItem       = useDrawerStore(s => s.deleteItem)
  const deleteItems      = useDrawerStore(s => s.deleteItems)
  const setItemsLocked   = useDrawerStore(s => s.setItemsLocked)
  const duplicateItem    = useDrawerStore(s => s.duplicateItem)
  const deleteDrawer     = useDrawerStore(s => s.deleteDrawer)
  const duplicateDrawer  = useDrawerStore(s => s.duplicateDrawer)
  const updateItem       = useDrawerStore(s => s.updateItem)
  const selectItem       = useDrawerStore(s => s.selectItem)
  const selectItems      = useDrawerStore(s => s.selectItems)
  const toggleItemSelection = useDrawerStore(s => s.toggleItemSelection)
  const searchTerm       = useDrawerStore(s => s.searchQuery).toLowerCase().trim()

  const { toast } = useToast()
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'drawer' | 'item'
    id: string
    ids?: string[]
    name: string
  } | null>(null)

  const adapter = useMemo(
    () => drawer.gridless
      ? new DrawerFreeAdapter(drawer, config, items)
      : new GridAdapter(drawer, config),
    [drawer, config, items],
  )

  // ---------------------------------------------------------------------------
  // ItemCanvas callbacks
  // ---------------------------------------------------------------------------

  const handleDragCommit = useCallback((updates: { id: string; posX: number; posY: number }[]) => {
    if (updates.length > 1) {
      repositionItems(updates.map(u => ({ ...u, drawerId: drawer.id })))
    } else {
      moveItem(updates[0].id, drawer.id, updates[0].posX, updates[0].posY)
    }
  }, [drawer.id, moveItem, repositionItems])

  const handleResizeCommit = useCallback((id: string, partial: Partial<Item>) => {
    const item = items.find(i => i.id === id)
    if (item) {
      updateItem({ ...item, ...partial })
    }
  }, [items, updateItem])

  const handleSelectChange = useCallback((ids: string[]) => {
    if (ids.length > 0) {
      selectItems(ids)
    } else {
      selectItem(null)
    }
  }, [selectItems, selectItem])

  const handleItemClick = useCallback((id: string, ctrl: boolean) => {
    if (ctrl) {
      toggleItemSelection(id)
    } else {
      selectItem(id)
    }
  }, [selectItem, toggleItemSelection])

  const handleItemDoubleClick = useCallback((id: string) => {
    const item = items.find(i => i.id === id)
    if (item) {
      onEditItem(item)
    }
  }, [items, onEditItem])

  const handleContextMenu = useCallback((itemId: string | null) => {
    if (itemId) {
      const item = items.find(i => i.id === itemId)
      if (item && !selectedItemIds.has(item.id)) {
        selectItem(item.id)
      }
    }
  }, [items, selectedItemIds, selectItem])

  // ---------------------------------------------------------------------------
  // Helpers used inside renderItem
  // ---------------------------------------------------------------------------

  const getSuitableDrawers = useCallback((item: Item) => {
    const rotatedDims = getRotatedDimensions(item)
    return drawers.filter(d => d.height >= rotatedDims.height && d.id !== drawer.id)
  }, [drawers, drawer.id])

  const handleRotate = useCallback((item: Item) => {
    updateItem({ ...item, ...applyNextRotation(item) })
  }, [updateItem])

  const handleMoveToDrawer = useCallback((item: Item, targetDrawerId: string) => {
    moveItem(item.id, targetDrawerId, 0, 0)
  }, [moveItem])

  // ---------------------------------------------------------------------------
  // renderItem — item visual content (no position/size — handled by ItemCanvas)
  // ---------------------------------------------------------------------------

  const renderItem = useCallback((item: Item, ctx: ItemRenderCtx) => {
    const { isSelected, isSearchMatch, cardRect } = ctx
    const baseDims = calculateItemGridDimensions(item, config)
    const oversized = isItemOversized(item, drawer)
    const footprintOverflow = isItemFootprintOverflow(item, config)
    const { w: itemFpW, h: itemFpH } = drawer.gridless ? getItemFootprintMm(item) : { w: 0, h: 0 }
    const hasOverlap = drawer.gridless
      ? items.some(other => {
          if (other.id === item.id || other.drawerId !== item.drawerId) {
            return false
          }
          const { w: oW, h: oH } = getItemFootprintMm(other)
          return item.posX < other.posX + oW &&
                 item.posX + itemFpW > other.posX &&
                 item.posY < other.posY + oH &&
                 item.posY + itemFpH > other.posY
        })
      : findOverlappingItems(item, items, config).length > 0
    const suitableDrawers = oversized ? getSuitableDrawers(item) : []
    const rotatedDims = getRotatedDimensions(item)
    const isManual = item.footprintMode === FootprintMode.Manual
    const color = getItemColor(item, drawer, config, categories)

    const fp = drawer.gridless ? getItemFootprintMm(item) : null
    const allocatedW = fp ? fp.w : baseDims.gridWidth * config.cellSize
    const allocatedH = fp ? fp.h : baseDims.gridDepth * config.cellSize
    const insetPxW = rotatedDims.width > 0 && rotatedDims.depth > 0 && allocatedW > 0
      ? Math.min(rotatedDims.width / allocatedW, 1) * cardRect.width
      : null
    const insetPxH = rotatedDims.width > 0 && rotatedDims.depth > 0 && allocatedH > 0
      ? Math.min(rotatedDims.depth / allocatedH, 1) * cardRect.height
      : null

    return (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-0.5 border rounded-sm overflow-hidden",
          searchTerm && !isSearchMatch && "opacity-20",
          oversized && "border-destructive",
          hasOverlap && !oversized && "border-amber-500",
          !oversized && !hasOverlap && "border-black/10",
          hasOverlap && "opacity-60",
        )}
        style={{ backgroundColor: color }}
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
                backgroundColor: `color-mix(in oklch, black 28%, ${color})`,
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
          {drawer.gridless
            ? `${formatDimension(itemFpW, config.displayUnit)}×${formatDimension(itemFpH, config.displayUnit)}`
            : `${baseDims.gridWidth}×${baseDims.gridDepth}`}
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

        {/* Footprint overflow warning */}
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
                      <DropdownMenuItem key={d.id} onClick={() => handleMoveToDrawer(item, d.id)}>
                        <Move className="h-4 w-4" />{d.name}
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
        {item.locked && (
          <div className="absolute -bottom-1 -right-1 z-20 p-1 rounded-full bg-slate-600 text-white pointer-events-none">
            <Lock className="h-2.5 w-2.5" />
          </div>
        )}

        {/* Rotate button — visible when selected */}
        {isSelected && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); handleRotate(item) }}
                className="absolute -top-1 -right-1 z-20 p-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                <RotateCw className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Rotate ({getRotationLabel(item.rotation, item, config, drawer.gridless)})
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    )
  }, [config, drawer, categories, items, searchTerm, selectedItemIds, getSuitableDrawers, handleRotate, handleMoveToDrawer])

  // ---------------------------------------------------------------------------
  // renderContextMenu
  // ---------------------------------------------------------------------------

  const renderContextMenu = useCallback((itemId: string | null) => {
    const contextItem = itemId ? (items.find(i => i.id === itemId) ?? null) : null

    if (contextItem) {
      if (selectedItemIds.size > 1 && selectedItemIds.has(contextItem.id)) {
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
                <ContextMenuItem onClick={() => repositionItems([...selectedItemIds].map(id => ({ id, drawerId: null, posX: 0, posY: 0 })))}>
                  <Package className="h-4 w-4" />Unassigned
                </ContextMenuItem>
                <ContextMenuSeparator />
                {drawers.map(d => (
                  <ContextMenuItem key={d.id} onClick={() => repositionItems([...selectedItemIds].map(id => ({ id, drawerId: d.id, posX: 0, posY: 0 })))} disabled={d.id === drawer.id}>
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
      }
      return (
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
              if (!placed) {
                toast({ title: 'No space available', description: 'Item was placed at the same position as the original.' })
              }
            }}
            onToggleLock={() => updateItem({ ...contextItem, locked: !contextItem.locked })}
            onDelete={() => setPendingDelete({ type: 'item', id: contextItem.id, name: contextItem.name })}
            onMoveToDrawer={(drawerId) => moveItem(contextItem.id, drawerId, 0, 0)}
            onMoveToCategory={(categoryId) => updateItem({ ...contextItem, categoryId })}
            onRotateTo={(rotation) => updateItem({ ...contextItem, rotation })}
          />
        </ContextMenuContent>
      )
    }

    return (
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={() => onEditDrawer(drawer)}>
          <Pencil className="h-4 w-4" />Edit drawer
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateDrawer(drawer.id)}>
          <Copy className="h-4 w-4" />Duplicate drawer
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => setPendingDelete({ type: 'drawer', id: drawer.id, name: drawer.name })}>
          <Trash2 className="h-4 w-4" />Delete drawer
        </ContextMenuItem>
      </ContextMenuContent>
    )
  }, [items, selectedItemIds, drawers, drawer, categories, config, onEditItem, onEditDrawer,
      moveItem, repositionItems, updateItem, duplicateItem, duplicateDrawer, setItemsLocked, toast])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative h-full flex flex-col">
      <div
        className="flex-1 min-h-0 flex flex-col bg-secondary/30 rounded-lg p-2 overflow-auto"
        style={{ maxWidth: '100%' }}
      >
        <ItemCanvas
          adapter={adapter}
          items={items}
          selectedItemIds={selectedItemIds}
          searchTerm={searchTerm}
          canDraw
          canResize
          onDragCommit={handleDragCommit}
          onResizeCommit={handleResizeCommit}
          onSelectChange={handleSelectChange}
          onItemClick={handleItemClick}
          onItemDoubleClick={handleItemDoubleClick}
          onDrawComplete={onAddItemAtCell}
          onContextMenu={handleContextMenu}
          renderItem={renderItem}
          renderContextMenu={renderContextMenu}
        />
      </div>

      <DeleteConfirmDialog
        key={pendingDelete?.id ?? 'none'}
        open={pendingDelete !== null}
        type={pendingDelete?.type ?? 'item'}
        name={pendingDelete?.name ?? ''}
        onConfirm={(deleteContents) => {
          if (!pendingDelete) {
            return
          }
          if (pendingDelete.type === 'drawer') {
            deleteDrawer(pendingDelete.id, deleteContents)
          } else if (pendingDelete.ids) {
            deleteItems(pendingDelete.ids)
          } else {
            deleteItem(pendingDelete.id)
          }
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
