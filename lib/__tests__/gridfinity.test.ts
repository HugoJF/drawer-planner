/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test'
import {
  calculateGridCells,
  calculateDrawerGrid,
  getRotatedDimensions,
  getDistinctRotations,
  applyNextRotation,
  calculateItemGridDimensions,
  isItemFootprintOverflow,
  isItemOversized,
  findAvailablePosition,
  isValidPlacement,
  checkOverlap,
  findOverlappingItems,
  calculateDrawerStats,
} from '@/lib/gridfinity'
import { DEFAULT_CONFIG, ItemRotation, FootprintMode } from '@/lib/types'
import type { Item, Drawer } from '@/lib/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: 'Widget',
    width: 42,
    height: 42,
    depth: 42,
    categoryId: null,
    rotation: ItemRotation.HeightUp,
    drawerId: 'drawer-1',
    posX: 0,
    posY: 0,
    footprintMode: FootprintMode.Auto,
    locked: false,
    ...overrides,
  }
}

// 7x7 grid: floor((300 - 0.5*2) / 42) = floor(299/42) = 7
function makeDrawer(overrides: Partial<Drawer> = {}): Drawer {
  return {
    id: 'drawer-1',
    name: 'Test Drawer',
    width: 300,
    depth: 300,
    height: 100,
    gridCols: 7,
    gridRows: 7,
    cabinetX: 0,
    cabinetY: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// calculateGridCells
// ---------------------------------------------------------------------------

describe('calculateGridCells', () => {
  test('returns correct cell count for standard dimension', () => {
    // Arrange
    const dimension = 300 // effectiveSpace = 300 - 1 = 299, floor(299/42) = 7

    // Act
    const result = calculateGridCells(dimension, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(7)
  })

  test('returns 1 when dimension fits exactly one cell', () => {
    // Arrange
    const dimension = 43 // effectiveSpace = 43 - 1 = 42, floor(42/42) = 1

    // Act
    const result = calculateGridCells(dimension, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(1)
  })

  test('returns 0 when dimension is too small for any cell', () => {
    // Arrange
    const dimension = 42 // effectiveSpace = 42 - 1 = 41, floor(41/42) = 0

    // Act
    const result = calculateGridCells(dimension, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// calculateDrawerGrid
// ---------------------------------------------------------------------------

describe('calculateDrawerGrid', () => {
  test('returns gridCols and gridRows for both axes', () => {
    // Act
    const result = calculateDrawerGrid(300, 300, DEFAULT_CONFIG)

    // Assert
    expect(result.gridCols).toBe(7)
    expect(result.gridRows).toBe(7)
  })

  test('handles different width and depth', () => {
    // Arrange
    // width=300 → 7 cols, depth=43 → floor((43-1)/42)=1 row
    const width = 300
    const depth = 43

    // Act
    const result = calculateDrawerGrid(width, depth, DEFAULT_CONFIG)

    // Assert
    expect(result.gridCols).toBe(7)
    expect(result.gridRows).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// getRotatedDimensions
// ---------------------------------------------------------------------------

describe('getRotatedDimensions', () => {
  // Use a non-cubic item with all-distinct dimensions for unambiguous rotation mapping
  // width=10, height=30, depth=20
  const item = makeItem({ width: 10, height: 30, depth: 20 })

  test('h-up: footprint is width×depth, height is vertical', () => {
    // Act
    const result = getRotatedDimensions(item, ItemRotation.HeightUp)

    // Assert
    expect(result).toEqual({ width: 10, depth: 20, height: 30 })
  })

  test('h-up-r: footprint transposes (depth×width), height is vertical', () => {
    // Act
    const result = getRotatedDimensions(item, ItemRotation.HeightUpR)

    // Assert
    expect(result).toEqual({ width: 20, depth: 10, height: 30 })
  })

  test('d-up: original depth becomes vertical, footprint is width×height', () => {
    // Act
    const result = getRotatedDimensions(item, ItemRotation.DepthUp)

    // Assert
    expect(result).toEqual({ width: 10, depth: 30, height: 20 })
  })

  test('d-up-r: footprint transposes relative to d-up', () => {
    // Act
    const result = getRotatedDimensions(item, ItemRotation.DepthUpR)

    // Assert
    expect(result).toEqual({ width: 30, depth: 10, height: 20 })
  })

  test('w-up: original width becomes vertical', () => {
    // Act
    const result = getRotatedDimensions(item, ItemRotation.WidthUp)

    // Assert
    expect(result).toEqual({ width: 20, depth: 30, height: 10 })
  })

  test('w-up-r: footprint transposes relative to w-up', () => {
    // Act
    const result = getRotatedDimensions(item, ItemRotation.WidthUpR)

    // Assert
    expect(result).toEqual({ width: 30, depth: 20, height: 10 })
  })
})

// ---------------------------------------------------------------------------
// getDistinctRotations
// ---------------------------------------------------------------------------

describe('getDistinctRotations', () => {
  test('cubic item has 1 distinct rotation', () => {
    // Arrange
    const item = makeItem({ width: 42, height: 42, depth: 42 })

    // Act
    const result = getDistinctRotations(item)

    // Assert
    expect(result).toHaveLength(1)
  })

  test('all-different dimensions yield 6 distinct rotations', () => {
    // Arrange
    const item = makeItem({ width: 10, height: 30, depth: 20 })

    // Act
    const result = getDistinctRotations(item)

    // Assert
    expect(result).toHaveLength(6)
  })

  test('square footprint (width === depth, different height) yields 3 distinct rotations', () => {
    // Arrange
    // width=42, height=84, depth=42
    // h-up and h-up-r produce same footprint → collapsed to 1
    // d-up and w-up produce same footprint, d-up-r and w-up-r produce same footprint → 3 total
    const item = makeItem({ width: 42, height: 84, depth: 42 })

    // Act
    const result = getDistinctRotations(item)

    // Assert
    expect(result).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// applyNextRotation
// ---------------------------------------------------------------------------

describe('applyNextRotation', () => {
  test('cycles from current rotation to next distinct rotation', () => {
    // Arrange
    // All-different dims → 6 rotations; h-up is first, so next is h-up-r
    const item = makeItem({ width: 84, height: 56, depth: 42, rotation: ItemRotation.HeightUp })

    // Act
    const patch = applyNextRotation(item)

    // Assert
    expect(patch.rotation).toBe(ItemRotation.HeightUpR)
  })

  test('wraps around from the last rotation back to the first', () => {
    // Arrange
    // Cubic item has only 1 distinct rotation — cycling stays at h-up
    const item = makeItem({ width: 42, height: 42, depth: 42, rotation: ItemRotation.HeightUp })

    // Act
    const patch = applyNextRotation(item)

    // Assert
    expect(patch.rotation).toBe(ItemRotation.HeightUp)
  })

  test('manual mode: swaps manualGridCols/Rows when footprint transposes', () => {
    // Arrange
    // h-up→h-up-r transposes the footprint: dims go from {84,42} to {42,84}
    const item = makeItem({
      width: 84, height: 56, depth: 42,
      rotation: ItemRotation.HeightUp,
      footprintMode: FootprintMode.Manual,
      footprintW: 84,
      footprintH: 42,
    })

    // Act
    const patch = applyNextRotation(item)

    // Assert
    expect(patch.rotation).toBe(ItemRotation.HeightUpR)
    expect(patch.footprintW).toBe(42)   // was footprintH (42), swapped
    expect(patch.footprintH).toBe(84)   // was footprintW (84), swapped
  })

  test('auto mode: does not include footprintW/H in patch', () => {
    // Arrange
    const item = makeItem({ width: 84, height: 56, depth: 42, rotation: ItemRotation.HeightUp, footprintMode: FootprintMode.Auto })

    // Act
    const patch = applyNextRotation(item)

    // Assert
    expect(patch.footprintW).toBeUndefined()
    expect(patch.footprintH).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// calculateItemGridDimensions
// ---------------------------------------------------------------------------

describe('calculateItemGridDimensions', () => {
  test('auto mode: derives cols and rows from physical dimensions', () => {
    // Arrange
    // width=84 → ceil(84/42)=2, depth=42 → ceil(42/42)=1
    const item = makeItem({ width: 84, depth: 42, height: 42, rotation: ItemRotation.HeightUp })

    // Act
    const result = calculateItemGridDimensions(item, DEFAULT_CONFIG)

    // Assert
    expect(result.gridWidth).toBe(2)
    expect(result.gridDepth).toBe(1)
  })

  test('auto mode: converts height to heightUnits', () => {
    // Arrange
    // height=42 → ceil(42/7)=6U
    const item = makeItem({ height: 42 })

    // Act
    const result = calculateItemGridDimensions(item, DEFAULT_CONFIG)

    // Assert
    expect(result.heightUnits).toBe(6)
  })

  test('manual mode: uses explicit footprintW/H (in mm) for grid dimensions', () => {
    // Arrange
    // footprintW=126mm → 3 cells (126/42=3), footprintH=84mm → 2 cells (84/42=2)
    const item = makeItem({
      width: 42, depth: 42,
      footprintMode: FootprintMode.Manual,
      footprintW: 126,
      footprintH: 84,
    })

    // Act
    const result = calculateItemGridDimensions(item, DEFAULT_CONFIG)

    // Assert
    expect(result.gridWidth).toBe(3)
    expect(result.gridDepth).toBe(2)
  })

  test('auto mode: minimum of 1 cell even for zero-dimension items', () => {
    // Arrange
    const item = makeItem({ width: 0, depth: 0, height: 0 })

    // Act
    const result = calculateItemGridDimensions(item, DEFAULT_CONFIG)

    // Assert
    expect(result.gridWidth).toBeGreaterThanOrEqual(1)
    expect(result.gridDepth).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// isItemFootprintOverflow
// ---------------------------------------------------------------------------

describe('isItemFootprintOverflow', () => {
  test('auto mode: always returns false', () => {
    // Arrange
    const item = makeItem({ width: 200, depth: 200, footprintMode: FootprintMode.Auto })

    // Act
    const result = isItemFootprintOverflow(item, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(false)
  })

  test('manual mode: returns false when physical dimensions fit within allocated cells', () => {
    // Arrange
    // width=84 fits in 2 cols (2×42=84), depth=42 fits in 1 row (1×42=42)
    const item = makeItem({
      width: 84, depth: 42,
      footprintMode: FootprintMode.Manual,
      footprintW: 84,
      footprintH: 42,
    })

    // Act
    const result = isItemFootprintOverflow(item, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(false)
  })

  test('manual mode: returns true when physical width exceeds allocated footprint', () => {
    // Arrange
    // width=84 does NOT fit in footprintW=42mm
    const item = makeItem({
      width: 84, depth: 42,
      footprintMode: FootprintMode.Manual,
      footprintW: 42,
      footprintH: 42,
    })

    // Act
    const result = isItemFootprintOverflow(item, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// isItemOversized
// ---------------------------------------------------------------------------

describe('isItemOversized', () => {
  test('returns true when item height exceeds drawer height', () => {
    // Arrange
    const drawer = makeDrawer({ height: 75 })
    const item = makeItem({ height: 100, rotation: ItemRotation.HeightUp })

    // Act
    const result = isItemOversized(item, drawer)

    // Assert
    expect(result).toBe(true)
  })

  test('returns false when item height fits within drawer height', () => {
    // Arrange
    const drawer = makeDrawer({ height: 75 })
    const item = makeItem({ height: 50, rotation: ItemRotation.HeightUp })

    // Act
    const result = isItemOversized(item, drawer)

    // Assert
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// findAvailablePosition
// ---------------------------------------------------------------------------

describe('findAvailablePosition', () => {
  test('returns (0, 0) when drawer is empty', () => {
    // Arrange
    const drawer = makeDrawer()

    // Act
    const result = findAvailablePosition({ gridWidth: 1, gridDepth: 1 }, drawer, [], DEFAULT_CONFIG)

    // Assert
    expect(result).toEqual({ posX: 0, posY: 0 })
  })

  test('skips occupied cells and returns next available position', () => {
    // Arrange
    const drawer = makeDrawer()
    const occupant = makeItem({ drawerId: drawer.id, posX: 0, posY: 0, width: 42, depth: 42 })

    // Act
    const result = findAvailablePosition({ gridWidth: 1, gridDepth: 1 }, drawer, [occupant], DEFAULT_CONFIG)

    // Assert
    expect(result).toEqual({ posX: 42, posY: 0 })
  })

  test('returns null when no position fits', () => {
    // Arrange
    // 1×1 drawer, fully occupied by a 1×1 item
    const drawer = makeDrawer({ gridCols: 1, gridRows: 1 })
    const occupant = makeItem({ drawerId: drawer.id, posX: 0, posY: 0, width: 42, depth: 42 })

    // Act
    const result = findAvailablePosition({ gridWidth: 1, gridDepth: 1 }, drawer, [occupant], DEFAULT_CONFIG)

    // Assert
    expect(result).toBeNull()
  })

  test('ignores items belonging to a different drawer', () => {
    // Arrange
    const drawer = makeDrawer({ id: 'drawer-1' })
    const foreignItem = makeItem({ drawerId: 'drawer-2', posX: 0, posY: 0 })

    // Act
    const result = findAvailablePosition({ gridWidth: 1, gridDepth: 1 }, drawer, [foreignItem], DEFAULT_CONFIG)

    // Assert
    // Foreign item is ignored, so position 0,0 is free
    expect(result).toEqual({ posX: 0, posY: 0 })
  })
})

// ---------------------------------------------------------------------------
// isValidPlacement
// ---------------------------------------------------------------------------

describe('isValidPlacement', () => {
  test('returns true when item fits within drawer bounds', () => {
    // Arrange
    const drawer = makeDrawer() // 7×7
    const item = makeItem({ width: 84, depth: 42 }) // 2×1 footprint

    // Act
    const result = isValidPlacement(item, drawer, 0, 0, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(true)
  })

  test('returns false when item extends beyond the right edge', () => {
    // Arrange
    const drawer = makeDrawer() // 7×7
    const item = makeItem({ width: 84, depth: 42 }) // 2×1 footprint

    // Act
    // posX=252mm (cell 6): 6 + 2 = 8 > 7 cols
    const result = isValidPlacement(item, drawer, 252, 0, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(false)
  })

  test('returns false for negative mm coordinates', () => {
    // Arrange
    const drawer = makeDrawer()
    const item = makeItem()

    // Act
    const result = isValidPlacement(item, drawer, -42, 0, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// checkOverlap
// ---------------------------------------------------------------------------

describe('checkOverlap', () => {
  test('returns true when two items occupy the same cell', () => {
    // Arrange
    const item1 = makeItem({ id: 'item-1', drawerId: 'drawer-1', posX: 0, posY: 0, width: 42, depth: 42 })
    const item2 = makeItem({ id: 'item-2', drawerId: 'drawer-1', posX: 0, posY: 0, width: 42, depth: 42 })

    // Act
    const result = checkOverlap(item1, item2, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(true)
  })

  test('returns false for adjacent (non-overlapping) items', () => {
    // Arrange
    const item1 = makeItem({ id: 'item-1', drawerId: 'drawer-1', posX: 0,  posY: 0, width: 42, depth: 42 })
    const item2 = makeItem({ id: 'item-2', drawerId: 'drawer-1', posX: 42, posY: 0, width: 42, depth: 42 })

    // Act
    const result = checkOverlap(item1, item2, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(false)
  })

  test('returns false when items are in different drawers', () => {
    // Arrange
    const item1 = makeItem({ id: 'item-1', drawerId: 'drawer-1', posX: 0, posY: 0 })
    const item2 = makeItem({ id: 'item-2', drawerId: 'drawer-2', posX: 0, posY: 0 })

    // Act
    const result = checkOverlap(item1, item2, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(false)
  })

  test('returns false when either item has no drawer assigned', () => {
    // Arrange
    const item1 = makeItem({ id: 'item-1', drawerId: null, posX: 0, posY: 0 })
    const item2 = makeItem({ id: 'item-2', drawerId: null, posX: 0, posY: 0 })

    // Act
    const result = checkOverlap(item1, item2, DEFAULT_CONFIG)

    // Assert
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// findOverlappingItems
// ---------------------------------------------------------------------------

describe('findOverlappingItems', () => {
  test('returns items that overlap with the target', () => {
    // Arrange
    const target     = makeItem({ id: 'target',     drawerId: 'drawer-1', posX: 0,  posY: 0, width: 42, depth: 42 })
    const overlapping = makeItem({ id: 'overlapping', drawerId: 'drawer-1', posX: 0,  posY: 0, width: 42, depth: 42 })
    const separate   = makeItem({ id: 'separate',   drawerId: 'drawer-1', posX: 84, posY: 0, width: 42, depth: 42 })

    // Act
    const result = findOverlappingItems(target, [target, overlapping, separate], DEFAULT_CONFIG)

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('overlapping')
  })

  test('excludes the target item itself from results', () => {
    // Arrange
    const target = makeItem({ id: 'target', drawerId: 'drawer-1', posX: 0, posY: 0 })

    // Act
    const result = findOverlappingItems(target, [target], DEFAULT_CONFIG)

    // Assert
    expect(result).toHaveLength(0)
  })

  test('returns empty array when nothing overlaps', () => {
    // Arrange
    const target   = makeItem({ id: 'target',   drawerId: 'drawer-1', posX: 0,   posY: 0,   width: 42, depth: 42 })
    const separate = makeItem({ id: 'separate', drawerId: 'drawer-1', posX: 126, posY: 126, width: 42, depth: 42 })

    // Act
    const result = findOverlappingItems(target, [target, separate], DEFAULT_CONFIG)

    // Assert
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// calculateDrawerStats
// ---------------------------------------------------------------------------

describe('calculateDrawerStats', () => {
  test('empty drawer has zeroed stats', () => {
    // Arrange
    const drawer = makeDrawer() // 7×7 = 49 cells

    // Act
    const stats = calculateDrawerStats(drawer, [], DEFAULT_CONFIG)

    // Assert
    expect(stats.totalCells).toBe(49)
    expect(stats.usedCells).toBe(0)
    expect(stats.availableCells).toBe(49)
    expect(stats.itemCount).toBe(0)
    expect(stats.heightWarnings).toBe(0)
    expect(stats.tallestItemHeight).toBe(0)
    expect(stats.volumeUtilization).toBe(0)
  })

  test('accounts for item footprint in usedCells', () => {
    // Arrange
    const drawer = makeDrawer()
    // 2×1 footprint item
    const item = makeItem({ drawerId: drawer.id, width: 84, depth: 42, height: 42 })

    // Act
    const stats = calculateDrawerStats(drawer, [item], DEFAULT_CONFIG)

    // Assert
    expect(stats.usedCells).toBe(2)
    expect(stats.availableCells).toBe(47)
    expect(stats.itemCount).toBe(1)
  })

  test('counts height warnings for items taller than the drawer', () => {
    // Arrange
    const drawer = makeDrawer({ height: 75 })
    const oversized = makeItem({ drawerId: drawer.id, height: 100 })
    const fits = makeItem({ id: 'item-2', drawerId: drawer.id, posX: 42, height: 50 })

    // Act
    const stats = calculateDrawerStats(drawer, [oversized, fits], DEFAULT_CONFIG)

    // Assert
    expect(stats.heightWarnings).toBe(1)
  })

  test('deadRoom is drawer height minus tallest item height', () => {
    // Arrange
    const drawer = makeDrawer({ height: 100 })
    const item = makeItem({ drawerId: drawer.id, height: 60 })

    // Act
    const stats = calculateDrawerStats(drawer, [item], DEFAULT_CONFIG)

    // Assert
    expect(stats.tallestItemHeight).toBe(60)
    expect(stats.deadRoom).toBe(40)
  })
})
