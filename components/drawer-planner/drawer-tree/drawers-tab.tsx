'use client'

import React from 'react'
import {
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ArrowUpDown,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertTriangle,
  Plus,
  Check,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { isItemOversized } from '@/lib/gridfinity'
import { getCategoryColor } from '@/lib/types'
import { TreeItem } from './tree-item'
import { DrawerMenuActions } from './drawer-menu-actions'
import { sortItems, SORT_LABELS } from './types'
import type { DrawersTabProps } from './types'

export function DrawersTab({
  filteredDrawers, filteredItemsByDrawer, filteredUnassigned, drawers, categories,
  effectiveExpanded, isCategoryGroupOpen, sortMode, setSortMode, searchTerm,
  searchQuery, draggedItem, allExpanded, selectedDrawerId, toggleAll, toggleDrawer, selectDrawer, toggleCategoryGroup,
  onAddDrawer, onEditDrawer, duplicateDrawer, onEditCategory, onDeleteCategory, setPendingDelete,
  handleDragOver, handleDropOnDrawer, itemProps, config,
}: DrawersTabProps) {
  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between px-2 py-1 mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Drawers</span>
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
          {filteredDrawers.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={toggleAll} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{allExpanded ? 'Collapse all' : 'Expand all'}</TooltipContent>
            </Tooltip>
          )}
          <button onClick={onAddDrawer} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {drawers.length === 0 ? (
        <div className="px-2 py-4 text-sm text-muted-foreground text-center">No drawers yet. Add one to get started.</div>
      ) : filteredDrawers.length === 0 && searchTerm ? (
        <div className="px-2 py-4 text-sm text-muted-foreground text-center">No results for &ldquo;{searchQuery}&rdquo;</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {filteredDrawers.map(drawer => {
            const drawerItems = sortItems(filteredItemsByDrawer.get(drawer.id) ?? [], sortMode, config)
            const isExpanded = effectiveExpanded.has(drawer.id)
            const isSelected = drawer.id === selectedDrawerId
            const hasOversizedItems = drawerItems.some(item => isItemOversized(item, drawer))

            // Group items within this drawer by category
            const categoryGroups: { categoryId: string | null; label: string; color: string; items: typeof drawerItems }[] = []
            const groupMap = new Map<string | null, typeof drawerItems>()
            for (const item of drawerItems) {
              const list = groupMap.get(item.categoryId) ?? []
              list.push(item)
              groupMap.set(item.categoryId, list)
            }
            for (const cat of categories) {
              const items = groupMap.get(cat.id)
              if (items) categoryGroups.push({ categoryId: cat.id, label: cat.name, color: cat.color, items })
            }
            const uncategorized = groupMap.get(null)
            if (uncategorized) categoryGroups.push({ categoryId: null, label: 'Uncategorized', color: getCategoryColor(null, categories), items: uncategorized })

            return (
              <Collapsible key={drawer.id} open={isExpanded} onOpenChange={() => toggleDrawer(drawer.id)}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      className={cn('group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent/50 transition-colors', isSelected && 'bg-accent', draggedItem && 'transition-all')}
                      onClick={() => { selectDrawer(drawer.id); if (!isExpanded) toggleDrawer(drawer.id) }}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropOnDrawer(e, drawer.id)}
                    >
                      <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="p-0.5 rounded hover:bg-accent">
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>
                      </CollapsibleTrigger>
                      <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate text-sm">{drawer.name}</span>
                      {hasOversizedItems && (
                        <Tooltip>
                          <TooltipTrigger asChild><AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" /></TooltipTrigger>
                          <TooltipContent side="right">Contains items that exceed drawer height</TooltipContent>
                        </Tooltip>
                      )}
                      {(config.showDrawerCount ?? true) && <span className="text-xs text-muted-foreground">{drawerItems.length}</span>}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity">
                            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DrawerMenuActions variant="dropdown" onEdit={() => onEditDrawer(drawer)} onDuplicate={() => duplicateDrawer(drawer.id)} onDelete={() => setPendingDelete({ type: 'drawer', id: drawer.id, name: drawer.name })} />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-40">
                    <DrawerMenuActions variant="context" onEdit={() => onEditDrawer(drawer)} onDuplicate={() => duplicateDrawer(drawer.id)} onDelete={() => setPendingDelete({ type: 'drawer', id: drawer.id, name: drawer.name })} />
                  </ContextMenuContent>
                </ContextMenu>

                <CollapsibleContent>
                  <div className="ml-4 pl-2 border-l border-border/50 flex flex-col gap-0.5 py-0.5">
                    {drawerItems.length === 0 ? (
                      <div className="px-2 py-1 text-xs text-muted-foreground italic">No items</div>
                    ) : categoryGroups.length === 1 && categoryGroups[0].categoryId === null ? (
                      categoryGroups[0].items.map(item => <TreeItem key={item.id} {...itemProps(item, drawer)} />)
                    ) : (
                      categoryGroups.map(group => {
                        const groupKey = `${drawer.id}:${group.categoryId ?? 'null'}`
                        const isGroupOpen = isCategoryGroupOpen(groupKey, group.categoryId)
                        return (
                          <Collapsible key={groupKey} open={isGroupOpen} onOpenChange={() => toggleCategoryGroup(groupKey)}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div className="group/cat flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => toggleCategoryGroup(groupKey)}>
                                  <CollapsibleTrigger asChild onClick={e => e.stopPropagation()}>
                                    <button className="p-0.5 rounded hover:bg-accent">
                                      {isGroupOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                    </button>
                                  </CollapsibleTrigger>
                                  <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: group.color }} />
                                  <span className="flex-1 truncate text-xs text-muted-foreground">{group.label}</span>
                                  {(config.showCategoryCount ?? true) && <span className="text-xs text-muted-foreground">{group.items.length}</span>}
                                  {group.categoryId !== null && (() => {
                                    const cat = categories.find(c => c.id === group.categoryId)!
                                    return (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                          <button className="p-0.5 rounded opacity-0 group-hover/cat:opacity-100 hover:bg-accent transition-opacity">
                                            <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-36">
                                          <DropdownMenuItem onClick={() => onEditCategory(cat)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem variant="destructive" onClick={() => onDeleteCategory(cat)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )
                                  })()}
                                </div>
                              </ContextMenuTrigger>
                              {group.categoryId !== null && (() => {
                                const cat = categories.find(c => c.id === group.categoryId)!
                                return (
                                  <ContextMenuContent className="w-36">
                                    <ContextMenuItem onClick={() => onEditCategory(cat)}><Pencil className="h-4 w-4 mr-2" />Edit</ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem variant="destructive" onClick={() => onDeleteCategory(cat)}><Trash2 className="h-4 w-4 mr-2" />Delete</ContextMenuItem>
                                  </ContextMenuContent>
                                )
                              })()}
                            </ContextMenu>
                            <CollapsibleContent>
                              <div className="ml-3 pl-2 border-l border-border/30 flex flex-col gap-0.5 py-0.5">
                                {group.items.map(item => <TreeItem key={item.id} {...itemProps(item, drawer)} />)}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )
                      })
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      )}

      {/* Unassigned — hidden when empty and not dragging */}
      {(filteredUnassigned.length > 0 || draggedItem) && <div className="mt-4">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1 mb-2">Unassigned Items</div>
        <div
          className={cn('rounded-md border border-dashed border-border/50 min-h-[60px] p-1', draggedItem && 'border-primary/50 bg-primary/5')}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDropOnDrawer(e, null)}
        >
          {filteredUnassigned.length === 0 ? (
            <div className="flex items-center justify-center h-[52px] text-xs text-muted-foreground">
              {searchTerm ? 'No matches' : 'Drop items here to unassign'}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {sortItems(filteredUnassigned, sortMode, config).map(item => (
                <TreeItem key={item.id} {...itemProps(item, null)} />
              ))}
            </div>
          )}
        </div>
      </div>}
    </>
  )
}
