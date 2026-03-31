'use client'

import React, { useState, useRef, useMemo, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useDrawerStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DeleteConfirmDialog } from '@/components/drawer-planner/delete-confirm-dialog'
import { CategoryForm } from '@/components/drawer-planner/category-form'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut'
import type { Drawer, Item, ItemRotation, Category } from '@/lib/types'
import { ITEM_COLORS } from '@/lib/types'
import { DrawersTab } from './drawers-tab'
import { CategoriesTab } from './categories-tab'
import { nextAvailableColor } from './types'
import type { SidebarTab } from './types'

interface DrawerTreeProps {
  onEditDrawer: (drawer: Drawer) => void
  onEditItem: (item: Item) => void
  onAddDrawer: () => void
}

export function DrawerTree({ onEditDrawer, onEditItem, onAddDrawer }: DrawerTreeProps) {
  const drawers            = useDrawerStore(s => s.drawers)
  const allItems           = useDrawerStore(s => s.items)
  const categories         = useDrawerStore(s => s.categories)
  const config             = useDrawerStore(s => s.config)
  const searchQuery        = useDrawerStore(s => s.searchQuery)
  const setSearchQuery     = useDrawerStore(s => s.setSearchQuery)
  const selectedDrawerId   = useDrawerStore(s => s.selectedDrawerId)
  const selectedItemIds    = useDrawerStore(s => s.selectedItemIds)
  const selectDrawer       = useDrawerStore(s => s.selectDrawer)
  const selectItem         = useDrawerStore(s => s.selectItem)
  const toggleItemSelection = useDrawerStore(s => s.toggleItemSelection)
  const deleteDrawer       = useDrawerStore(s => s.deleteDrawer)
  const duplicateDrawer    = useDrawerStore(s => s.duplicateDrawer)
  const deleteItem         = useDrawerStore(s => s.deleteItem)
  const duplicateItem      = useDrawerStore(s => s.duplicateItem)
  const moveItem           = useDrawerStore(s => s.moveItem)
  const updateItem         = useDrawerStore(s => s.updateItem)
  const addCategory        = useDrawerStore(s => s.addCategory)
  const updateCategory     = useDrawerStore(s => s.updateCategory)
  const deleteCategory     = useDrawerStore(s => s.deleteCategory)

  const [activeTab, setActiveTab] = useState<SidebarTab>('drawers')
  const [expandedDrawers, setExpandedDrawers] = useState<Set<string>>(new Set())
  const [expandedCategoryGroups, setExpandedCategoryGroups] = useState<Set<string>>(new Set())
  const [sortMode, setSortMode] = useState<'insertion' | 'name' | 'size' | 'y' | 'x'>('insertion')
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ type: 'drawer' | 'item' | 'category'; id: string; name: string } | null>(null)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lastClickRef = useRef<{ id: string; time: number } | null>(null)

  const { toast } = useToast()
  const handleDuplicateItem = useCallback((id: string) => {
    const placed = duplicateItem(id)
    if (!placed) toast({ title: 'No space available', description: 'Item was placed at the same position as the original.' })
  }, [duplicateItem, toast])

  useKeyboardShortcut({ key: 'f', ctrl: true }, () => {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  })

  // ── Item grouping ─────────────────────────────────────────────────────────────

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

  // ── Interaction helpers ───────────────────────────────────────────────────────

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
    onRotateTo: (rotation: ItemRotation) => updateItem({ ...item, rotation }),
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
            itemsByCategory={itemsByCategory}
            isCategoryGroupOpen={isCategoryGroupOpen}
            toggleCategoryGroup={toggleCategoryGroup}
            drawers={drawers}
            searchTerm={searchTerm}
            onOpenAddCategory={openAddCategory}
            onEditCategory={openEditCategory}
            onDeleteCategory={(cat) => setPendingDelete({ type: 'category', id: cat.id, name: cat.name })}
            itemProps={itemProps}
            config={config}
          />
        )}
      </div>

      <CategoryForm
        key={categoryFormOpen ? (editingCategory?.id ?? 'new') : 'closed'}
        open={categoryFormOpen}
        onOpenChange={setCategoryFormOpen}
        category={editingCategory}
        defaultColor={nextAvailableColor(categories)}
        onSave={handleCategoryFormSave}
      />

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
