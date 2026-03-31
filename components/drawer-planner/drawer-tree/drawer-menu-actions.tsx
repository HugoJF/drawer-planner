'use client'

import React from 'react'
import { Pencil, Copy, Trash2 } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import type { MenuVariant } from '@/components/drawer-planner/item-menu-actions'

interface DrawerMenuActionsProps {
  variant: MenuVariant
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function DrawerMenuActions({ variant, onEdit, onDuplicate, onDelete }: DrawerMenuActionsProps) {
  const Item      = (variant === 'dropdown' ? DropdownMenuItem      : ContextMenuItem)      as typeof DropdownMenuItem
  const Separator = (variant === 'dropdown' ? DropdownMenuSeparator  : ContextMenuSeparator)  as typeof DropdownMenuSeparator
  return (
    <>
      <Item onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Edit</Item>
      <Item onClick={onDuplicate}><Copy className="h-4 w-4 mr-2" />Duplicate</Item>
      <Separator />
      <Item variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</Item>
    </>
  )
}
