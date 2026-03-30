'use client'

import React, { useState, useRef, useMemo, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ArrowUpDown,
  Package,
  Box,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertTriangle,
  ArrowRightLeft,
  Copy,
  Plus,
  Check,
  Search,
  X,
} from 'lucide-react'
import { useDrawerStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { isItemOversized, getRotatedDimensions, calculateItemGridDimensions } from '@/lib/gridfinity'
import { formatDimension } from '@/lib/types'
import type { Drawer, Item, DimensionUnit, GridfinityConfig } from '@/lib/types'
import { DeleteConfirmDialog } from '@/components/drawer-planner/delete-confirm-dialog'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut'

type SortMode = 'insertion' | 'name' | 'size' | 'y' | 'x'

const SORT_LABELS: Record<SortMode, string> = {
  insertion: 'Insertion order',
  name: 'Name',
  size: 'Size (largest first)',
  y: 'Y position',
  x: 'X position',
}

function sortItems(items: Item[], mode: SortMode, config: GridfinityConfig): Item[] {
  if (mode === 'insertion') return items
  return [...items].sort((a, b) => {
    switch (mode) {
      case 'name': return a.name.localeCompare(b.name)
      case 'size': {
        const da = calculateItemGridDimensions(a, config)
        const db = calculateItemGridDimensions(b, config)
        const areaA = da.gridWidth * da.gridDepth
        const areaB = db.gridWidth * db.gridDepth
        return areaB - areaA
      }
      case 'y': return a.gridY !== b.gridY ? a.gridY - b.gridY : a.gridX - b.gridX
      case 'x': return a.gridX !== b.gridX ? a.gridX - b.gridX : a.gridY - b.gridY
    }
  })
}

interface DrawerTreeProps {
  onEditDrawer: (drawer: Drawer) => void
  onEditItem: (item: Item) => void
  onAddDrawer: () => void
}

export function DrawerTree({ onEditDrawer, onEditItem, onAddDrawer }: DrawerTreeProps) {
  const drawers = useDrawerStore(s => s.drawers)
  const selectedDrawerId = useDrawerStore(s => s.selectedDrawerId)
  const selectedItemId = useDrawerStore(s => s.selectedItemId)
  const selectDrawer = useDrawerStore(s => s.selectDrawer)
  const selectItem = useDrawerStore(s => s.selectItem)
  const deleteDrawer = useDrawerStore(s => s.deleteDrawer)
  const duplicateDrawer = useDrawerStore(s => s.duplicateDrawer)
  const deleteItem = useDrawerStore(s => s.deleteItem)
  const duplicateItem = useDrawerStore(s => s.duplicateItem)
  const moveItem = useDrawerStore(s => s.moveItem)
  const allItems = useDrawerStore(s => s.items)
  const config = useDrawerStore(s => s.config)

  const { itemsByDrawer, unassignedItems } = useMemo(() => {
    const map = new Map<string, Item[]>()
    const unassigned: Item[] = []
    for (const item of allItems) {
      if (item.drawerId === null) {
        unassigned.push(item)
      } else {
        const list = map.get(item.drawerId) ?? []
        list.push(item)
        map.set(item.drawerId, list)
      }
    }
    return { itemsByDrawer: map, unassignedItems: unassigned }
  }, [allItems])

  const { toast } = useToast()
  const handleDuplicateItem = useCallback((id: string) => {
    const placed = duplicateItem(id)
    if (!placed) toast({ title: 'No space available', description: 'Item was placed at the same position as the original.' })
  }, [duplicateItem, toast])

  const [expandedDrawers, setExpandedDrawers] = useState<Set<string>>(new Set())
  const [sortMode, setSortMode] = useState<SortMode>('insertion')
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ type: 'drawer' | 'item'; id: string; name: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lastClickRef = useRef<{ id: string; time: number } | null>(null)

  useKeyboardShortcut({ key: 'f', ctrl: true }, () => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  const searchTerm = searchQuery.toLowerCase().trim()

  const { filteredDrawers, filteredItemsByDrawer, filteredUnassigned } = useMemo(() => {
    if (!searchTerm) {
      return { filteredDrawers: drawers, filteredItemsByDrawer: itemsByDrawer, filteredUnassigned: unassignedItems }
    }
    const newItemsByDrawer = new Map<string, Item[]>()
    const matchingDrawers: typeof drawers = []
    for (const drawer of drawers) {
      const drawerItems = itemsByDrawer.get(drawer.id) ?? []
      if (drawer.name.toLowerCase().includes(searchTerm)) {
        newItemsByDrawer.set(drawer.id, drawerItems)
        matchingDrawers.push(drawer)
      } else {
        const matching = drawerItems.filter(item => item.name.toLowerCase().includes(searchTerm))
        if (matching.length > 0) {
          newItemsByDrawer.set(drawer.id, matching)
          matchingDrawers.push(drawer)
        }
      }
    }
    return {
      filteredDrawers: matchingDrawers,
      filteredItemsByDrawer: newItemsByDrawer,
      filteredUnassigned: unassignedItems.filter(item => item.name.toLowerCase().includes(searchTerm)),
    }
  }, [searchTerm, drawers, itemsByDrawer, unassignedItems])

  const effectiveExpanded = useMemo(() => {
    if (!searchTerm) return expandedDrawers
    return new Set(filteredDrawers.map(d => d.id))
  }, [searchTerm, filteredDrawers, expandedDrawers])

  const handleClick = (id: string, onSingle: () => void, onDouble: () => void) => {
    const now = Date.now()
    if (lastClickRef.current?.id === id && now - lastClickRef.current.time < 400) {
      lastClickRef.current = null
      onDouble()
    } else {
      lastClickRef.current = { id, time: now }
      onSingle()
    }
  }

  const toggleDrawer = (id: string) => {
    setExpandedDrawers(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const allExpanded = filteredDrawers.length > 0 && filteredDrawers.every(d => effectiveExpanded.has(d.id))
  const toggleAll = () => {
    setExpandedDrawers(allExpanded ? new Set() : new Set(drawers.map(d => d.id)))
  }

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem(itemId)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDropOnDrawer = (e: React.DragEvent, drawerId: string | null) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData('text/plain')
    if (itemId) {
      moveItem(itemId, drawerId, 0, 0)
    }
    setDraggedItem(null)
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 select-none">
        <div className="flex items-center justify-between px-2 py-1 mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Drawers</span>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(
                      "cursor-pointer transition-colors",
                      sortMode !== 'insertion' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                    )}>
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">Sort items</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-44">
                {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
                  <DropdownMenuItem key={mode} onClick={() => setSortMode(mode)} className="gap-2">
                    <Check className={cn("h-3.5 w-3.5 shrink-0", sortMode === mode ? "opacity-100" : "opacity-0")} />
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
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {drawers.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No drawers yet. Add one to get started.
          </div>
        ) : filteredDrawers.length === 0 && searchTerm ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No results for &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredDrawers.map(drawer => {
              const drawerItems = sortItems(filteredItemsByDrawer.get(drawer.id) ?? [], sortMode, config)
              const isExpanded = effectiveExpanded.has(drawer.id)
              const isSelected = selectedDrawerId === drawer.id
              const hasOversizedItems = drawerItems.some(item => isItemOversized(item, drawer))

              return (
                <Collapsible 
                  key={drawer.id} 
                  open={isExpanded}
                  onOpenChange={() => toggleDrawer(drawer.id)}
                >
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        className={cn(
                          "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer",
                          "hover:bg-accent/50 transition-colors",
                          isSelected && "bg-accent",
                          draggedItem && "transition-all"
                        )}
                        onClick={() => handleClick(drawer.id, () => selectDrawer(drawer.id), () => onEditDrawer(drawer))}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnDrawer(e, drawer.id)}
                      >
                        <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="p-0.5 rounded hover:bg-accent">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </CollapsibleTrigger>

                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />

                        <span className="flex-1 truncate text-sm">{drawer.name}</span>

                        {hasOversizedItems && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              Contains items that exceed drawer height
                            </TooltipContent>
                          </Tooltip>
                        )}

                        <span className="text-xs text-muted-foreground">
                          {drawerItems.length}
                        </span>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity">
                              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DrawerMenuActions
                              variant="dropdown"
                              onEdit={() => onEditDrawer(drawer)}
                              onDuplicate={() => duplicateDrawer(drawer.id)}
                              onDelete={() => setPendingDelete({ type: 'drawer', id: drawer.id, name: drawer.name })}
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-40">
                      <DrawerMenuActions
                        variant="context"
                        onEdit={() => onEditDrawer(drawer)}
                        onDuplicate={() => duplicateDrawer(drawer.id)}
                        onDelete={() => setPendingDelete({ type: 'drawer', id: drawer.id, name: drawer.name })}
                      />
                    </ContextMenuContent>
                  </ContextMenu>

                  <CollapsibleContent>
                    <div className="ml-4 pl-2 border-l border-border/50 flex flex-col gap-0.5 py-0.5">
                      {drawerItems.length === 0 ? (
                        <div className="px-2 py-1 text-xs text-muted-foreground italic">
                          No items
                        </div>
                      ) : (
                        drawerItems.map(item => (
                          <TreeItem
                            key={item.id}
                            item={item}
                            drawer={drawer}
                            isSelected={selectedItemId === item.id}
                            isDragging={draggedItem === item.id}
                            onSelect={() => handleClick(item.id,
                              () => { selectDrawer(drawer.id); selectItem(item.id) },
                              () => onEditItem(item)
                            )}
                            onEdit={() => onEditItem(item)}
                            onDuplicate={() => handleDuplicateItem(item.id)}
                            onDelete={() => setPendingDelete({ type: 'item', id: item.id, name: item.name })}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            allDrawers={drawers}
                            onMoveToDrawer={(drawerId) => moveItem(item.id, drawerId, 0, 0)}
                            displayUnit={config.displayUnit}
                            config={config}
                          />
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        )}

        {/* Unassigned Items */}
        <div className="mt-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1 mb-2">
            Unassigned Items
          </div>
          
          <div
            className={cn(
              "rounded-md border border-dashed border-border/50 min-h-[60px] p-1",
              draggedItem && "border-primary/50 bg-primary/5"
            )}
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
                  <TreeItem
                    key={item.id}
                    item={item}
                    drawer={null}
                    isSelected={selectedItemId === item.id}
                    isDragging={draggedItem === item.id}
                    onSelect={() => handleClick(item.id,
                      () => selectItem(item.id),
                      () => onEditItem(item)
                    )}
                    onEdit={() => onEditItem(item)}
                    onDuplicate={() => duplicateItem(item.id)}
                    onDelete={() => setPendingDelete({ type: 'item', id: item.id, name: item.name })}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    allDrawers={drawers}
                    onMoveToDrawer={(drawerId) => moveItem(item.id, drawerId, 0, 0)}
                    displayUnit={config.displayUnit}
                    config={config}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        key={pendingDelete?.id ?? 'none'}
        open={pendingDelete !== null}
        type={pendingDelete?.type ?? 'item'}
        name={pendingDelete?.name ?? ''}
        onConfirm={(deleteContents) => {
          if (!pendingDelete) return
          if (pendingDelete.type === 'drawer') deleteDrawer(pendingDelete.id, deleteContents)
          else deleteItem(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </ScrollArea>
  )
}

interface TreeItemProps {
  item: Item
  drawer: Drawer | null
  isSelected: boolean
  isDragging: boolean
  onSelect: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent, itemId: string) => void
  onDragEnd: () => void
  allDrawers: Drawer[]
  onMoveToDrawer: (drawerId: string | null) => void
  displayUnit: DimensionUnit
  config: GridfinityConfig
}

function TreeItem({
  item,
  drawer,
  isSelected,
  isDragging,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragEnd,
  allDrawers,
  onMoveToDrawer,
  displayUnit,
  config,
}: TreeItemProps) {
  const isOversized = drawer ? isItemOversized(item, drawer) : false
  const dims = calculateItemGridDimensions(item, config)
  const heightLabel = `${dims.gridWidth * dims.gridDepth}U`

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          draggable
          onDragStart={(e) => onDragStart(e, item.id)}
          onDragEnd={onDragEnd}
          className={cn(
            "group flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer",
            "hover:bg-accent/50 transition-colors",
            isSelected && "bg-accent",
            isDragging && "opacity-50",
            isOversized && "text-destructive"
          )}
          onClick={onSelect}
        >
          <div
            className="h-3 w-3 rounded-sm shrink-0"
            style={{ backgroundColor: item.color }}
          />

          <Box className={cn(
            "h-3.5 w-3.5 shrink-0",
            isOversized ? "text-destructive" : "text-muted-foreground"
          )} />

          <span className="flex-1 truncate text-sm">{item.name}</span>

          <span className="text-xs text-muted-foreground shrink-0">{heightLabel}</span>

          {isOversized && drawer && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="right">
                Item height ({formatDimension(getRotatedDimensions(item).height, displayUnit)}) exceeds drawer height ({formatDimension(drawer.height, displayUnit)})
              </TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity">
                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <ItemMenuActions
                variant="dropdown"
                item={item}
                allDrawers={allDrawers}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onMoveToDrawer={onMoveToDrawer}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ItemMenuActions
          variant="context"
          item={item}
          allDrawers={allDrawers}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onMoveToDrawer={onMoveToDrawer}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ── Shared menu action components ────────────────────────────────────────────

type MenuVariant = 'dropdown' | 'context'

function DrawerMenuActions({ variant, onEdit, onDuplicate, onDelete }: {
  variant: MenuVariant
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const Item = (variant === 'dropdown' ? DropdownMenuItem : ContextMenuItem) as typeof DropdownMenuItem
  const Separator = (variant === 'dropdown' ? DropdownMenuSeparator : ContextMenuSeparator) as typeof DropdownMenuSeparator
  return (
    <>
      <Item onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Edit</Item>
      <Item onClick={onDuplicate}><Copy className="h-4 w-4 mr-2" />Duplicate</Item>
      <Separator />
      <Item variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</Item>
    </>
  )
}

function ItemMenuActions({ variant, item, allDrawers, onEdit, onDuplicate, onDelete, onMoveToDrawer }: {
  variant: MenuVariant
  item: Item
  allDrawers: Drawer[]
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMoveToDrawer: (drawerId: string | null) => void
}) {
  const MenuItem = (variant === 'dropdown' ? DropdownMenuItem : ContextMenuItem) as typeof DropdownMenuItem
  const Separator = (variant === 'dropdown' ? DropdownMenuSeparator : ContextMenuSeparator) as typeof DropdownMenuSeparator
  const Sub = (variant === 'dropdown' ? DropdownMenuSub : ContextMenuSub) as typeof DropdownMenuSub
  const SubTrigger = (variant === 'dropdown' ? DropdownMenuSubTrigger : ContextMenuSubTrigger) as typeof DropdownMenuSubTrigger
  const SubContent = (variant === 'dropdown' ? DropdownMenuSubContent : ContextMenuSubContent) as typeof DropdownMenuSubContent
  return (
    <>
      <MenuItem onClick={onEdit}><Pencil className="h-4 w-4 mr-2" />Edit</MenuItem>
      <MenuItem onClick={onDuplicate}><Copy className="h-4 w-4 mr-2" />Duplicate</MenuItem>
      <Sub>
        <SubTrigger><ArrowRightLeft className="h-4 w-4 mr-2" />Move to</SubTrigger>
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
      <Separator />
      <MenuItem variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</MenuItem>
    </>
  )
}
