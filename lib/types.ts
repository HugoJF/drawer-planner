// Gridfinity Drawer Planner Types

export type DimensionUnit = 'mm' | 'cm'

export interface GridfinityConfig {
  cellSize: number       // Default: 42mm
  heightUnit: number     // Default: 7mm (1U)
  tolerance: number      // Default: 0.5mm
  wallThickness: number  // Default: 1.2mm
  displayUnit: DimensionUnit // Default: 'mm'
  showDrawerCount: boolean   // Default: true
  showCategoryCount: boolean // Default: true
  itemSizeDisplay: 'area' | 'dimensions' // Default: 'area' — "20U" vs "5×4"
  categoryExpansion: 'none' | 'all' | 'categorized' // Default: 'none'
  gridColorMode: 'category' | 'height' // Default: 'category'
  showSidebarStats: boolean              // Default: true
}

export interface Drawer {
  id: string
  name: string
  width: number          // mm
  height: number         // mm (internal height)
  depth: number          // mm
  gridCols: number       // calculated
  gridRows: number       // calculated
}

export interface Category {
  id: string
  name: string
  color: string          // hex
}

export const UNCATEGORIZED_COLOR = '#94a3b8'

export function getCategoryColor(categoryId: string | null, categories: Category[]): string {
  if (!categoryId) return UNCATEGORIZED_COLOR
  return categories.find(c => c.id === categoryId)?.color ?? UNCATEGORIZED_COLOR
}

export type ItemRotation = 'h-up' | 'h-up-r' | 'd-up' | 'd-up-r' | 'w-up' | 'w-up-r'

export interface Item {
  id: string
  name: string
  width: number          // mm (0 = unknown, permitted in manual mode)
  height: number         // mm
  depth: number          // mm
  categoryId: string | null
  rotation: ItemRotation
  drawerId: string | null
  gridX: number          // grid position
  gridY: number
  gridMode: 'auto' | 'manual'
  manualGridCols?: number         // explicit footprint cols (post-rotation), manual mode only
  manualGridRows?: number         // explicit footprint rows (post-rotation), manual mode only
  locked: boolean
  notes?: string
}

export interface ItemGridDimensions {
  gridWidth: number      // cells required (X axis)
  gridDepth: number      // cells required (Y axis)
  heightUnits: number    // U units
  effectiveHeight: number // actual height when placed (mm)
}

export interface DrawerStats {
  totalCells: number
  usedCells: number
  availableCells: number
  volumeUtilization: number // percentage
  deadRoom: number         // mm (drawer height - tallest item)
  itemCount: number
  heightWarnings: number   // count of oversized items
  tallestItemHeight: number // mm
}

export const DEFAULT_CONFIG: GridfinityConfig = {
  cellSize: 42,
  heightUnit: 7,
  tolerance: 0.5,
  wallThickness: 1.2,
  displayUnit: 'mm',
  showDrawerCount: true,
  showCategoryCount: true,
  itemSizeDisplay: 'area',
  categoryExpansion: 'none',
  gridColorMode: 'category',
  showSidebarStats: true,
}

// Unit conversion utilities
export function toDisplayUnit(valueMm: number, unit: DimensionUnit): number {
  return unit === 'cm' ? valueMm / 10 : valueMm
}

export function fromDisplayUnit(value: number, unit: DimensionUnit): number {
  return unit === 'cm' ? value * 10 : value
}

export function formatDimension(valueMm: number, unit: DimensionUnit): string {
  const value = toDisplayUnit(valueMm, unit)
  return `${value}${unit}`
}

export const CURRENT_VERSION = 2

// Project management
export interface ProjectMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  drawerCount: number
  itemCount: number
}

export interface ProjectData {
  config: GridfinityConfig
  drawers: Drawer[]
  items: Item[]
  categories: Category[]
}

// Export/Import data structure
export interface ExportData {
  version: number
  projectId?: string    // absent in v1 exports
  name?: string         // absent in v1 exports
  exportDate: string
  drawerCount?: number
  itemCount?: number
  config: GridfinityConfig
  drawers: Drawer[]
  items: Item[]
  categories?: Category[]
}

export const ITEM_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
]
