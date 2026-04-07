import { describe, test, expect } from 'bun:test'
import { migrate } from '@/lib/migrations'
import { nullTo1 } from '@/lib/migrations/null-to-1'
import type { Item } from '@/lib/types'

// baseItem uses legacy grid fields — migration converts them to mm-based fields
const baseItem = {
  id: 'item-1',
  name: 'Widget',
  width: 40,
  height: 20,
  depth: 30,
  drawerId: null,
  gridX: 0,
  gridY: 0,
  rotation: 'h-up',
}

// ---------------------------------------------------------------------------
// nullTo1
// ---------------------------------------------------------------------------

describe('nullTo1', () => {
  test('sets version to 1', () => {
    // Act
    const result = nullTo1({})

    // Assert
    expect(result.version).toBe(1)
  })

  test('maps normal → h-up', () => {
    // Arrange
    const input = { items: [{ ...baseItem, rotation: 'normal' }] }

    // Act
    const result = nullTo1(input)

    // Assert
    expect(result.items[0].rotation).toBe('h-up')
  })

  test('maps layDown → d-up', () => {
    // Arrange
    const input = { items: [{ ...baseItem, rotation: 'layDown' }] }

    // Act
    const result = nullTo1(input)

    // Assert
    expect(result.items[0].rotation).toBe('d-up')
  })

  test('maps rotated → h-up-r', () => {
    // Arrange
    const input = { items: [{ ...baseItem, rotation: 'rotated' }] }

    // Act
    const result = nullTo1(input)

    // Assert
    expect(result.items[0].rotation).toBe('h-up-r')
  })

  test('passes through current rotation values unchanged', () => {
    for (const rotation of ['h-up', 'h-up-r', 'd-up', 'd-up-r', 'w-up', 'w-up-r'] as const) {
      // Arrange
      const input = { items: [{ ...baseItem, rotation }] }

      // Act
      const result = nullTo1(input)

      // Assert
      expect(result.items[0].rotation).toBe(rotation)
    }
  })

  test('defaults locked to false when missing', () => {
    // Arrange
    const input = { items: [{ ...baseItem, rotation: 'h-up' }] }

    // Act
    const result = nullTo1(input)

    // Assert
    expect(result.items[0].locked).toBe(false)
  })

  test('preserves locked: true when present', () => {
    // Arrange
    const input = { items: [{ ...baseItem, rotation: 'h-up', locked: true }] }

    // Act
    const result = nullTo1(input)

    // Assert
    expect(result.items[0].locked).toBe(true)
  })

  test('defaults categoryId to null when missing', () => {
    // Arrange
    const input = { items: [{ ...baseItem, rotation: 'h-up' }] }

    // Act
    const result = nullTo1(input)

    // Assert
    expect(result.items[0].categoryId).toBeNull()
  })

  test('preserves categoryId when present', () => {
    // Arrange
    const input = { items: [{ ...baseItem, rotation: 'h-up', categoryId: 'cat-1' }] }

    // Act
    const result = nullTo1(input)

    // Assert
    expect(result.items[0].categoryId).toBe('cat-1')
  })

  test('defaults categories to empty array when missing', () => {
    // Act
    const result = nullTo1({})

    // Assert
    expect(result.categories).toEqual([])
  })

  test('defaults drawers to empty array when missing', () => {
    // Act
    const result = nullTo1({})

    // Assert
    expect(result.drawers).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------

describe('migrate', () => {
  test('no version → runs full chain, sets version: 5', () => {
    // Arrange
    const input = { items: [{ ...baseItem, rotation: 'normal' }], drawers: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(5)
    expect((result.items as Item[])[0].rotation).toBe('h-up')
    expect((result.items as Item[])[0].footprintMode).toBe('auto')
  })

  test('string version (e.g. "1.0") → treated as unknown, runs full chain', () => {
    // Arrange
    const input = { version: '1.0', items: [{ ...baseItem, rotation: 'normal' }], drawers: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(5)
    expect((result.items as Item[])[0].rotation).toBe('h-up')
    expect((result.items as Item[])[0].footprintMode).toBe('auto')
  })

  test('version: 1 → bumped to 5, backfills footprintMode: auto', () => {
    // Arrange
    const items = [{ ...baseItem, rotation: 'h-up', locked: false, categoryId: null }]
    const input = { version: 1, items, drawers: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(5)
    expect((result.items as Item[])[0].rotation).toBe('h-up')
    expect((result.items as Item[])[0].footprintMode).toBe('auto')
  })

  test('version: 1 with already-current rotations are not double-mapped', () => {
    // Arrange
    const items = [{ ...baseItem, rotation: 'h-up-r', locked: false, categoryId: null }]
    const input = { version: 1, items, drawers: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect((result.items as Item[])[0].rotation).toBe('h-up-r')
  })

  test('version: 2 → bumped to 5, adds cabinetX/cabinetY: 0 to drawers', () => {
    // Arrange
    const drawer = { id: 'd-1', name: 'Test', width: 300, height: 80, depth: 200, gridCols: 7, gridRows: 4 }
    const input = { version: 2, items: [], drawers: [drawer], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(5)
    const d = (result.drawers as Record<string, unknown>[])[0]
    expect(d.cabinetX).toBe(0)
    expect(d.cabinetY).toBe(0)
  })

  test('version: 2 → preserves existing cabinetX/cabinetY if already set', () => {
    // Arrange
    const drawer = { id: 'd-1', name: 'Test', width: 300, height: 80, depth: 200, gridCols: 7, gridRows: 4, cabinetX: 50, cabinetY: 100 }
    const input = { version: 2, drawers: [drawer], items: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    const d = (result.drawers as typeof drawer[])[0]
    expect(d.cabinetX).toBe(50)
    expect(d.cabinetY).toBe(100)
  })

  test('version: 2 → empty drawers array stays empty', () => {
    // Arrange
    const input = { version: 2, drawers: [], items: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(5)
    expect(result.drawers).toEqual([])
  })

  test('version: 3 → bumped to 5, converts gridX/Y to posX/Y in mm', () => {
    // Arrange
    // gridX=2 with cellSize=42 → posX=84, gridY=3 → posY=126
    const item = { id: 'i-1', name: 'Widget', width: 42, height: 42, depth: 42,
      drawerId: 'd-1', rotation: 'h-up', locked: false, categoryId: null,
      gridX: 2, gridY: 3, gridMode: 'auto' }
    const input = { version: 3, config: { cellSize: 42 }, drawers: [], items: [item], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(5)
    const migrated = (result.items as Item[])[0]
    expect(migrated.posX).toBe(84)
    expect(migrated.posY).toBe(126)
    expect(migrated.footprintMode).toBe('auto')
    expect((migrated as unknown as Record<string, unknown>).gridX).toBeUndefined()
    expect((migrated as unknown as Record<string, unknown>).gridMode).toBeUndefined()
  })

  test('version: 3 → converts manualGridCols/Rows to footprintW/H', () => {
    // Arrange
    const item = { id: 'i-1', name: 'Widget', width: 84, height: 42, depth: 42,
      drawerId: 'd-1', rotation: 'h-up', locked: false, categoryId: null,
      gridX: 0, gridY: 0, gridMode: 'manual', manualGridCols: 2, manualGridRows: 1 }
    const input = { version: 3, config: { cellSize: 42 }, drawers: [], items: [item], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    const migrated = (result.items as Item[])[0]
    expect(migrated.footprintMode).toBe('manual')
    expect(migrated.footprintW).toBe(84)
    expect(migrated.footprintH).toBe(42)
  })

  test('version: 3 → falls back to cellSize=42 if config missing', () => {
    // Arrange
    const item = { id: 'i-1', name: 'Widget', width: 42, height: 42, depth: 42,
      drawerId: null, rotation: 'h-up', locked: false, categoryId: null,
      gridX: 1, gridY: 0, gridMode: 'auto' }
    const input = { version: 3, drawers: [], items: [item], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect((result.items as Item[])[0].posX).toBe(42)
  })

  test('version: 4 → bumped to 5, backfills gridless: false on drawers', () => {
    // Arrange
    const drawer = { id: 'd-1', name: 'Test', width: 300, height: 80, depth: 200,
      gridCols: 7, gridRows: 4, cabinetX: 0, cabinetY: 0 }
    const input = { version: 4, drawers: [drawer], items: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(5)
    const d = (result.drawers as Record<string, unknown>[])[0]
    expect(d.gridless).toBe(false)
  })

  test('version: 4 → preserves existing gridless: true if already set', () => {
    // Arrange
    const drawer = { id: 'd-1', name: 'Test', width: 300, height: 80, depth: 200,
      gridCols: 7, gridRows: 4, cabinetX: 0, cabinetY: 0, gridless: true }
    const input = { version: 4, drawers: [drawer], items: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    const d = (result.drawers as Record<string, unknown>[])[0]
    expect(d.gridless).toBe(true)
  })

  test('version: 4 → item fields preserved through 4→5 migration', () => {
    // Arrange
    const item = { id: 'i-1', name: 'W', width: 42, height: 42, depth: 42,
      drawerId: null, rotation: 'h-up', locked: false, categoryId: null,
      posX: 84, posY: 126, footprintMode: 'auto' }
    const input = { version: 4, drawers: [], items: [item], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(5)
    expect((result.items as Item[])[0].posX).toBe(84)
    expect((result.items as Item[])[0].posY).toBe(126)
  })

  test('version: 5 → no changes applied', () => {
    // Arrange
    const input = { version: 5, drawers: [], items: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(5)
  })
})
