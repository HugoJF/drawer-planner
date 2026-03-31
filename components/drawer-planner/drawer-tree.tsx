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
  Tag,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertTriangle,
  StickyNote,
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
import { formatDimension, getCategoryColor } from '@/lib/types'
import type { Drawer, Item, Category, DimensionUnit, GridfinityConfig } from '@/lib/types'
import { DeleteConfirmDialog } from '@/components/drawer-planner/delete-confirm-dialog'
import { CategoryForm } from '@/components/drawer-planner/category-form'
import { ItemMenuActions } from '@/components/drawer-planner/item-menu-actions'
import type { MenuVariant } from '@/components/drawer-planner/item-menu-actions'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut'
import { ITEM_COLORS } from '@/lib/types'

type SortMode = 'insertion' | 'name' | 'size' | 'y' | 'x'
type SidebarTab = 'drawers' | 'categories'

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
        return (db.gridWidth * db.gridDepth) - (da.gridWidth * da.gridDepth)
      }
      case 'y': return a.gridY !== b.gridY ? a.gridY - b.gridY : a.gridX - b.gridX
      case 'x': return a.gridX !== b.gridX ? a.gridX - b.gridX : a.gridY - b.gridY
    }
  })
}

/** Pick the first ITEM_COLORS entry not already used by an existing category. */
function nextAvailableColor(categories: Category[]): string {
  const used = new Set(categories.map(c => c.color))
  return ITEM_COLORS.find(c => !used.has(c)) ?? ITEM_COLORS[0]
}

interface DrawerTreeProps {
  onEditDrawer: (drawer: Drawer) => void
  onEditItem: (item: Item) => void
  onAddDrawer: () => void
}

export function DrawerTree({ onEditDrawer, onEditItem, onAddDrawer }: DrawerTreeProps) {
  const drawers       = useDrawerStore(s => s.drawers)
  const allItems      = useDrawerStore(s => s.items)
  const categories    = useDrawerStore(s => s.categories)
  const config        = useDrawerStore(s => s.config)
  const searchQuery   = useDrawerStore(s => s.searchQuery)
  const setSearchQuery = useDrawerStore(s => s.setSearchQuery)
  const selectedDrawerId  = useDrawerStore(s => s.selectedDrawerId)
  const selectedItemIds   = useDrawerStore(s => s.selectedItemIds)
  const selectDrawer      = useDrawerStore(s => s.selectDrawer)
  const selectItem        = useDrawerStore(s => s.selectItem)
  const toggleItemSelection = useDrawerStore(s => s.toggleItemSelection)
  const deleteDrawer   = useDrawerStore(s => s.deleteDrawer)
  const duplicateDrawer = useDrawerStore(s => s.duplicateDrawer)
  const deleteItem     = useDrawerStore(s => s.deleteItem)
  const duplicateItem  = useDrawerStore(s => s.duplicateItem)
  const moveItem       = useDrawerStore(s => s.moveItem)
  const updateItem     = useDrawerStore(s => s.updateItem)
  const addCategory    = useDrawerStore(s => s.addCategory)
  const updateCategory = useDrawerStore(s => s.updateCategory)
  const deleteCategory = useDrawerStore(s => s.deleteCategory)

  const { toast } = useToast()
  const handleDuplicateItem = useCallback((id: string) => {
    const placed = duplicateItem(id)
    if (!placed) toast({ title: 'No space available', description: 'Item was placed at the same position as the original.' })
  }, [duplicateItem, toast])

  const [activeTab, setActiveTab] = useState<SidebarTab>('drawers')
  const [expandedDrawers, setExpandedDrawers] = useState<Set<string>>(new Set())
  const [expandedCategoryGroups, setExpandedCategoryGroups] = useState<Set<string>>(new Set())
  const [sortMode, setSortMode] = useState<SortMode>('insertion')
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ type: 'drawer' | 'item' | 'category'; id: string; name: string } | null>(null)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lastClickRef = useRef<{ id: string; time: number } | null>(null)

  useKeyboardShortcut({ key: 'f', ctrl: true }, () => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  // ── Item grouping ────────────────────────────────────────────────────────────

  const { itemsByDrawer, unassignedItems, itemsByCategory } = useMemo(() => {
    const byDrawer = new Map<string, Item[]>()
    const unassigned: Item[] = []
    const byCategory = new Map<string | null, Item[]>()

    for (const item of allItems) {
      if (item.drawerId === null) unassigned.push(item)
      else {
        const list = byDrawer.get(item.drawerId) ?? []
        list.push(item)
        byDrawer.set(item.drawerId, list)
      }
      const catList = byCategory.get(item.categoryId) ?? []
      catList.push(item)
      byCategory.set(item.categoryId, catList)
    }
    return { itemsByDrawer: byDrawer, unassignedItems: unassigned, itemsByCategory: byCategory }
  }, [allItems])

  const searchTerm = searchQuery.toLowerCase().trim()

  const { filteredDrawers, filteredItemsByDrawer, filteredUnassigned } = useMemo(() => {
    if (!searchTerm) return { filteredDrawers: drawers, filteredItemsByDrawer: itemsByDrawer, filteredUnassigned: unassignedItems }
    const newItemsByDrawer = new Map<string, Item[]>()
    const matchingDrawers: typeof drawers = []
    for (const drawer of drawers) {
      const drawerItems = itemsByDrawer.get(drawer.id) ?? []
      if (drawer.name.toLowerCase().includes(searchTerm)) {
        newItemsByDrawer.set(drawer.id, drawerItems)
        matchingDrawers.push(drawer)
      } else {
        const matching = drawerItems.filter(i => i.name.toLowerCase().includes(searchTerm))
        if (matching.length > 0) { newItemsByDrawer.set(drawer.id, matching); matchingDrawers.push(drawer) }
      }
    }
    return {
      filteredDrawers: matchingDrawers,
      filteredItemsByDrawer: newItemsByDrawer,
      filteredUnassigned: unassignedItems.filter(i => i.name.toLowerCase().includes(searchTerm)),
    }
  }, [searchTerm, drawers, itemsByDrawer, unassignedItems])

  const effectiveExpanded = useMemo(() => {
    if (!searchTerm) return expandedDrawers
    return new Set(filteredDrawers.map(d => d.id))
  }, [searchTerm, filteredDrawers, expandedDrawers])

  // ── Interaction helpers ──────────────────────────────────────────────────────

  const handleClick = (id: string, onSingle: () => void, onDouble: () => void) => {
    const now = Date.now()
    if (lastClickRef.current?.id === id && now - lastClickRef.current.time < 400) {
      lastClickRef.current = null; onDouble()
    } else {
      lastClickRef.current = { id, time: now }; onSingle()
    }
  }

  const toggleDrawer = (id: string) => setExpandedDrawers(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const toggleCategoryGroup = (key: string) => setExpandedCategoryGroups(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next
  })

  const categoryExpansion = config.categoryExpansion ?? 'none'
  const isCategoryGroupOpen = useCallback((groupKey: string, categoryId: string | null): boolean => {
    if (categoryExpansion === 'all') return true
    if (categoryExpansion === 'categorized') return categoryId !== null
    return expandedCategoryGroups.has(groupKey)
  }, [categoryExpansion, expandedCategoryGroups])

  const allExpanded = filteredDrawers.length > 0 && filteredDrawers.every(d => effectiveExpanded.has(d.id))
  const toggleAll = () => setExpandedDrawers(allExpanded ? new Set() : new Set(drawers.map(d => d.id)))

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem(itemId)
  }
  const handleDragEnd = () => setDraggedItem(null)
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleDropOnDrawer = (e: React.DragEvent, drawerId: string | null) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData('text/plain')
    if (itemId) moveItem(itemId, drawerId, 0, 0)
    setDraggedItem(null)
  }

  // ── Shared item props builder ─────────────────────────────────────────────────

  const itemProps = (item: Item, drawer: Drawer | null) => ({
    item,
    drawer,
    categories,
    isSelected: selectedItemIds.has(item.id),
    isDragging: draggedItem === item.id,
    onSelect: () => handleClick(item.id,
      () => selectedItemIds.has(item.id) ? toggleItemSelection(item.id) : (drawer && selectDrawer(drawer.id), selectItem(item.id)),
      () => onEditItem(item)
    ),
    onCtrlSelect: () => toggleItemSelection(item.id),
    onEdit: () => onEditItem(item),
    onDuplicate: () => handleDuplicateItem(item.id),
    onDelete: () => setPendingDelete({ type: 'item', id: item.id, name: item.name }),
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    allDrawers: drawers,
    onToggleLock: () => updateItem({ ...item, locked: !item.locked }),
    onMoveToDrawer: (drawerId: string | null) => moveItem(item.id, drawerId, 0, 0),
    onMoveToCategory: (categoryId: string | null) => updateItem({ ...item, categoryId }),
    displayUnit: config.displayUnit,
    config,
  })

  // ── Category form handlers ────────────────────────────────────────────────────

  const openAddCategory = () => { setEditingCategory(null); setCategoryFormOpen(true) }
  const openEditCategory = (cat: Category) => { setEditingCategory(cat); setCategoryFormOpen(true) }
  const handleCategoryFormSave = (name: string, color: string) => {
    if (editingCategory) updateCategory({ ...editingCategory, name, color })
    else addCategory(name, color)
  }

  return (
    <ScrollArea className="h-full">
      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        <button
          className={cn(
            'flex-1 py-2 text-xs font-medium transition-colors',
            activeTab === 'drawers' ? 'text-foreground border-b-2 border-primary -mb-px' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('drawers')}
        >
          Drawers
        </button>
        <button
          className={cn(
            'flex-1 py-2 text-xs font-medium transition-colors',
            activeTab === 'categories' ? 'text-foreground border-b-2 border-primary -mb-px' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
      </div>

      <div className="p-2 select-none">
        {/* Search box — shared between tabs */}
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

        {activeTab === 'drawers' ? (
          <DrawersTab
            filteredDrawers={filteredDrawers}
            filteredItemsByDrawer={filteredItemsByDrawer}
            filteredUnassigned={filteredUnassigned}
            drawers={drawers}
            categories={categories}
            effectiveExpanded={effectiveExpanded}
            isCategoryGroupOpen={isCategoryGroupOpen}
            sortMode={sortMode}
            setSortMode={setSortMode}
            searchTerm={searchTerm}
            searchQuery={searchQuery}
            draggedItem={draggedItem}
            allExpanded={allExpanded}
            selectedDrawerId={selectedDrawerId}
            toggleAll={toggleAll}
            toggleDrawer={toggleDrawer}
            selectDrawer={selectDrawer}
            toggleCategoryGroup={toggleCategoryGroup}
            onAddDrawer={onAddDrawer}
            onEditDrawer={onEditDrawer}
            duplicateDrawer={duplicateDrawer}
            onEditCategory={openEditCategory}
            onDeleteCategory={(cat) => setPendingDelete({ type: 'category', id: cat.id, name: cat.name })}
            setPendingDelete={setPendingDelete}
            handleDragOver={handleDragOver}
            handleDropOnDrawer={handleDropOnDrawer}
            itemProps={itemProps}
            config={config}
          />
        ) : (
          <CategoriesTab
            categories={categories}
            allItems={allItems}
            itemsByCategory={itemsByCategory}
            isCategoryGroupOpen={isCategoryGroupOpen}
            toggleCategoryGroup={toggleCategoryGroup}
            drawers={drawers}
            searchTerm={searchTerm}
            selectedItemIds={selectedItemIds}
            onOpenAddCategory={openAddCategory}
            onEditCategory={openEditCategory}
            onDeleteCategory={(cat) => setPendingDelete({ type: 'category', id: cat.id, name: cat.name })}
            itemProps={itemProps}
            config={config}
          />
        )}
      </div>

      {/* Category form modal */}
      <CategoryForm
        key={categoryFormOpen ? (editingCategory?.id ?? 'new') : 'closed'}
        open={categoryFormOpen}
        onOpenChange={setCategoryFormOpen}
        category={editingCategory}
        defaultColor={nextAvailableColor(categories)}
        onSave={handleCategoryFormSave}
      />

      {/* Delete confirm */}
      <DeleteConfirmDialog
        key={pendingDelete?.id ?? 'none'}
        open={pendingDelete !== null}
        type={pendingDelete?.type === 'category' ? 'item' : (pendingDelete?.type ?? 'item')}
        name={pendingDelete?.name ?? ''}
        onConfirm={(deleteContents) => {
          if (!pendingDelete) return
          if (pendingDelete.type === 'drawer') deleteDrawer(pendingDelete.id, deleteContents)
          else if (pendingDelete.type === 'item') deleteItem(pendingDelete.id)
          else if (pendingDelete.type === 'category') deleteCategory(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </ScrollArea>
  )
}

// ── Drawers tab ───────────────────────────────────────────────────────────────

function DrawersTab({
  filteredDrawers, filteredItemsByDrawer, filteredUnassigned, drawers, categories,
  effectiveExpanded, isCategoryGroupOpen, sortMode, setSortMode, searchTerm,
  searchQuery, draggedItem, allExpanded, selectedDrawerId, toggleAll, toggleDrawer, selectDrawer, toggleCategoryGroup,
  onAddDrawer, onEditDrawer, duplicateDrawer, onEditCategory, onDeleteCategory, setPendingDelete,
  handleDragOver, handleDropOnDrawer, itemProps, config,
}: {
  filteredDrawers: Drawer[]; filteredItemsByDrawer: Map<string, Item[]>; filteredUnassigned: Item[]
  drawers: Drawer[]; categories: Category[]; effectiveExpanded: Set<string>
  isCategoryGroupOpen: (groupKey: string, categoryId: string | null) => boolean; sortMode: SortMode; setSortMode: (m: SortMode) => void
  searchTerm: string; searchQuery: string; draggedItem: string | null; allExpanded: boolean; selectedDrawerId: string | null
  toggleAll: () => void; toggleDrawer: (id: string) => void; selectDrawer: (id: string) => void; toggleCategoryGroup: (key: string) => void
  onAddDrawer: () => void; onEditDrawer: (d: Drawer) => void; duplicateDrawer: (id: string) => void
  onEditCategory: (cat: Category) => void; onDeleteCategory: (cat: Category) => void
  setPendingDelete: (v: { type: 'drawer' | 'item' | 'category'; id: string; name: string } | null) => void
  handleDragOver: (e: React.DragEvent) => void; handleDropOnDrawer: (e: React.DragEvent, id: string | null) => void
  itemProps: (item: Item, drawer: Drawer | null) => TreeItemProps; config: GridfinityConfig
}) {
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
              {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
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
            const categoryGroups: { categoryId: string | null; label: string; color: string; items: Item[] }[] = []
            const groupMap = new Map<string | null, Item[]>()
            for (const item of drawerItems) {
              const list = groupMap.get(item.categoryId) ?? []
              list.push(item)
              groupMap.set(item.categoryId, list)
            }
            // Named categories first (in definition order), then uncategorized
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
                      // All items uncategorized — render flat (no sub-grouping)
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

// ── Categories tab ────────────────────────────────────────────────────────────

function CategoriesTab({
  categories, allItems, itemsByCategory, isCategoryGroupOpen, toggleCategoryGroup,
  drawers, searchTerm, selectedItemIds, onOpenAddCategory, onEditCategory,
  onDeleteCategory, itemProps, config,
}: {
  categories: Category[]; allItems: Item[]; itemsByCategory: Map<string | null, Item[]>
  isCategoryGroupOpen: (groupKey: string, categoryId: string | null) => boolean; toggleCategoryGroup: (key: string) => void
  drawers: Drawer[]; searchTerm: string; selectedItemIds: Set<string>
  onOpenAddCategory: () => void; onEditCategory: (cat: Category) => void
  onDeleteCategory: (cat: Category) => void
  itemProps: (item: Item, drawer: Drawer | null) => TreeItemProps; config: GridfinityConfig
}) {
  const filteredItemsByCategory = useMemo<Map<string | null, Item[]>>(() => {
    if (!searchTerm) return itemsByCategory
    const result = new Map<string | null, Item[]>()
    for (const [key, items] of itemsByCategory) {
      const filtered = items.filter(i => i.name.toLowerCase().includes(searchTerm))
      if (filtered.length) result.set(key, filtered)
    }
    return result
  }, [searchTerm, itemsByCategory])

  const drawerMap = useMemo(() => new Map(drawers.map(d => [d.id, d])), [drawers])

  const renderCategoryGroup = (categoryId: string | null, label: string, color: string) => {
    const items = filteredItemsByCategory.get(categoryId)
    if (!items) return null
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
              const drawer = item.drawerId ? drawerMap.get(item.drawerId) ?? null : null
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

// ── TreeItem ──────────────────────────────────────────────────────────────────

interface TreeItemProps {
  item: Item
  drawer: Drawer | null
  categories: Category[]
  isSelected: boolean
  isDragging: boolean
  onSelect: () => void
  onCtrlSelect: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent, itemId: string) => void
  onDragEnd: () => void
  allDrawers: Drawer[]
  onToggleLock: () => void
  onMoveToDrawer: (drawerId: string | null) => void
  onMoveToCategory: (categoryId: string | null) => void
  displayUnit: DimensionUnit
  config: GridfinityConfig
  secondaryLabel?: string
}

function TreeItem({
  item, drawer, categories, isSelected, isDragging, onSelect, onCtrlSelect, onEdit, onDuplicate,
  onDelete, onDragStart, onDragEnd, allDrawers, onToggleLock, onMoveToDrawer, onMoveToCategory, displayUnit, config, secondaryLabel,
}: TreeItemProps) {
  const isOversized = drawer ? isItemOversized(item, drawer) : false
  const dims = calculateItemGridDimensions(item, config)
  const heightLabel = (config.itemSizeDisplay ?? 'area') === 'dimensions'
    ? `${dims.gridWidth}×${dims.gridDepth}`
    : `${dims.gridWidth * dims.gridDepth}U`
  const color = getCategoryColor(item.categoryId, categories)

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
              <ItemMenuActions variant="dropdown" item={item} allDrawers={allDrawers} categories={categories} onEdit={onEdit} onDuplicate={onDuplicate} onToggleLock={onToggleLock} onDelete={onDelete} onMoveToDrawer={onMoveToDrawer} onMoveToCategory={onMoveToCategory} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ItemMenuActions variant="context" item={item} allDrawers={allDrawers} categories={categories} onEdit={onEdit} onDuplicate={onDuplicate} onToggleLock={onToggleLock} onDelete={onDelete} onMoveToDrawer={onMoveToDrawer} onMoveToCategory={onMoveToCategory} />
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ── Shared menu action components ─────────────────────────────────────────────

function DrawerMenuActions({ variant, onEdit, onDuplicate, onDelete }: { variant: MenuVariant; onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
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

