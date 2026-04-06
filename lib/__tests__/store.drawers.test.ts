/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test'
import { createJSONStorage } from 'zustand/middleware'
import { createDrawerStore } from '../store'
import type { Item } from '../types'

// ---------------------------------------------------------------------------
// Noop storage — no localStorage needed in Bun's test environment
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
// Shared fixtures
// ---------------------------------------------------------------------------
const drawerPayload = { name: 'Test', width: 280, depth: 280, height: 75 }

// A minimal valid item payload (not yet assigned to a drawer)
function itemPayload(overrides?: Partial<Omit<Item, 'id'>>): Omit<Item, 'id'> {
  return {
    name: 'Widget',
    width: 42,
    height: 42,
    depth: 42,
    categoryId: null,
    rotation: 'h-up',
    drawerId: null,
    posX: 0,
    posY: 0,
    footprintMode: 'auto' as const,
    locked: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// addDrawer
// ---------------------------------------------------------------------------
describe('addDrawer', () => {
  test('appends the drawer to drawers', () => {
    // Arrange
    const store = freshStore()

    // Act
    store.getState().addDrawer(drawerPayload)

    // Assert
    expect(store.getState().drawers).toHaveLength(1)
    expect(store.getState().drawers[0].name).toBe('Test')
  })

  test('computes gridCols and gridRows from dimensions (280mm / 42mm cellSize ≈ 6)', () => {
    // Arrange
    const store = freshStore()

    // Act
    store.getState().addDrawer(drawerPayload)

    // Assert
    const drawer = store.getState().drawers[0]
    // Math.floor((280 - 0.5 * 2) / 42) = Math.floor(279 / 42) = 6
    expect(drawer.gridCols).toBe(6)
    expect(drawer.gridRows).toBe(6)
  })

  test('sets selectedDrawerId to the new drawer id', () => {
    // Arrange
    const store = freshStore()

    // Act
    store.getState().addDrawer(drawerPayload)

    // Assert
    const drawer = store.getState().drawers[0]
    expect(store.getState().selectedDrawerId).toBe(drawer.id)
  })
})

// ---------------------------------------------------------------------------
// updateDrawer
// ---------------------------------------------------------------------------
describe('updateDrawer', () => {
  test('updates name on the existing drawer', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const original = store.getState().drawers[0]

    // Act
    store.getState().updateDrawer({ ...original, name: 'Renamed' })

    // Assert
    expect(store.getState().drawers[0].name).toBe('Renamed')
  })

  test('recomputes gridCols and gridRows when dimensions change', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const original = store.getState().drawers[0]

    // Act
    // 126mm → Math.floor((126 - 1) / 42) = Math.floor(125 / 42) = 2
    store.getState().updateDrawer({ ...original, width: 126, depth: 126 })

    // Assert
    const updated = store.getState().drawers[0]
    expect(updated.gridCols).toBe(2)
    expect(updated.gridRows).toBe(2)
  })

  test('does not affect other drawers', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    store.getState().addDrawer({ ...drawerPayload, name: 'Other' })
    const [first, second] = store.getState().drawers

    // Act
    store.getState().updateDrawer({ ...first, name: 'Updated' })

    // Assert
    expect(store.getState().drawers[1].id).toBe(second.id)
    expect(store.getState().drawers[1].name).toBe('Other')
  })
})

// ---------------------------------------------------------------------------
// deleteDrawer
// ---------------------------------------------------------------------------
describe('deleteDrawer', () => {
  test('removes the drawer from drawers', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const { id } = store.getState().drawers[0]

    // Act
    store.getState().deleteDrawer(id)

    // Assert
    expect(store.getState().drawers).toHaveLength(0)
  })

  test('items that were in the deleted drawer get drawerId null, posX 0, posY 0', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const drawerId = store.getState().drawers[0].id
    store.getState().addItem(itemPayload({ drawerId, posX: 84, posY: 126 }))
    const itemId = store.getState().items[0].id

    // Act
    store.getState().deleteDrawer(drawerId)

    // Assert
    const item = store.getState().items.find((i) => i.id === itemId)!
    expect(item.drawerId).toBeNull()
    expect(item.posX).toBe(0)
    expect(item.posY).toBe(0)
  })

  test('items in other drawers are unaffected', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    store.getState().addDrawer({ ...drawerPayload, name: 'Other' })
    const [deletedDrawer, otherDrawer] = store.getState().drawers
    store.getState().addItem(itemPayload({ drawerId: otherDrawer.id, posX: 42, posY: 42 }))
    const itemId = store.getState().items[0].id

    // Act
    store.getState().deleteDrawer(deletedDrawer.id)

    // Assert
    const item = store.getState().items.find((i) => i.id === itemId)!
    expect(item.drawerId).toBe(otherDrawer.id)
    expect(item.posX).toBe(42)
    expect(item.posY).toBe(42)
  })

  test('clears selectedDrawerId when the deleted drawer was selected', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const { id } = store.getState().drawers[0]
    expect(store.getState().selectedDrawerId).toBe(id)

    // Act
    store.getState().deleteDrawer(id)

    // Assert
    expect(store.getState().selectedDrawerId).toBeNull()
  })

  test('does NOT clear selectedDrawerId when a different drawer was selected', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    store.getState().addDrawer({ ...drawerPayload, name: 'Second' })
    const [first, second] = store.getState().drawers
    expect(store.getState().selectedDrawerId).toBe(second.id)

    // Act
    store.getState().deleteDrawer(first.id)

    // Assert
    expect(store.getState().selectedDrawerId).toBe(second.id)
  })
})

// ---------------------------------------------------------------------------
// duplicateDrawer
// ---------------------------------------------------------------------------
describe('duplicateDrawer', () => {
  test('creates a new drawer with name "<original> (copy)"', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const { id } = store.getState().drawers[0]

    // Act
    store.getState().duplicateDrawer(id)

    // Assert
    expect(store.getState().drawers).toHaveLength(2)
    expect(store.getState().drawers[1].name).toBe('Test (copy)')
  })

  test('new drawer has a different id from the original', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const { id: originalId } = store.getState().drawers[0]

    // Act
    store.getState().duplicateDrawer(originalId)

    // Assert
    expect(store.getState().drawers[1].id).not.toBe(originalId)
  })

  test('copies all items assigned to the source drawer with new ids pointing to new drawer', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const drawerId = store.getState().drawers[0].id
    store.getState().addItem(itemPayload({ name: 'Alpha', drawerId, posX: 0,  posY: 0  }))
    store.getState().addItem(itemPayload({ name: 'Beta',  drawerId, posX: 42, posY: 42 }))
    const originalItemIds = store.getState().items.map((i) => i.id)

    // Act
    store.getState().duplicateDrawer(drawerId)

    // Assert
    const newDrawerId = store.getState().drawers[1].id
    const copiedItems = store.getState().items.filter((i) => i.drawerId === newDrawerId)
    expect(copiedItems).toHaveLength(2)
    for (const item of copiedItems) {
      expect(originalItemIds).not.toContain(item.id)
    }
    expect(copiedItems.map((i) => i.name).sort()).toEqual(['Alpha', 'Beta'])
  })

  test('does NOT copy items from other drawers', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    store.getState().addDrawer({ ...drawerPayload, name: 'Other' })
    const [sourceDrawer, otherDrawer] = store.getState().drawers
    store.getState().addItem(itemPayload({ name: 'Mine', drawerId: sourceDrawer.id }))
    store.getState().addItem(itemPayload({ name: 'NotMine', drawerId: otherDrawer.id }))

    // Act
    store.getState().duplicateDrawer(sourceDrawer.id)

    // Assert
    const newDrawerId = store.getState().drawers.find(
      (d) => d.id !== sourceDrawer.id && d.id !== otherDrawer.id
    )!.id
    const copiedItems = store.getState().items.filter((i) => i.drawerId === newDrawerId)
    expect(copiedItems).toHaveLength(1)
    expect(copiedItems[0].name).toBe('Mine')
  })

  test('sets selectedDrawerId to the new drawer id', () => {
    // Arrange
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const { id: originalId } = store.getState().drawers[0]

    // Act
    store.getState().duplicateDrawer(originalId)

    // Assert
    const newDrawer = store.getState().drawers[1]
    expect(store.getState().selectedDrawerId).toBe(newDrawer.id)
  })
})
