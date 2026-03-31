'use client'

import React from 'react'
import { Box, AlertTriangle, StickyNote, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { isItemOversized, getRotatedDimensions, calculateItemGridDimensions } from '@/lib/gridfinity'
import { formatDimension } from '@/lib/types'
import { ItemMenuActions } from '@/components/drawer-planner/item-menu-actions'
import type { TreeItemProps } from './types'

export function TreeItem({
  item, drawer, categories, isSelected, isDragging, onSelect, onCtrlSelect, onEdit, onDuplicate,
  onDelete, onDragStart, onDragEnd, allDrawers, onToggleLock, onMoveToDrawer, onMoveToCategory, onRotateTo, displayUnit, config, secondaryLabel,
}: TreeItemProps) {
  const isOversized = drawer ? isItemOversized(item, drawer) : false
  const dims = calculateItemGridDimensions(item, config)
  const heightLabel = (config.itemSizeDisplay ?? 'area') === 'dimensions'
    ? `${dims.gridWidth}×${dims.gridDepth}`
    : `${dims.gridWidth * dims.gridDepth}U`

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable
          onDragStart={(e) => onDragStart(e, item.id)}
          onDragEnd={onDragEnd}
          className={cn(
            'group flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:bg-accent/50 transition-colors',
            isSelected && 'bg-accent',
            isDragging && 'opacity-50',
            isOversized && 'text-destructive'
          )}
          onClick={(e) => e.ctrlKey || e.metaKey ? onCtrlSelect() : onSelect()}
        >
          <Box className={cn('h-3.5 w-3.5 shrink-0', isOversized ? 'text-destructive' : 'text-muted-foreground')} />
          <span className="flex-1 truncate text-sm">{item.name}</span>
          {secondaryLabel && <span className="text-xs text-muted-foreground truncate max-w-[60px]">{secondaryLabel}</span>}
          <span className="text-xs text-muted-foreground shrink-0">{heightLabel}</span>
          {isOversized && drawer && (
            <Tooltip>
              <TooltipTrigger asChild><AlertTriangle className="h-3 w-3 text-destructive shrink-0" /></TooltipTrigger>
              <TooltipContent side="right">
                Item height ({formatDimension(getRotatedDimensions(item).height, displayUnit)}) exceeds drawer height ({formatDimension(drawer.height, displayUnit)})
              </TooltipContent>
            </Tooltip>
          )}
          {item.notes && (
            <Tooltip>
              <TooltipTrigger asChild><StickyNote className="h-3 w-3 text-muted-foreground shrink-0" /></TooltipTrigger>
              <TooltipContent side="right" className="max-w-48 whitespace-pre-wrap">{item.notes}</TooltipContent>
            </Tooltip>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity">
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <ItemMenuActions variant="dropdown" item={item} allDrawers={allDrawers} categories={categories} config={config} onEdit={onEdit} onDuplicate={onDuplicate} onToggleLock={onToggleLock} onDelete={onDelete} onMoveToDrawer={onMoveToDrawer} onMoveToCategory={onMoveToCategory} onRotateTo={onRotateTo} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ItemMenuActions variant="context" item={item} allDrawers={allDrawers} categories={categories} config={config} onEdit={onEdit} onDuplicate={onDuplicate} onToggleLock={onToggleLock} onDelete={onDelete} onMoveToDrawer={onMoveToDrawer} onMoveToCategory={onMoveToCategory} onRotateTo={onRotateTo} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
