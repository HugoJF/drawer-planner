import { describe, test, expect, beforeEach } from 'bun:test'
import { createJSONStorage } from 'zustand/middleware'
import { createDrawerStore } from '../store'

// ---------------------------------------------------------------------------
// Noop storage — avoids localStorage dependency in Bun's test environment
// ---------------------------------------------------------------------------
const noopStorage = createJSONStorage(() => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}))

function freshStore() {
  return createDrawerStore(noopStorage)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// 253mm / 42mm cellSize (with 0.5mm tolerance on each side → 252mm effective)
// floor(252 / 42) = 6 → produces a 6x6 grid (36 cells)
const drawerPayload = { name: 'Drawer', width: 253, depth: 253, height: 75 }

type Store = ReturnType<typeof freshStore>

function addDrawerAndItem(store: Store, itemOverrides: Record<string, unknown> = {}) {
  store.getState().addDrawer(drawerPayload)
  const drawerId = store.getState().selectedDrawerId!
  store.getState().addItem({
    name: 'Screwdriver',
    width: 42,
    height: 50,
    depth: 42,
    categoryId: null,
    rotation: 'h-up',
    drawerId,
    gridX: 0,
    gridY: 0,
    gridMode: 'auto' as const,
    ...itemOverrides,
  })
  const itemId = store.getState().selectedItemIds.values().next().value!
  return { drawerId, itemId }
}

// ---------------------------------------------------------------------------
// addItem
// ---------------------------------------------------------------------------
describe('addItem', () => {
  let store: Store

  beforeEach(() => {
    store = freshStore()
  })

  test('appends item with a generated id', () => {
    // Act
    const { itemId } = addDrawerAndItem(store)

    // Assert
    const items = store.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe(itemId)
    expect(typeof itemId).toBe('string')
    expect(itemId.length).toBeGreaterThan(0)
  })

  test('sets selectedItemId to the new item id', () => {
    // Act
    const { itemId } = addDrawerAndItem(store)

    // Assert
    expect(store.getState().selectedItemIds.has(itemId)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// updateItem
// ---------------------------------------------------------------------------
describe('updateItem', () => {
  let store: Store

  beforeEach(() => {
    store = freshStore()
  })

  test('updates the item in place', () => {
    // Arrange
    const { itemId } = addDrawerAndItem(store)
    const original = store.getState().items.find((i) => i.id === itemId)!

    // Act
    store.getState().updateItem({ ...original, name: 'Hammer' })

    // Assert
    const updated = store.getState().items.find((i) => i.id === itemId)!
    expect(updated.name).toBe('Hammer')
  })

  test('does not affect other items', () => {
    // Arrange
    const { drawerId, itemId: id1 } = addDrawerAndItem(store)
    store.getState().addItem({
      name: 'Wrench',
      width: 42, height: 50, depth: 42,
      categoryId: null, rotation: 'h-up',
      drawerId, gridX: 1, gridY: 0, gridMode: 'auto' as const,
    })
    const id2 = store.getState().selectedItemIds.values().next().value!

    // Act
    const item1 = store.getState().items.find((i) => i.id === id1)!
    store.getState().updateItem({ ...item1, name: 'Hammer' })

    // Assert
    const item2After = store.getState().items.find((i) => i.id === id2)!
    expect(item2After.name).toBe('Wrench')
  })
})

// ---------------------------------------------------------------------------
// deleteItem
// ---------------------------------------------------------------------------
describe('deleteItem', () => {
  let store: Store

  beforeEach(() => {
    store = freshStore()
  })

  test('removes the item', () => {
    // Arrange
    const { itemId } = addDrawerAndItem(store)

    // Act
    store.getState().deleteItem(itemId)

    // Assert
    expect(store.getState().items.find((i) => i.id === itemId)).toBeUndefined()
  })

  test('clears selectedItemId when the deleted item was selected', () => {
    // Arrange
    const { itemId } = addDrawerAndItem(store)
    store.getState().selectItem(itemId)
    expect(store.getState().selectedItemIds.has(itemId)).toBe(true)

    // Act
    store.getState().deleteItem(itemId)

    // Assert
    expect(store.getState().selectedItemIds.size).toBe(0)
  })

  test('does NOT clear selectedItemId when a different item was selected', () => {
    // Arrange
    const { drawerId, itemId: id1 } = addDrawerAndItem(store)
    store.getState().addItem({
      name: 'Wrench',
      width: 42, height: 50, depth: 42,
      categoryId: null, rotation: 'h-up',
      drawerId, gridX: 1, gridY: 0, gridMode: 'auto' as const,
    })
    const id2 = store.getState().selectedItemIds.values().next().value!
    store.getState().selectItem(id2)

    // Act
    store.getState().deleteItem(id1)

    // Assert
    expect(store.getState().selectedItemIds.has(id2)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// moveItem
// ---------------------------------------------------------------------------
describe('moveItem', () => {
  let store: Store

  beforeEach(() => {
    store = freshStore()
  })

  test('updates drawerId, gridX, gridY on the item', () => {
    // Arrange
    const { drawerId, itemId } = addDrawerAndItem(store)

    // Act
    store.getState().moveItem(itemId, drawerId, 3, 4)

    // Assert
    const moved = store.getState().items.find((i) => i.id === itemId)!
    expect(moved.drawerId).toBe(drawerId)
    expect(moved.gridX).toBe(3)
    expect(moved.gridY).toBe(4)
  })

  test('does not affect other items', () => {
    // Arrange
    const { drawerId, itemId: id1 } = addDrawerAndItem(store)
    store.getState().addItem({
      name: 'Wrench',
      width: 42, height: 50, depth: 42,
      categoryId: null, rotation: 'h-up',
      drawerId, gridX: 1, gridY: 0, gridMode: 'auto' as const,
    })
    const id2 = store.getState().selectedItemIds.values().next().value!

    // Act
    store.getState().moveItem(id1, drawerId, 5, 5)

    // Assert
    const item2After = store.getState().items.find((i) => i.id === id2)!
    expect(item2After.gridX).toBe(1)
    expect(item2After.gridY).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// duplicateItem — placement
// ---------------------------------------------------------------------------
describe('duplicateItem', () => {
  let store: Store

  beforeEach(() => {
    store = freshStore()
  })

  test('places copy in first available position, not same cell as original', () => {
    // Arrange
    const { itemId } = addDrawerAndItem(store, { gridX: 0, gridY: 0 })

    // Act
    store.getState().duplicateItem(itemId)

    // Assert
    const copyId = store.getState().selectedItemIds.values().next().value!
    const copy = store.getState().items.find((i) => i.id === copyId)!
    expect(copy.gridX === 0 && copy.gridY === 0).toBe(false)
  })

  test('falls back to source position when drawer is completely full', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    const drawerId = store.getState().selectedDrawerId!
    const drawer = store.getState().drawers.find((d) => d.id === drawerId)!
    expect(drawer.gridCols).toBe(6)
    expect(drawer.gridRows).toBe(6)
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        store.getState().addItem({
          name: `Item-${col}-${row}`,
          width: 42, height: 50, depth: 42,
          categoryId: null, rotation: 'h-up',
          drawerId, gridX: col, gridY: row, gridMode: 'auto' as const,
        })
      }
    }
    expect(store.getState().items).toHaveLength(36)
    const src = store.getState().items.find(
      (i) => i.drawerId === drawerId && i.gridX === 0 && i.gridY === 0
    )!

    // Act
    store.getState().duplicateItem(src.id)

    // Assert
    const copyId = store.getState().selectedItemIds.values().next().value!
    const copy = store.getState().items.find((i) => i.id === copyId)!
    expect(copy.gridX).toBe(src.gridX)
    expect(copy.gridY).toBe(src.gridY)
  })

  test('unassigned item: copy lands at same gridX/gridY as source', () => {
    // Arrange
    store.getState().addItem({
      name: 'Floating',
      width: 42, height: 50, depth: 42,
      categoryId: null, rotation: 'h-up',
      drawerId: null, gridX: 2, gridY: 3, gridMode: 'auto' as const,
    })
    const srcId = store.getState().selectedItemIds.values().next().value!

    // Act
    store.getState().duplicateItem(srcId)

    // Assert
    const copyId = store.getState().selectedItemIds.values().next().value!
    const copy = store.getState().items.find((i) => i.id === copyId)!
    expect(copy.gridX).toBe(2)
    expect(copy.gridY).toBe(3)
  })

  test('duplicate has name "<original> (copy)"', () => {
    // Arrange
    const { itemId } = addDrawerAndItem(store)

    // Act
    store.getState().duplicateItem(itemId)

    // Assert
    const copyId = store.getState().selectedItemIds.values().next().value!
    const copy = store.getState().items.find((i) => i.id === copyId)!
    expect(copy.name).toBe('Screwdriver (copy)')
  })

  test('duplicate gets a new unique id', () => {
    // Arrange
    const { itemId } = addDrawerAndItem(store)

    // Act
    store.getState().duplicateItem(itemId)

    // Assert
    const copyId = store.getState().selectedItemIds.values().next().value!
    expect(copyId).not.toBe(itemId)
  })
})

// ---------------------------------------------------------------------------
// duplicateItem — return value
// ---------------------------------------------------------------------------
describe('duplicateItem — return value', () => {
  let store: Store

  beforeEach(() => {
    store = freshStore()
  })

  test('returns true when a free position is found', () => {
    // Arrange
    const { itemId } = addDrawerAndItem(store, { gridX: 0, gridY: 0 })

    // Act
    const result = store.getState().duplicateItem(itemId)

    // Assert
    expect(result).toBe(true)
  })

  test('returns false when the drawer is full (no free position)', () => {
    // Arrange
    // 1×1 drawer: Math.floor((43 - 1) / 42) = 1 col, 1 row
    store.getState().addDrawer({ name: 'Tiny', width: 43, depth: 43, height: 75 })
    const drawerId = store.getState().selectedDrawerId!
    const drawer = store.getState().drawers.find((d) => d.id === drawerId)!
    expect(drawer.gridCols).toBe(1)
    expect(drawer.gridRows).toBe(1)
    store.getState().addItem({
      name: 'Occupier',
      width: 42, height: 50, depth: 42,
      categoryId: null, rotation: 'h-up',
      drawerId, gridX: 0, gridY: 0, gridMode: 'auto' as const,
    })
    const itemId = store.getState().selectedItemIds.values().next().value!

    // Act
    const result = store.getState().duplicateItem(itemId)

    // Assert
    expect(result).toBe(false)
  })

  test('returns false when item is unassigned (no drawer to search)', () => {
    // Arrange
    store.getState().addItem({
      name: 'Floating',
      width: 42, height: 50, depth: 42,
      categoryId: null, rotation: 'h-up',
      drawerId: null, gridX: 0, gridY: 0, gridMode: 'auto' as const,
    })
    const itemId = store.getState().selectedItemIds.values().next().value!

    // Act
    const result = store.getState().duplicateItem(itemId)

    // Assert
    expect(result).toBe(false)
  })
})
