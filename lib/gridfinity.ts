// Gridfinity calculation utilities

import type { 
  GridfinityConfig, 
  Drawer, 
  Item, 
  ItemGridDimensions, 
  DrawerStats,
  ItemRotation 
} from './types'

/**
 * Calculate how many Gridfinity cells fit in a drawer dimension
 */
export function calculateGridCells(dimension: number, config: GridfinityConfig): number {
  const effectiveSpace = dimension - config.tolerance * 2
  return Math.floor(effectiveSpace / config.cellSize)
}

/**
 * Calculate drawer grid dimensions
 */
export function calculateDrawerGrid(
  width: number, 
  depth: number, 
  config: GridfinityConfig
): { gridCols: number; gridRows: number } {
  return {
    gridCols: calculateGridCells(width, config),
    gridRows: calculateGridCells(depth, config),
  }
}

/**
 * Get item dimensions based on rotation.
 * Each rotation picks which physical axis is vertical (the drawer-height axis)
 * and whether the footprint is transposed 90° on the grid.
 *
 * h-up / h-up-r : original Height is vertical — item stands upright
 * d-up / d-up-r : original Depth is vertical   — item lies flat (tipped forward)
 * w-up / w-up-r : original Width is vertical   — item lies on its side
 * The -r variants swap footprint W and D (90° rotation on the grid).
 */
export function getRotatedDimensions(
  item: Item,
  rotation: ItemRotation = item.rotation
): { width: number; depth: number; height: number } {
  switch (rotation) {
    case 'h-up':   return { width: item.width,  depth: item.depth,  height: item.height }
    case 'h-up-r': return { width: item.depth,  depth: item.width,  height: item.height }
    case 'd-up':   return { width: item.width,  depth: item.height, height: item.depth  }
    case 'd-up-r': return { width: item.height, depth: item.width,  height: item.depth  }
    case 'w-up':   return { width: item.depth,  depth: item.height, height: item.width  }
    case 'w-up-r': return { width: item.height, depth: item.depth,  height: item.width  }
  }
}

export const ALL_ROTATIONS: ItemRotation[] = ['h-up', 'h-up-r', 'd-up', 'd-up-r', 'w-up', 'w-up-r']

/**
 * Return only the distinct rotations for an item — i.e. those that produce
 * a unique (footprintW, footprintD, height) triple. For symmetric items some
 * orientations are physically identical and are filtered out.
 */
export function getDistinctRotations(item: Item): ItemRotation[] {
  const seen = new Set<string>()
  const result: ItemRotation[] = []
  for (const r of ALL_ROTATIONS) {
    const d = getRotatedDimensions(item, r)
    const key = `${d.width}|${d.depth}|${d.height}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(r)
    }
  }
  return result
}

const ROTATION_BASE_NAMES: Record<ItemRotation, string> = {
  'h-up':   'Upright',
  'h-up-r': 'Upright (rotated)',
  'd-up':   'Lay flat',
  'd-up-r': 'Lay flat (rotated)',
  'w-up':   'On side',
  'w-up-r': 'On side (rotated)',
}

/**
 * Human-readable label for a rotation, including computed footprint/height when dimensions are known.
 * e.g. "Lay flat (5×25, 5U tall)"
 */
export function getRotationLabel(rotation: ItemRotation, item: Item, config: GridfinityConfig): string {
  const base = ROTATION_BASE_NAMES[rotation]
  if (item.width <= 0 || item.height <= 0 || item.depth <= 0) {
    return base
  }
  const d = getRotatedDimensions(item, rotation)
  const cols = Math.ceil(d.width / config.cellSize)
  const rows = Math.ceil(d.depth / config.cellSize)
  const heightU = Math.ceil(d.height / config.heightUnit)
  return `${base} (${cols}×${rows}, ${heightU}U tall)`
}

/**
 * Build the rotation update patch when cycling from one rotation to the next.
 * Handles manual-mode col/row swap when the footprint axes transpose.
 */
export function applyNextRotation(item: Item): Partial<Item> {
  const distinct = getDistinctRotations(item)
  const currentDims = getRotatedDimensions(item)
  const currentKey = `${currentDims.width}|${currentDims.depth}|${currentDims.height}`
  let idx = distinct.findIndex(r => {
    const d = getRotatedDimensions(item, r)
    return `${d.width}|${d.depth}|${d.height}` === currentKey
  })
  if (idx === -1) {
    idx = 0
  }
  const next = distinct[(idx + 1) % distinct.length]

  const isManual = item.gridMode === 'manual'
  const newDims = getRotatedDimensions(item, next)
  const shouldSwap = isManual
    && currentDims.width === newDims.depth
    && currentDims.depth === newDims.width
    && currentDims.width !== currentDims.depth

  return {
    rotation: next,
    ...(shouldSwap && { manualGridCols: item.manualGridRows ?? 1, manualGridRows: item.manualGridCols ?? 1 }),
  }
}

/**
 * Calculate item's grid requirements.
 * In manual mode, returns the explicitly stored cols/rows.
 * In auto mode (default), derives from physical dimensions.
 */
export function calculateItemGridDimensions(
  item: Item,
  config: GridfinityConfig
): ItemGridDimensions {
  const dims = getRotatedDimensions(item)
  const heightUnits = dims.height > 0 ? Math.ceil(dims.height / config.heightUnit) : 0

  if (item.gridMode === 'manual') {
    return {
      gridWidth: Math.max(1, item.manualGridCols ?? 1),
      gridDepth: Math.max(1, item.manualGridRows ?? 1),
      heightUnits,
      effectiveHeight: dims.height,
    }
  }

  // Auto: derive from physical dimensions
  const gridWidth = Math.ceil(dims.width / config.cellSize)
  const gridDepth = Math.ceil(dims.depth / config.cellSize)

  return {
    gridWidth: Math.max(1, gridWidth),
    gridDepth: Math.max(1, gridDepth),
    heightUnits,
    effectiveHeight: dims.height,
  }
}

/**
 * Check if a manually-sized item's physical dimensions exceed its grid footprint.
 * Only relevant in manual mode with known dimensions.
 */
export function isItemFootprintOverflow(item: Item, config: GridfinityConfig): boolean {
  if (item.gridMode === 'auto') {
    return false
  }
  const rotated = getRotatedDimensions(item)
  if (rotated.width <= 0 || rotated.depth <= 0) {
    return false
  }
  return (
    rotated.width > (item.manualGridCols ?? 1) * config.cellSize ||
    rotated.depth > (item.manualGridRows ?? 1) * config.cellSize
  )
}

/**
 * Check if item exceeds drawer height
 */
export function isItemOversized(item: Item, drawer: Drawer): boolean {
  const dims = getRotatedDimensions(item)
  return dims.height > drawer.height
}

/**
 * Find the first available position in a drawer for an item (row-major scan).
 * Returns null if no position fits.
 */
export function findAvailablePosition(
  dims: { gridWidth: number; gridDepth: number },
  drawer: Drawer,
  existingItems: Item[],
  config: GridfinityConfig
): { gridX: number; gridY: number } | null {
  const occupied = new Set<string>()
  for (const other of existingItems) {
    if (other.drawerId !== drawer.id) {
      continue
    }
    const d = calculateItemGridDimensions(other, config)
    for (let x = other.gridX; x < other.gridX + d.gridWidth; x++) {
      for (let y = other.gridY; y < other.gridY + d.gridDepth; y++) {
        occupied.add(`${x},${y}`)
      }
    }
  }
  for (let y = 0; y <= drawer.gridRows - dims.gridDepth; y++) {
    for (let x = 0; x <= drawer.gridCols - dims.gridWidth; x++) {
      let fits = true
      outer: for (let dx = 0; dx < dims.gridWidth; dx++) {
        for (let dy = 0; dy < dims.gridDepth; dy++) {
          if (occupied.has(`${x + dx},${y + dy}`)) { fits = false; break outer }
        }
      }
      if (fits) {
        return { gridX: x, gridY: y }
      }
    }
  }
  return null
}

/**
 * Check if item placement is valid (within grid bounds)
 */
export function isValidPlacement(
  item: Item,
  drawer: Drawer,
  gridX: number,
  gridY: number,
  config: GridfinityConfig
): boolean {
  const dims = calculateItemGridDimensions(item, config)
  
  return (
    gridX >= 0 &&
    gridY >= 0 &&
    gridX + dims.gridWidth <= drawer.gridCols &&
    gridY + dims.gridDepth <= drawer.gridRows
  )
}

/**
 * Check if two items overlap
 */
export function checkOverlap(
  item1: Item,
  item2: Item,
  config: GridfinityConfig
): boolean {
  if (item1.drawerId !== item2.drawerId || !item1.drawerId) {
    return false
  }
  
  const dims1 = calculateItemGridDimensions(item1, config)
  const dims2 = calculateItemGridDimensions(item2, config)
  
  const rect1 = {
    left: item1.gridX,
    right: item1.gridX + dims1.gridWidth,
    top: item1.gridY,
    bottom: item1.gridY + dims1.gridDepth,
  }
  
  const rect2 = {
    left: item2.gridX,
    right: item2.gridX + dims2.gridWidth,
    top: item2.gridY,
    bottom: item2.gridY + dims2.gridDepth,
  }
  
  return !(
    rect1.right <= rect2.left ||
    rect1.left >= rect2.right ||
    rect1.bottom <= rect2.top ||
    rect1.top >= rect2.bottom
  )
}

/**
 * Find all items that overlap with a given item
 */
export function findOverlappingItems(
  item: Item,
  allItems: Item[],
  config: GridfinityConfig
): Item[] {
  return allItems.filter(
    other => other.id !== item.id && checkOverlap(item, other, config)
  )
}

/**
 * Calculate drawer statistics
 */
export function calculateDrawerStats(
  drawer: Drawer,
  items: Item[],
  config: GridfinityConfig
): DrawerStats {
  const drawerItems = items.filter(item => item.drawerId === drawer.id)
  const totalCells = drawer.gridCols * drawer.gridRows
  
  // Calculate used cells (accounting for overlaps)
  const cellOccupancy = new Set<string>()
  let totalItemVolume = 0
  let tallestItemHeight = 0
  let heightWarnings = 0
  
  for (const item of drawerItems) {
    const dims = calculateItemGridDimensions(item, config)
    const rotatedDims = getRotatedDimensions(item)
    
    // Mark cells as occupied
    for (let x = item.gridX; x < item.gridX + dims.gridWidth; x++) {
      for (let y = item.gridY; y < item.gridY + dims.gridDepth; y++) {
        cellOccupancy.add(`${x},${y}`)
      }
    }
    
    // Calculate volume
    totalItemVolume += rotatedDims.width * rotatedDims.height * rotatedDims.depth
    
    // Track tallest item
    if (rotatedDims.height > tallestItemHeight) {
      tallestItemHeight = rotatedDims.height
    }
    
    // Check for height warnings
    if (isItemOversized(item, drawer)) {
      heightWarnings++
    }
  }
  
  const usedCells = cellOccupancy.size
  const drawerVolume = drawer.width * drawer.height * drawer.depth
  const volumeUtilization = drawerVolume > 0 ? (totalItemVolume / drawerVolume) * 100 : 0
  const deadRoom = Math.max(0, drawer.height - tallestItemHeight)
  
  return {
    totalCells,
    usedCells,
    availableCells: totalCells - usedCells,
    volumeUtilization: Math.min(100, volumeUtilization),
    deadRoom,
    itemCount: drawerItems.length,
    heightWarnings,
    tallestItemHeight,
  }
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

