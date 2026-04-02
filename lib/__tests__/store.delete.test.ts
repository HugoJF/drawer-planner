/// <reference types="bun-types" />
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

type Store = ReturnType<typeof freshStore>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// 253mm → Math.floor((253 - 1) / 42) = Math.floor(252 / 42) = 6 → 6x6 grid
const drawerPayload = { name: 'Drawer', width: 253, depth: 253, height: 75 }

function addDrawerWithItem(store: Store, itemOverrides: Record<string, unknown> = {}) {
  store.getState().addDrawer(drawerPayload)
  const drawerId = store.getState().selectedDrawerId!
  store.getState().addItem({
    name: 'Widget',
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
// deleteDrawer — without deleteContents
// ---------------------------------------------------------------------------

describe('deleteDrawer (deleteContents = false)', () => {
  let store: Store

  beforeEach(() => {
    store = freshStore()
  })

  test('items in the deleted drawer become unassigned (drawerId null)', () => {
    // Arrange
    const { drawerId, itemId } = addDrawerWithItem(store, { gridX: 2, gridY: 3 })

    // Act
    store.getState().deleteDrawer(drawerId)

    // Assert
    const item = store.getState().items.find((i) => i.id === itemId)!
    expect(item).toBeDefined()
    expect(item.drawerId).toBeNull()
  })

  test('items in the deleted drawer have gridX and gridY reset to 0', () => {
    // Arrange
    const { drawerId, itemId } = addDrawerWithItem(store, { gridX: 2, gridY: 3 })

    // Act
    store.getState().deleteDrawer(drawerId)

    // Assert
    const item = store.getState().items.find((i) => i.id === itemId)!
    expect(item.gridX).toBe(0)
    expect(item.gridY).toBe(0)
  })

  test('items are NOT removed from the items array', () => {
    // Arrange
    const { drawerId } = addDrawerWithItem(store)

    // Act
    store.getState().deleteDrawer(drawerId)

    // Assert
    expect(store.getState().items).toHaveLength(1)
  })

  test('clears selectedDrawerId when the deleted drawer was selected', () => {
    // Arrange
    const { drawerId } = addDrawerWithItem(store)
    expect(store.getState().selectedDrawerId).toBe(drawerId)

    // Act
    store.getState().deleteDrawer(drawerId)

    // Assert
    expect(store.getState().selectedDrawerId).toBeNull()
  })

  test('does NOT clear selectedDrawerId when a different drawer is selected', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    const firstId = store.getState().drawers[0].id
    store.getState().addDrawer({ ...drawerPayload, name: 'Second' })
    const secondId = store.getState().drawers[1].id
    store.getState().selectDrawer(firstId)

    // Act
    store.getState().deleteDrawer(secondId)

    // Assert
    expect(store.getState().selectedDrawerId).toBe(firstId)
  })
})

// ---------------------------------------------------------------------------
// deleteDrawer — with deleteContents = true
// ---------------------------------------------------------------------------

describe('deleteDrawer (deleteContents = true)', () => {
  let store: Store

  beforeEach(() => {
    store = freshStore()
  })

  test('items in the deleted drawer are removed entirely', () => {
    // Arrange
    const { drawerId, itemId } = addDrawerWithItem(store)

    // Act
    store.getState().deleteDrawer(drawerId, true)

    // Assert
    expect(store.getState().items.find((i) => i.id === itemId)).toBeUndefined()
    expect(store.getState().items).toHaveLength(0)
  })

  test('items in other drawers are NOT removed', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    const firstId = store.getState().drawers[0].id
    store.getState().addDrawer({ ...drawerPayload, name: 'Second' })
    const secondId = store.getState().drawers[1].id
    store.getState().addItem({
      name: 'In First',
      width: 42, height: 50, depth: 42,
      categoryId: null, rotation: 'h-up',
      drawerId: firstId, gridX: 0, gridY: 0, gridMode: 'auto' as const,
    })
    store.getState().addItem({
      name: 'In Second',
      width: 42, height: 50, depth: 42,
      categoryId: null, rotation: 'h-up',
      drawerId: secondId, gridX: 0, gridY: 0, gridMode: 'auto' as const,
    })
    const secondItemId = store.getState().selectedItemIds.values().next().value!

    // Act
    store.getState().deleteDrawer(firstId, true)

    // Assert
    const surviving = store.getState().items.find((i) => i.id === secondItemId)
    expect(surviving).toBeDefined()
    expect(surviving!.drawerId).toBe(secondId)
  })

  test('clears selectedDrawerId when the deleted drawer was selected', () => {
    // Arrange
    const { drawerId } = addDrawerWithItem(store)
    expect(store.getState().selectedDrawerId).toBe(drawerId)

    // Act
    store.getState().deleteDrawer(drawerId, true)

    // Assert
    expect(store.getState().selectedDrawerId).toBeNull()
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

  test('removes the item from the items array', () => {
    // Arrange
    const { itemId } = addDrawerWithItem(store)

    // Act
    store.getState().deleteItem(itemId)

    // Assert
    expect(store.getState().items.find((i) => i.id === itemId)).toBeUndefined()
  })

  test('clears selectedItemId when the deleted item was selected', () => {
    // Arrange
    const { itemId } = addDrawerWithItem(store)
    store.getState().selectItem(itemId)
    expect(store.getState().selectedItemIds.has(itemId)).toBe(true)

    // Act
    store.getState().deleteItem(itemId)

    // Assert
    expect(store.getState().selectedItemIds.size).toBe(0)
  })

  test('does NOT clear selectedItemId when a different item is selected', () => {
    // Arrange
    const { drawerId, itemId: id1 } = addDrawerWithItem(store)
    store.getState().addItem({
      name: 'Second',
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
