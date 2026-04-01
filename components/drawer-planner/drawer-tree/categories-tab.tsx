'use client'

import React, { useMemo } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Tag,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { getCategoryColor } from '@/lib/types'
import type { Item, Drawer } from '@/lib/types'
import { TreeItem } from './tree-item'
import type { CategoriesTabProps } from './types'

export function CategoriesTab({
  categories, itemsByCategory, isCategoryGroupOpen, toggleCategoryGroup,
  drawers, searchTerm, onOpenAddCategory, onEditCategory,
  onDeleteCategory, itemProps, config,
}: CategoriesTabProps) {
  const filteredItemsByCategory = useMemo<Map<string | null, Item[]>>(() => {
    if (!searchTerm) {
      return itemsByCategory
    }
    const result = new Map<string | null, Item[]>()
    for (const [key, items] of itemsByCategory) {
      const filtered = items.filter(i => i.name.toLowerCase().includes(searchTerm))
      if (filtered.length) {
        result.set(key, filtered)
      }
    }
    return result
  }, [searchTerm, itemsByCategory])

  const drawerMap = useMemo(() => new Map(drawers.map(d => [d.id, d])), [drawers])

  const renderCategoryGroup = (categoryId: string | null, label: string, color: string) => {
    const items = filteredItemsByCategory.get(categoryId)
    if (!items) {
      return null
    }
    const groupKey = `cat:${categoryId ?? 'null'}`
    const isOpen = isCategoryGroupOpen(groupKey, categoryId)
    const category = categories.find(c => c.id === categoryId) ?? null

    return (
      <Collapsible key={groupKey} open={isOpen} onOpenChange={() => toggleCategoryGroup(groupKey)}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => toggleCategoryGroup(groupKey)}>
              <CollapsibleTrigger asChild onClick={e => e.stopPropagation()}>
                <button className="p-0.5 rounded hover:bg-accent">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate text-sm">{label}</span>
              {(config.showCategoryCount ?? true) && <span className="text-xs text-muted-foreground">{items.length}</span>}
              {category && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                    <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity">
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => onEditCategory(category)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDeleteCategory(category)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </ContextMenuTrigger>
          {category && (
            <ContextMenuContent className="w-36">
              <ContextMenuItem onClick={() => onEditCategory(category)}><Pencil className="h-4 w-4 mr-2" />Edit</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onClick={() => onDeleteCategory(category)}><Trash2 className="h-4 w-4 mr-2" />Delete</ContextMenuItem>
            </ContextMenuContent>
          )}
        </ContextMenu>
        <CollapsibleContent>
          <div className="ml-4 pl-2 border-l border-border/50 flex flex-col gap-0.5 py-0.5">
            {items.map(item => {
              const drawer: Drawer | null = item.drawerId ? drawerMap.get(item.drawerId) ?? null : null
              return <TreeItem key={item.id} {...itemProps(item, drawer)} secondaryLabel={drawer?.name ?? 'Unassigned'} />
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const hasAny = categories.some(c => filteredItemsByCategory.has(c.id)) || filteredItemsByCategory.has(null)

  return (
    <>
      <div className="flex items-center justify-between px-2 py-1 mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categories</span>
        <button onClick={onOpenAddCategory} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {categories.length === 0 && !searchTerm ? (
        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
          No categories yet.<br />
          <button onClick={onOpenAddCategory} className="text-primary underline-offset-2 hover:underline mt-1">Add one</button>
        </div>
      ) : !hasAny ? (
        <div className="px-2 py-4 text-sm text-muted-foreground text-center">No results for &ldquo;{searchTerm}&rdquo;</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {categories.map(cat => renderCategoryGroup(cat.id, cat.name, cat.color))}
          {renderCategoryGroup(null, 'Uncategorized', getCategoryColor(null, categories))}
        </div>
      )}
    </>
  )
}
