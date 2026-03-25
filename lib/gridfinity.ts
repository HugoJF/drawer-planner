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
 * Get item dimensions based on rotation
 * - normal: Item stands upright (WxD footprint, H for height)
 * - layDown: Tall item lies flat (WxH footprint, D for height) 
 * - rotated: Swaps W and D (DxW footprint, H for height)
 */
export function getRotatedDimensions(
  item: Item, 
  rotation: ItemRotation = item.rotation
): { width: number; depth: number; height: number } {
  switch (rotation) {
    case 'normal':
      return { width: item.width, depth: item.depth, height: item.height }
    case 'layDown':
      return { width: item.width, depth: item.height, height: item.depth }
    case 'rotated':
      return { width: item.depth, depth: item.width, height: item.height }
  }
}

/**
 * Calculate item's grid requirements
 */
export function calculateItemGridDimensions(
  item: Item, 
  config: GridfinityConfig
): ItemGridDimensions {
  const dims = getRotatedDimensions(item)
  
  // Calculate grid cells needed (round up)
  const gridWidth = Math.ceil(dims.width / config.cellSize)
  const gridDepth = Math.ceil(dims.depth / config.cellSize)
  
  // Calculate height units
  const heightUnits = Math.ceil(dims.height / config.heightUnit)
  
  return {
    gridWidth: Math.max(1, gridWidth),
    gridDepth: Math.max(1, gridDepth),
    heightUnits,
    effectiveHeight: dims.height,
  }
}

/**
 * Check if item exceeds drawer height
 */
export function isItemOversized(item: Item, drawer: Drawer): boolean {
  const dims = getRotatedDimensions(item)
  return dims.height > drawer.height
}

/**
 * Find drawers where item would fit height-wise
 */
export function findSuitableDrawers(item: Item, drawers: Drawer[]): Drawer[] {
  const dims = getRotatedDimensions(item)
  return drawers.filter(drawer => drawer.height >= dims.height)
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
  if (item1.drawerId !== item2.drawerId || !item1.drawerId) return false
  
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

/**
 * Get suggested rotation for an item to fit drawer height
 */
export function getSuggestedRotation(
  item: Item,
  drawer: Drawer
): ItemRotation | null {
  const rotations: ItemRotation[] = ['normal', 'layDown', 'rotated']
  
  for (const rotation of rotations) {
    const dims = getRotatedDimensions({ ...item, rotation })
    if (dims.height <= drawer.height) {
      return rotation
    }
  }
  
  return null // No rotation works
}
