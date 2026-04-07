'use client'

import React, { useMemo, useCallback } from 'react'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import { Pencil, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FootprintMode } from '@/lib/types'
import type { CabinetItem } from '@/lib/types'
import type { Item } from '@/lib/types'
import type { ItemRenderCtx } from '@/components/canvas/coord-adapter'
import { FreeAdapter } from '@/components/canvas/free-adapter'
import { ItemCanvas } from '@/components/canvas/item-canvas'

const DEFAULT_SCALE = 0.5
const DEFAULT_SNAP_THRESHOLD = 8

export interface CabinetViewProps {
  items: CabinetItem[]
  selectedIds: Set<string>
  scale?: number            // px/mm, default 0.5
  snapThresholdPx?: number  // default 8
  onMove: (updates: { id: string; x: number; y: number }[]) => void
  onSelectIds: (ids: string[]) => void
  onToggleId: (id: string) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

/** Map a CabinetItem to a fake Item so ItemCanvas + FreeAdapter can work with it. */
function toCanvasItem(ci: CabinetItem): Item {
  return {
    id:           ci.id,
    name:         ci.label,
    width:        ci.widthMm,
    height:       ci.heightMm,
    depth:        0,
    posX:         ci.x,
    posY:         ci.y,
    footprintMode: FootprintMode.Manual,
    footprintW:   ci.widthMm,
    footprintH:   ci.heightMm,
    locked:       false,
    rotation:     'h-up',
    categoryId:   null,
    drawerId:     null,
  }
}

export function CabinetView({
  items,
  selectedIds,
  scale = DEFAULT_SCALE,
  snapThresholdPx = DEFAULT_SNAP_THRESHOLD,
  onMove,
  onSelectIds,
  onToggleId,
  onEdit,
  onDuplicate,
  onDelete,
}: CabinetViewProps) {
  // Map CabinetItem[] → fake Item[] for ItemCanvas
  const canvasItems = useMemo(() => items.map(toCanvasItem), [items])

  const adapter = useMemo(
    () => new FreeAdapter(scale, snapThresholdPx, canvasItems),
    [scale, snapThresholdPx, canvasItems],
  )

  // ---------------------------------------------------------------------------
  // ItemCanvas callbacks
  // ---------------------------------------------------------------------------

  const handleDragCommit = useCallback(
    (updates: { id: string; posX: number; posY: number }[]) => {
      onMove(updates.map(u => ({ id: u.id, x: u.posX, y: u.posY })))
    },
    [onMove],
  )

  const handleItemClick = useCallback(
    (id: string, ctrl: boolean) => {
      if (ctrl) {
        onToggleId(id)
      } else {
        onSelectIds([id])
      }
    },
    [onSelectIds, onToggleId],
  )

  const handleSelectChange = useCallback(
    (ids: string[]) => onSelectIds(ids),
    [onSelectIds],
  )

  const handleContextMenu = useCallback(
    (itemId: string | null) => {
      if (itemId && !selectedIds.has(itemId)) {
        onSelectIds([itemId])
      }
    },
    [selectedIds, onSelectIds],
  )

  // ---------------------------------------------------------------------------
  // renderItem — drawer rectangle content
  // ---------------------------------------------------------------------------

  const renderItem = useCallback(
    (item: Item, ctx: ItemRenderCtx) => {
      const ci = items.find(i => i.id === item.id)!
      return (
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center overflow-hidden',
            'bg-card text-card-foreground border rounded-sm transition-shadow',
            ctx.isSelected
              ? 'border-primary'
              : 'border-border hover:border-primary/50',
          )}
        >
          <div className="flex flex-col items-center gap-0.5 px-1 text-center pointer-events-none">
            <span className="text-xs font-medium leading-tight truncate max-w-full">{ci.label}</span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              {ci.widthMm}×{ci.heightMm}mm
            </span>
          </div>
        </div>
      )
    },
    [items],
  )

  // ---------------------------------------------------------------------------
  // renderContextMenu
  // ---------------------------------------------------------------------------

  const renderContextMenu = useCallback(
    (itemId: string | null) => {
      if (itemId) {
        return (
          <ContextMenuContent className="w-44">
            <ContextMenuItem onClick={() => onEdit(itemId)}>
              <Pencil className="h-4 w-4" />Edit drawer
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onDuplicate(itemId)}>
              <Copy className="h-4 w-4" />Duplicate drawer
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => onDelete(itemId)}>
              <Trash2 className="h-4 w-4" />Delete drawer
            </ContextMenuItem>
          </ContextMenuContent>
        )
      }
      return (
        <ContextMenuContent className="w-44">
          <ContextMenuItem disabled className="text-muted-foreground text-xs">
            Cabinet view
          </ContextMenuItem>
        </ContextMenuContent>
      )
    },
    [onEdit, onDuplicate, onDelete],
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative overflow-auto w-full h-full bg-muted/30 rounded-md border border-border select-none">
      <ItemCanvas
        adapter={adapter}
        items={canvasItems}
        selectedItemIds={selectedIds}
        canDraw={false}
        canResize={false}
        onDragCommit={handleDragCommit}
        onResizeCommit={() => {}}
        onSelectChange={handleSelectChange}
        onItemClick={handleItemClick}
        onItemDoubleClick={(id) => onEdit(id)}
        onDrawComplete={() => {}}
        onContextMenu={handleContextMenu}
        renderItem={renderItem}
        renderContextMenu={renderContextMenu}
      />
    </div>
  )
}
