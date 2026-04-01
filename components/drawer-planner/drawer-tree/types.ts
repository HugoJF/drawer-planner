import type React from 'react'
import type { Drawer, Item, ItemRotation, Category, DimensionUnit, GridfinityConfig } from '@/lib/types'
import { calculateItemGridDimensions } from '@/lib/gridfinity'
import { ITEM_COLORS } from '@/lib/types'

export type SortMode = 'insertion' | 'name' | 'size' | 'y' | 'x'
export type SidebarTab = 'drawers' | 'categories'

export const SORT_LABELS: Record<SortMode, string> = {
  insertion: 'Insertion order',
  name: 'Name',
  size: 'Size (largest first)',
  y: 'Y position',
  x: 'X position',
}

export function sortItems(items: Item[], mode: SortMode, config: GridfinityConfig): Item[] {
  if (mode === 'insertion') {
    return items
  }
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

export function nextAvailableColor(categories: Category[]): string {
  const used = new Set(categories.map(c => c.color))
  return ITEM_COLORS.find(c => !used.has(c)) ?? ITEM_COLORS[0]
}

export interface TreeItemProps {
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
  onRotateTo: (rotation: ItemRotation) => void
  displayUnit: DimensionUnit
  config: GridfinityConfig
  secondaryLabel?: string
}

export interface DrawersTabProps {
  filteredDrawers: Drawer[]
  filteredItemsByDrawer: Map<string, Item[]>
  filteredUnassigned: Item[]
  drawers: Drawer[]
  categories: Category[]
  effectiveExpanded: Set<string>
  isCategoryGroupOpen: (groupKey: string, categoryId: string | null) => boolean
  sortMode: SortMode
  setSortMode: (m: SortMode) => void
  searchTerm: string
  searchQuery: string
  draggedItem: string | null
  allExpanded: boolean
  selectedDrawerId: string | null
  toggleAll: () => void
  toggleDrawer: (id: string) => void
  selectDrawer: (id: string) => void
  toggleCategoryGroup: (key: string) => void
  onAddDrawer: () => void
  onEditDrawer: (d: Drawer) => void
  duplicateDrawer: (id: string) => void
  onEditCategory: (cat: Category) => void
  onDeleteCategory: (cat: Category) => void
  setPendingDelete: (v: { type: 'drawer' | 'item' | 'category'; id: string; name: string } | null) => void
  handleDragOver: (e: React.DragEvent) => void
  handleDropOnDrawer: (e: React.DragEvent, id: string | null) => void
  itemProps: (item: Item, drawer: Drawer | null) => TreeItemProps
  config: GridfinityConfig
}

export interface CategoriesTabProps {
  categories: Category[]
  itemsByCategory: Map<string | null, Item[]>
  isCategoryGroupOpen: (groupKey: string, categoryId: string | null) => boolean
  toggleCategoryGroup: (key: string) => void
  drawers: Drawer[]
  searchTerm: string
  onOpenAddCategory: () => void
  onEditCategory: (cat: Category) => void
  onDeleteCategory: (cat: Category) => void
  itemProps: (item: Item, drawer: Drawer | null) => TreeItemProps
  config: GridfinityConfig
}
