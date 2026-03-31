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
    const { itemId } = addDrawerAndItem(store)
    const items = store.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe(itemId)
    expect(typeof itemId).toBe('string')
    expect(itemId.length).toBeGreaterThan(0)
  })

  test('sets selectedItemId to the new item id', () => {
    const { itemId } = addDrawerAndItem(store)
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
    const { itemId } = addDrawerAndItem(store)
    const original = store.getState().items.find((i) => i.id === itemId)!
    store.getState().updateItem({ ...original, name: 'Hammer' })
    const updated = store.getState().items.find((i) => i.id === itemId)!
    expect(updated.name).toBe('Hammer')
  })

  test('does not affect other items', () => {
    const { drawerId, itemId: id1 } = addDrawerAndItem(store)

    // Add a second item
    store.getState().addItem({
      name: 'Wrench',
      width: 42,
      height: 50,
      depth: 42,
      categoryId: null,
      rotation: 'h-up',
      drawerId,
      gridX: 1,
      gridY: 0,
    })
    const id2 = store.getState().selectedItemIds.values().next().value!

    // Update the first item
    const item1 = store.getState().items.find((i) => i.id === id1)!
    store.getState().updateItem({ ...item1, name: 'Hammer' })

    // Second item should be unchanged
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
    const { itemId } = addDrawerAndItem(store)
    store.getState().deleteItem(itemId)
    expect(store.getState().items.find((i) => i.id === itemId)).toBeUndefined()
  })

  test('clears selectedItemId when the deleted item was selected', () => {
    const { itemId } = addDrawerAndItem(store)
    // Ensure it is selected
    store.getState().selectItem(itemId)
    expect(store.getState().selectedItemIds.has(itemId)).toBe(true)
    store.getState().deleteItem(itemId)
    expect(store.getState().selectedItemIds.size).toBe(0)
  })

  test('does NOT clear selectedItemId when a different item was selected', () => {
    const { drawerId, itemId: id1 } = addDrawerAndItem(store)

    // Add second item and select it
    store.getState().addItem({
      name: 'Wrench',
      width: 42,
      height: 50,
      depth: 42,
      categoryId: null,
      rotation: 'h-up',
      drawerId,
      gridX: 1,
      gridY: 0,
    })
    const id2 = store.getState().selectedItemIds.values().next().value!
    store.getState().selectItem(id2)

    // Delete the first item while second is selected
    store.getState().deleteItem(id1)

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
    const { drawerId, itemId } = addDrawerAndItem(store)
    store.getState().moveItem(itemId, drawerId, 3, 4)
    const moved = store.getState().items.find((i) => i.id === itemId)!
    expect(moved.drawerId).toBe(drawerId)
    expect(moved.gridX).toBe(3)
    expect(moved.gridY).toBe(4)
  })

  test('does not affect other items', () => {
    const { drawerId, itemId: id1 } = addDrawerAndItem(store)

    store.getState().addItem({
      name: 'Wrench',
      width: 42,
      height: 50,
      depth: 42,
      categoryId: null,
      rotation: 'h-up',
      drawerId,
      gridX: 1,
      gridY: 0,
    })
    const id2 = store.getState().selectedItemIds.values().next().value!

    // Move first item
    store.getState().moveItem(id1, drawerId, 5, 5)

    // Second item should be at its original position
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
    // Original at (0,0) — next available cell should be (1,0)
    const { itemId } = addDrawerAndItem(store, { gridX: 0, gridY: 0 })
    store.getState().duplicateItem(itemId)
    const copyId = store.getState().selectedItemIds.values().next().value!
    const copy = store.getState().items.find((i) => i.id === copyId)!
    // Should NOT be at (0,0)
    expect(copy.gridX === 0 && copy.gridY === 0).toBe(false)
  })

  test('falls back to source position when drawer is completely full', () => {
    // Fill all 36 cells of a 6x6 grid with 1x1 items (42x42mm footprint)
    store.getState().addDrawer(drawerPayload)
    const drawerId = store.getState().selectedDrawerId!

    // Verify grid size
    const drawer = store.getState().drawers.find((d) => d.id === drawerId)!
    expect(drawer.gridCols).toBe(6)
    expect(drawer.gridRows).toBe(6)

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        store.getState().addItem({
          name: `Item-${col}-${row}`,
          width: 42,
          height: 50,
          depth: 42,
          categoryId: null,
          rotation: 'h-up',
          drawerId,
          gridX: col,
          gridY: row,
        })
      }
    }

    expect(store.getState().items).toHaveLength(36)

    // Pick the item at (0,0) to duplicate
    const src = store.getState().items.find(
      (i) => i.drawerId === drawerId && i.gridX === 0 && i.gridY === 0
    )!

    store.getState().duplicateItem(src.id)
    const copyId = store.getState().selectedItemIds.values().next().value!
    const copy = store.getState().items.find((i) => i.id === copyId)!

    // No free space — copy must land on source position
    expect(copy.gridX).toBe(src.gridX)
    expect(copy.gridY).toBe(src.gridY)
  })

  test('unassigned item: copy lands at same gridX/gridY as source', () => {
    // Add an unassigned item (drawerId: null)
    store.getState().addItem({
      name: 'Floating',
      width: 42,
      height: 50,
      depth: 42,
      categoryId: null,
      rotation: 'h-up',
      drawerId: null,
      gridX: 2,
      gridY: 3,
    })
    const srcId = store.getState().selectedItemIds.values().next().value!
    store.getState().duplicateItem(srcId)
    const copyId = store.getState().selectedItemIds.values().next().value!
    const copy = store.getState().items.find((i) => i.id === copyId)!
    expect(copy.gridX).toBe(2)
    expect(copy.gridY).toBe(3)
  })

  test('duplicate has name "<original> (copy)"', () => {
    const { itemId } = addDrawerAndItem(store)
    store.getState().duplicateItem(itemId)
    const copyId = store.getState().selectedItemIds.values().next().value!
    const copy = store.getState().items.find((i) => i.id === copyId)!
    expect(copy.name).toBe('Screwdriver (copy)')
  })

  test('duplicate gets a new unique id', () => {
    const { itemId } = addDrawerAndItem(store)
    store.getState().duplicateItem(itemId)
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
    // 6x6 drawer with one item at (0,0) — plenty of free space
    const { itemId } = addDrawerAndItem(store, { gridX: 0, gridY: 0 })
    const result = store.getState().duplicateItem(itemId)
    expect(result).toBe(true)
  })

  test('returns false when the drawer is full (no free position)', () => {
    // Create a 1x1 drawer: Math.floor((43 - 1) / 42) = 1 col, 1 row
    store.getState().addDrawer({ name: 'Tiny', width: 43, depth: 43, height: 75 })
    const drawerId = store.getState().selectedDrawerId!

    const drawer = store.getState().drawers.find((d) => d.id === drawerId)!
    expect(drawer.gridCols).toBe(1)
    expect(drawer.gridRows).toBe(1)

    // Place the only possible 1x1 item
    store.getState().addItem({
      name: 'Occupier',
      width: 42,
      height: 50,
      depth: 42,
      categoryId: null,
      rotation: 'h-up',
      drawerId,
      gridX: 0,
      gridY: 0,
    })
    const itemId = store.getState().selectedItemIds.values().next().value!

    // Drawer is full — no free cell for a duplicate
    const result = store.getState().duplicateItem(itemId)
    expect(result).toBe(false)
  })

  test('returns false when item is unassigned (no drawer to search)', () => {
    store.getState().addItem({
      name: 'Floating',
      width: 42,
      height: 50,
      depth: 42,
      categoryId: null,
      rotation: 'h-up',
      drawerId: null,
      gridX: 0,
      gridY: 0,
    })
    const itemId = store.getState().selectedItemIds.values().next().value!

    // No drawer → findAvailablePosition is never called → returns false
    const result = store.getState().duplicateItem(itemId)
    expect(result).toBe(false)
  })
})
