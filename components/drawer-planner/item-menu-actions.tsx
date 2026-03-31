'use client'

import React from 'react'
import { Pencil, Copy, Lock, Unlock, ArrowRightLeft, Tag, Trash2, Package, FolderOpen, AlertTriangle } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import { isItemOversized } from '@/lib/gridfinity'
import { getCategoryColor } from '@/lib/types'
import type { Item, Drawer, Category } from '@/lib/types'

export type MenuVariant = 'dropdown' | 'context'

interface ItemMenuActionsProps {
  variant: MenuVariant
  item: Item
  allDrawers: Drawer[]
  categories: Category[]
  onEdit: () => void
  onDuplicate: () => void
  onToggleLock: () => void
  onDelete: () => void
  onMoveToDrawer: (drawerId: string | null) => void
  onMoveToCategory: (categoryId: string | null) => void
}

export function ItemMenuActions({
  variant, item, allDrawers, categories,
  onEdit, onDuplicate, onToggleLock, onDelete, onMoveToDrawer, onMoveToCategory,
}: ItemMenuActionsProps) {
  const MenuItem      = (variant === 'dropdown' ? DropdownMenuItem      : ContextMenuItem)      as typeof DropdownMenuItem
  const Separator     = (variant === 'dropdown' ? DropdownMenuSeparator  : ContextMenuSeparator)  as typeof DropdownMenuSeparator
  const Sub           = (variant === 'dropdown' ? DropdownMenuSub        : ContextMenuSub)        as typeof DropdownMenuSub
  const SubTrigger    = (variant === 'dropdown' ? DropdownMenuSubTrigger : ContextMenuSubTrigger) as typeof DropdownMenuSubTrigger
  const SubContent    = (variant === 'dropdown' ? DropdownMenuSubContent : ContextMenuSubContent) as typeof DropdownMenuSubContent

  return (
    <>
      <MenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Edit</MenuItem>
      <MenuItem onClick={onDuplicate}><Copy className="h-4 w-4 mr-2" />Duplicate</MenuItem>
      <MenuItem onClick={onToggleLock}>
        {item.locked
          ? <><Unlock className="h-4 w-4 mr-2" />Unlock</>
          : <><Lock className="h-4 w-4 mr-2" />Lock</>
        }
      </MenuItem>
      <Separator />
      <Sub>
        <SubTrigger disabled={item.locked}><ArrowRightLeft className="h-4 w-4 mr-2" />Move to drawer</SubTrigger>
        <SubContent className="max-h-60 overflow-auto">
          <MenuItem onClick={() => onMoveToDrawer(null)} disabled={!item.drawerId}>
            <Package className="h-4 w-4 mr-2" />Unassigned
          </MenuItem>
          <Separator />
          {allDrawers.map(d => (
            <MenuItem key={d.id} onClick={() => onMoveToDrawer(d.id)} disabled={d.id === item.drawerId}>
              <FolderOpen className="h-4 w-4 mr-2" />{d.name}
              {isItemOversized(item, d) && <AlertTriangle className="h-3 w-3 text-destructive ml-auto" />}
            </MenuItem>
          ))}
        </SubContent>
      </Sub>
      <Sub>
        <SubTrigger><Tag className="h-4 w-4 mr-2" />Set category</SubTrigger>
        <SubContent className="max-h-60 overflow-auto">
          <MenuItem onClick={() => onMoveToCategory(null)} disabled={item.categoryId === null}>
            <div className="h-3 w-3 rounded-sm shrink-0 mr-2 bg-slate-400" />None
          </MenuItem>
          {categories.length > 0 && <Separator />}
          {categories.map(c => (
            <MenuItem key={c.id} onClick={() => onMoveToCategory(c.id)} disabled={item.categoryId === c.id}>
              <div className="h-3 w-3 rounded-sm shrink-0 mr-2" style={{ backgroundColor: getCategoryColor(c.id, categories) }} />{c.name}
            </MenuItem>
          ))}
        </SubContent>
      </Sub>
      <Separator />
      <MenuItem variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</MenuItem>
    </>
  )
}
