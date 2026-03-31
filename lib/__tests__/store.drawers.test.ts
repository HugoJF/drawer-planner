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
    gridX: 0,
    gridY: 0,
    locked: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// addDrawer
// ---------------------------------------------------------------------------
describe('addDrawer', () => {
  test('appends the drawer to drawers', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    expect(store.getState().drawers).toHaveLength(1)
    expect(store.getState().drawers[0].name).toBe('Test')
  })

  test('computes gridCols and gridRows from dimensions (280mm / 42mm cellSize ≈ 6)', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const drawer = store.getState().drawers[0]
    // Math.floor((280 - 0.5 * 2) / 42) = Math.floor(279 / 42) = 6
    expect(drawer.gridCols).toBe(6)
    expect(drawer.gridRows).toBe(6)
  })

  test('sets selectedDrawerId to the new drawer id', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const drawer = store.getState().drawers[0]
    expect(store.getState().selectedDrawerId).toBe(drawer.id)
  })
})

// ---------------------------------------------------------------------------
// updateDrawer
// ---------------------------------------------------------------------------
describe('updateDrawer', () => {
  test('updates name on the existing drawer', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const original = store.getState().drawers[0]

    store.getState().updateDrawer({ ...original, name: 'Renamed' })
    expect(store.getState().drawers[0].name).toBe('Renamed')
  })

  test('recomputes gridCols and gridRows when dimensions change', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const original = store.getState().drawers[0]
    // 126mm → Math.floor((126 - 1) / 42) = Math.floor(125 / 42) = 2
    store.getState().updateDrawer({ ...original, width: 126, depth: 126 })
    const updated = store.getState().drawers[0]
    expect(updated.gridCols).toBe(2)
    expect(updated.gridRows).toBe(2)
  })

  test('does not affect other drawers', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    store.getState().addDrawer({ ...drawerPayload, name: 'Other' })
    const [first, second] = store.getState().drawers

    store.getState().updateDrawer({ ...first, name: 'Updated' })
    expect(store.getState().drawers[1].id).toBe(second.id)
    expect(store.getState().drawers[1].name).toBe('Other')
  })
})

// ---------------------------------------------------------------------------
// deleteDrawer
// ---------------------------------------------------------------------------
describe('deleteDrawer', () => {
  test('removes the drawer from drawers', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const { id } = store.getState().drawers[0]

    store.getState().deleteDrawer(id)
    expect(store.getState().drawers).toHaveLength(0)
  })

  test('items that were in the deleted drawer get drawerId null, gridX 0, gridY 0', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const drawerId = store.getState().drawers[0].id

    store.getState().addItem(itemPayload({ drawerId, gridX: 2, gridY: 3 }))
    const itemId = store.getState().items[0].id

    store.getState().deleteDrawer(drawerId)

    const item = store.getState().items.find((i) => i.id === itemId)!
    expect(item.drawerId).toBeNull()
    expect(item.gridX).toBe(0)
    expect(item.gridY).toBe(0)
  })

  test('items in other drawers are unaffected', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    store.getState().addDrawer({ ...drawerPayload, name: 'Other' })
    const [deletedDrawer, otherDrawer] = store.getState().drawers

    store.getState().addItem(itemPayload({ drawerId: otherDrawer.id, gridX: 1, gridY: 1 }))
    const itemId = store.getState().items[0].id

    store.getState().deleteDrawer(deletedDrawer.id)

    const item = store.getState().items.find((i) => i.id === itemId)!
    expect(item.drawerId).toBe(otherDrawer.id)
    expect(item.gridX).toBe(1)
    expect(item.gridY).toBe(1)
  })

  test('clears selectedDrawerId when the deleted drawer was selected', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const { id } = store.getState().drawers[0]
    // addDrawer already selects it, confirm
    expect(store.getState().selectedDrawerId).toBe(id)

    store.getState().deleteDrawer(id)
    expect(store.getState().selectedDrawerId).toBeNull()
  })

  test('does NOT clear selectedDrawerId when a different drawer was selected', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    store.getState().addDrawer({ ...drawerPayload, name: 'Second' })
    // addDrawer selects the last-added drawer (Second)
    const [first, second] = store.getState().drawers
    expect(store.getState().selectedDrawerId).toBe(second.id)

    store.getState().deleteDrawer(first.id)
    // selectedDrawerId should still be the second drawer
    expect(store.getState().selectedDrawerId).toBe(second.id)
  })
})

// ---------------------------------------------------------------------------
// duplicateDrawer
// ---------------------------------------------------------------------------
describe('duplicateDrawer', () => {
  test('creates a new drawer with name "<original> (copy)"', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const { id } = store.getState().drawers[0]

    store.getState().duplicateDrawer(id)
    expect(store.getState().drawers).toHaveLength(2)
    const copy = store.getState().drawers[1]
    expect(copy.name).toBe('Test (copy)')
  })

  test('new drawer has a different id from the original', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const { id: originalId } = store.getState().drawers[0]

    store.getState().duplicateDrawer(originalId)
    const copy = store.getState().drawers[1]
    expect(copy.id).not.toBe(originalId)
  })

  test('copies all items assigned to the source drawer with new ids pointing to new drawer', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const drawerId = store.getState().drawers[0].id

    store.getState().addItem(itemPayload({ name: 'Alpha', drawerId, gridX: 0, gridY: 0 }))
    store.getState().addItem(itemPayload({ name: 'Beta', drawerId, gridX: 1, gridY: 1 }))
    const originalItemIds = store.getState().items.map((i) => i.id)

    store.getState().duplicateDrawer(drawerId)
    const newDrawerId = store.getState().drawers[1].id
    const copiedItems = store.getState().items.filter((i) => i.drawerId === newDrawerId)

    expect(copiedItems).toHaveLength(2)
    // Each copied item must have a brand-new id
    for (const item of copiedItems) {
      expect(originalItemIds).not.toContain(item.id)
    }
    // Names are preserved
    const names = copiedItems.map((i) => i.name).sort()
    expect(names).toEqual(['Alpha', 'Beta'])
  })

  test('does NOT copy items from other drawers', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    store.getState().addDrawer({ ...drawerPayload, name: 'Other' })
    const [sourceDrawer, otherDrawer] = store.getState().drawers

    store.getState().addItem(itemPayload({ name: 'Mine', drawerId: sourceDrawer.id }))
    store.getState().addItem(itemPayload({ name: 'NotMine', drawerId: otherDrawer.id }))

    store.getState().duplicateDrawer(sourceDrawer.id)
    const newDrawerId = store.getState().drawers.find(
      (d) => d.id !== sourceDrawer.id && d.id !== otherDrawer.id
    )!.id

    const copiedItems = store.getState().items.filter((i) => i.drawerId === newDrawerId)
    expect(copiedItems).toHaveLength(1)
    expect(copiedItems[0].name).toBe('Mine')
  })

  test('sets selectedDrawerId to the new drawer id', () => {
    const store = freshStore()
    store.getState().addDrawer(drawerPayload)
    const { id: originalId } = store.getState().drawers[0]

    store.getState().duplicateDrawer(originalId)
    const newDrawer = store.getState().drawers[1]
    expect(store.getState().selectedDrawerId).toBe(newDrawer.id)
  })
})
