'use client'

import React, { useMemo, useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ArrowUpDown,
  Check,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
  Tag,
  Search,
  X,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getCategoryColor } from '@/lib/types'
import { TreeItem } from './tree-item'
import { DrawerMenuActions } from './drawer-menu-actions'
import { sortItems, SORT_LABELS } from './types'
import type { DrawerScopedTabProps } from './types'

export function DrawerScopedTab({
  selectedDrawer, drawers, categories, drawerItems,
  isCategoryGroupOpen, toggleCategoryGroup, onBatchToggleCategoryGroups,
  sortMode, setSortMode, searchTerm, searchQuery, setSearchQuery, searchInputRef, draggedItem,
  selectedDrawerId, selectDrawer, onAddDrawer, onEditDrawer, duplicateDrawer,
  onOpenAddCategory, onEditCategory, onDeleteCategory, setPendingDelete,
  handleDragOver, handleDropOnDrawer, itemProps, config,
}: DrawerScopedTabProps) {
  const [drawerPickerOpen, setDrawerPickerOpen] = useState(false)

  const sortedItems = useMemo(
    () => sortItems(drawerItems, sortMode, config),
    [drawerItems, sortMode, config],
  )

  // Group items by category
  const categoryGroups = useMemo(() => {
    const groupMap = new Map<string | null, typeof sortedItems>()
    for (const item of sortedItems) {
      const list = groupMap.get(item.categoryId) ?? []
      list.push(item)
      groupMap.set(item.categoryId, list)
    }
    const groups: { categoryId: string | null; label: string; color: string; items: typeof sortedItems; key: string }[] = []
    for (const cat of categories) {
      const items = groupMap.get(cat.id)
      if (items) {
        groups.push({ categoryId: cat.id, label: cat.name, color: cat.color, items, key: `cat:${cat.id}` })
      }
    }
    const uncategorized = groupMap.get(null)
    if (uncategorized) {
      groups.push({ categoryId: null, label: 'Uncategorized', color: getCategoryColor(null, categories), items: uncategorized, key: 'cat:null' })
    }
    return groups
  }, [sortedItems, categories])

  const allCatsExpanded = categoryGroups.length > 0 && categoryGroups.every(g => isCategoryGroupOpen(g.key, g.categoryId))
  const toggleAllCats = () => {
    const keys = categoryGroups.map(g => g.key)
    onBatchToggleCategoryGroups(keys, !allCatsExpanded)
  }

  return (
    <>
      {/* Drawer selector */}
      <div className="mb-2">
        <Popover open={drawerPickerOpen} onOpenChange={setDrawerPickerOpen}>
          <PopoverTrigger asChild>
            <button className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md border border-input hover:bg-accent/50 transition-colors text-sm',
              !selectedDrawer && 'text-muted-foreground',
            )}>
              <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate text-left">{selectedDrawer?.name ?? 'Select a drawer...'}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="p-1"
            align="start"
            style={{ width: 'var(--radix-popover-trigger-width)' }}
          >
            {drawers.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">No drawers yet.</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {drawers.map(drawer => (
                  <div
                    key={drawer.id}
                    className={cn(
                      'group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors text-sm',
                      drawer.id === selectedDrawerId && 'bg-accent',
                    )}
                    onClick={() => { selectDrawer(drawer.id); setDrawerPickerOpen(false) }}
                  >
                    <Check className={cn('h-3.5 w-3.5 shrink-0', drawer.id === selectedDrawerId ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1 truncate">{drawer.name}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity">
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DrawerMenuActions
                          variant="dropdown"
                          onEdit={() => { onEditDrawer(drawer); setDrawerPickerOpen(false) }}
                          onDuplicate={() => { duplicateDrawer(drawer.id); setDrawerPickerOpen(false) }}
                          onDelete={() => { setPendingDelete({ type: 'drawer', id: drawer.id, name: drawer.name }); setDrawerPickerOpen(false) }}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 mt-0.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors text-sm text-muted-foreground border-t border-border/50"
              onClick={() => { onAddDrawer(); setDrawerPickerOpen(false) }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add drawer
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Search box */}
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && (setSearchQuery(''), e.currentTarget.blur())}
          className="w-full rounded-md border border-input bg-transparent pl-7 pr-7 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Categories header */}
      <div className="flex items-center justify-between px-2 py-1 mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categories</span>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className={cn('cursor-pointer transition-colors', sortMode !== 'insertion' ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Sort items</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-44">
              {(Object.keys(SORT_LABELS) as (keyof typeof SORT_LABELS)[]).map(mode => (
                <DropdownMenuItem key={mode} onClick={() => setSortMode(mode)} className="gap-2">
                  <Check className={cn('h-3.5 w-3.5 shrink-0', sortMode === mode ? 'opacity-100' : 'opacity-0')} />
                  {SORT_LABELS[mode]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {categoryGroups.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={toggleAllCats} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{allCatsExpanded ? 'Collapse all' : 'Expand all'}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onOpenAddCategory} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Add category</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Empty states */}
      {!selectedDrawer ? (
        <div className="px-2 py-6 text-sm text-muted-foreground text-center">Select a drawer above to get started.</div>
      ) : sortedItems.length === 0 && !searchTerm ? (
        <div className="px-2 py-4 text-sm text-muted-foreground text-center">No items in this drawer.</div>
      ) : categoryGroups.length === 0 && searchTerm ? (
        <div className="px-2 py-4 text-sm text-muted-foreground text-center">No results for &ldquo;{searchQuery}&rdquo;</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {categoryGroups.map(group => {
            const isGroupOpen = isCategoryGroupOpen(group.key, group.categoryId)
            const cat = group.categoryId !== null ? categories.find(c => c.id === group.categoryId) ?? null : null
            return (
              <Collapsible key={group.key} open={isGroupOpen} onOpenChange={() => toggleCategoryGroup(group.key)}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      className="group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => toggleCategoryGroup(group.key)}
                    >
                      <CollapsibleTrigger asChild onClick={e => e.stopPropagation()}>
                        <button className="p-0.5 rounded hover:bg-accent">
                          {isGroupOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      </CollapsibleTrigger>
                      <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: group.color }} />
                      <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-sm">{group.label}</span>
                      {config.showCategoryCount && <span className="text-xs text-muted-foreground">{group.items.length}</span>}
                      {cat && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity">
                              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => onEditCategory(cat)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => onDeleteCategory(cat)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </ContextMenuTrigger>
                  {cat && (
                    <ContextMenuContent className="w-36">
                      <ContextMenuItem onClick={() => onEditCategory(cat)}><Pencil className="h-4 w-4 mr-2" />Edit</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem variant="destructive" onClick={() => onDeleteCategory(cat)}><Trash2 className="h-4 w-4 mr-2" />Delete</ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
                <CollapsibleContent>
                  <div className="ml-4 pl-2 border-l border-border/50 flex flex-col gap-0.5 py-0.5">
                    {group.items.map(item => (
                      <TreeItem key={item.id} {...itemProps(item, selectedDrawer)} />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      )}

      {/* Unassigned drop zone — shown when dragging */}
      {draggedItem && (
        <div className="mt-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1 mb-2">Unassigned Items</div>
          <div
            className="rounded-md border border-dashed border-primary/50 bg-primary/5 min-h-[48px] p-1 flex items-center justify-center"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropOnDrawer(e, null)}
          >
            <span className="text-xs text-muted-foreground">Drop here to unassign from drawer</span>
          </div>
        </div>
      )}
    </>
  )
}
