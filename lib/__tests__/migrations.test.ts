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
    expect(nullTo1({}).version).toBe(1)
  })

  test('maps normal → h-up', () => {
    const result = nullTo1({ items: [{ ...baseItem, rotation: 'normal' }] })
    expect(result.items[0].rotation).toBe('h-up')
  })

  test('maps layDown → d-up', () => {
    const result = nullTo1({ items: [{ ...baseItem, rotation: 'layDown' }] })
    expect(result.items[0].rotation).toBe('d-up')
  })

  test('maps rotated → h-up-r', () => {
    const result = nullTo1({ items: [{ ...baseItem, rotation: 'rotated' }] })
    expect(result.items[0].rotation).toBe('h-up-r')
  })

  test('passes through current rotation values unchanged', () => {
    for (const rotation of ['h-up', 'h-up-r', 'd-up', 'd-up-r', 'w-up', 'w-up-r'] as const) {
      const result = nullTo1({ items: [{ ...baseItem, rotation }] })
      expect(result.items[0].rotation).toBe(rotation)
    }
  })

  test('defaults locked to false when missing', () => {
    const result = nullTo1({ items: [{ ...baseItem, rotation: 'h-up' }] })
    expect(result.items[0].locked).toBe(false)
  })

  test('preserves locked: true when present', () => {
    const result = nullTo1({ items: [{ ...baseItem, rotation: 'h-up', locked: true }] })
    expect(result.items[0].locked).toBe(true)
  })

  test('defaults categoryId to null when missing', () => {
    const result = nullTo1({ items: [{ ...baseItem, rotation: 'h-up' }] })
    expect(result.items[0].categoryId).toBeNull()
  })

  test('preserves categoryId when present', () => {
    const result = nullTo1({ items: [{ ...baseItem, rotation: 'h-up', categoryId: 'cat-1' }] })
    expect(result.items[0].categoryId).toBe('cat-1')
  })

  test('defaults categories to empty array when missing', () => {
    expect(nullTo1({}).categories).toEqual([])
  })

  test('defaults drawers to empty array when missing', () => {
    expect(nullTo1({}).drawers).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------

describe('migrate', () => {
  test('no version → runs null→1, sets version: 1', () => {
    const result = migrate({ items: [{ ...baseItem, rotation: 'normal' }], drawers: [], categories: [] })
    expect(result.version).toBe(1)
    expect((result.items as Item[])[0].rotation).toBe('h-up')
  })

  test('string version (e.g. "1.0") → treated as unknown, runs null→1', () => {
    const result = migrate({ version: '1.0', items: [{ ...baseItem, rotation: 'normal' }], drawers: [], categories: [] })
    expect(result.version).toBe(1)
    expect((result.items as Item[])[0].rotation).toBe('h-up')
  })

  test('version: 1 → passes through unchanged, no rotation remapping', () => {
    const items = [{ ...baseItem, rotation: 'h-up', locked: false, categoryId: null }]
    const result = migrate({ version: 1, items, drawers: [], categories: [] })
    expect(result.version).toBe(1)
    expect((result.items as Item[])[0].rotation).toBe('h-up')
  })

  test('version: 1 with already-current rotations are not double-mapped', () => {
    // 'normal' as a literal string in a v1 state should NOT be remapped (v1→v1 is a no-op)
    const items = [{ ...baseItem, rotation: 'h-up-r', locked: false, categoryId: null }]
    const result = migrate({ version: 1, items, drawers: [], categories: [] })
    expect((result.items as Item[])[0].rotation).toBe('h-up-r')
  })
})
