// Gridfinity Drawer Planner Types

export type DimensionUnit = 'mm' | 'cm'

export interface GridfinityConfig {
  cellSize: number       // Default: 42mm
  heightUnit: number     // Default: 7mm (1U)
  tolerance: number      // Default: 0.5mm
  wallThickness: number  // Default: 1.2mm
  displayUnit: DimensionUnit // Default: 'mm'
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

export type ItemRotation = 'normal' | 'layDown' | 'rotated'

export interface Item {
  id: string
  name: string
  width: number          // mm (0 = unknown, permitted in manual mode)
  height: number         // mm
  depth: number          // mm
  color: string          // for visualization
  rotation: ItemRotation
  drawerId: string | null
  gridX: number          // grid position
  gridY: number
  gridMode?: 'auto' | 'manual'   // default: 'auto'
  manualGridCols?: number         // explicit footprint cols (post-rotation), manual mode only
  manualGridRows?: number         // explicit footprint rows (post-rotation), manual mode only
  locked: boolean
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

export interface DragState {
  itemId: string | null
  sourceDrawerId: string | null
  targetDrawerId: string | null
  targetGridX: number
  targetGridY: number
  isDragging: boolean
}

// State management types
export type AppAction =
  | { type: 'ADD_DRAWER'; payload: Omit<Drawer, 'id' | 'gridCols' | 'gridRows'> }
  | { type: 'UPDATE_DRAWER'; payload: Drawer }
  | { type: 'DELETE_DRAWER'; payload: string }
  | { type: 'ADD_ITEM'; payload: Omit<Item, 'id'> }
  | { type: 'UPDATE_ITEM'; payload: Item }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'MOVE_ITEM'; payload: { itemId: string; drawerId: string | null; gridX: number; gridY: number } }
  | { type: 'UPDATE_CONFIG'; payload: Partial<GridfinityConfig> }
  | { type: 'SET_SELECTED_DRAWER'; payload: string | null }
  | { type: 'SET_SELECTED_ITEM'; payload: string | null }
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'DUPLICATE_DRAWER'; payload: string }
  | { type: 'DUPLICATE_ITEM'; payload: string }

export interface AppState {
  config: GridfinityConfig
  drawers: Drawer[]
  items: Item[]
  selectedDrawerId: string | null
  selectedItemId: string | null
}

export const DEFAULT_CONFIG: GridfinityConfig = {
  cellSize: 42,
  heightUnit: 7,
  tolerance: 0.5,
  wallThickness: 1.2,
  displayUnit: 'mm',
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

// Export/Import data structure
export interface ExportData {
  version: string
  exportDate: string
  config: GridfinityConfig
  drawers: Drawer[]
  items: Item[]
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
