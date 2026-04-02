import { describe, test, expect } from 'bun:test'
import { migrate } from '@/lib/migrations'
import { nullTo1 } from '@/lib/migrations/null-to-1'
import type { Item } from '@/lib/types'

const baseItem = {
  id: 'item-1',
  name: 'Widget',
  width: 40,
  height: 20,
  depth: 30,
  drawerId: null,
  gridX: 0,
  gridY: 0,
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
  test('no version → runs null→1 then 1→2, sets version: 2', () => {
    // Arrange
    const input = { items: [{ ...baseItem, rotation: 'normal' }], drawers: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(2)
    expect((result.items as Item[])[0].rotation).toBe('h-up')
    expect((result.items as Item[])[0].gridMode).toBe('auto')
  })

  test('string version (e.g. "1.0") → treated as unknown, runs null→1 then 1→2', () => {
    // Arrange
    const input = { version: '1.0', items: [{ ...baseItem, rotation: 'normal' }], drawers: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(2)
    expect((result.items as Item[])[0].rotation).toBe('h-up')
    expect((result.items as Item[])[0].gridMode).toBe('auto')
  })

  test('version: 1 → bumped to 2, backfills gridMode: auto', () => {
    // Arrange
    const items = [{ ...baseItem, rotation: 'h-up', locked: false, categoryId: null }]
    const input = { version: 1, items, drawers: [], categories: [] }

    // Act
    const result = migrate(input)

    // Assert
    expect(result.version).toBe(2)
    expect((result.items as Item[])[0].rotation).toBe('h-up')
    expect((result.items as Item[])[0].gridMode).toBe('auto')
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
})
