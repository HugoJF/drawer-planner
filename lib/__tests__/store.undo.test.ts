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

const drawerPayload = { name: 'Drawer', width: 253, depth: 253, height: 75 }

function addDrawerAndItem(store: Store) {
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
    posX: 0,
    posY: 0,
    footprintMode: 'auto' as const,
  })
  const itemId = store.getState().selectedItemIds.values().next().value!
  return { drawerId, itemId }
}

// ---------------------------------------------------------------------------
// undo / redo — basic operations
// ---------------------------------------------------------------------------

describe('undo', () => {
  let store: Store

  beforeEach(() => {
    store = freshStore()
  })

  test('basic: undo restores state before last action', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    expect(store.getState().drawers).toHaveLength(1)

    // Act
    store.getState().undo()

    // Assert
    expect(store.getState().drawers).toHaveLength(0)
  })

  test('redo after undo re-applies the undone action', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    const drawerId = store.getState().drawers[0].id
    store.getState().undo()
    expect(store.getState().drawers).toHaveLength(0)

    // Act
    store.getState().redo()

    // Assert
    expect(store.getState().drawers).toHaveLength(1)
    expect(store.getState().drawers[0].id).toBe(drawerId)
  })

  test('undo with empty history does nothing', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    store.getState().undo() // exhaust history
    expect(store.getState().drawers).toHaveLength(0)
    const stateBeforeSecondUndo = store.getState().drawers

    // Act
    store.getState().undo()

    // Assert
    expect(store.getState().drawers).toEqual(stateBeforeSecondUndo)
  })

  test('redo with empty future does nothing', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    const drawersBefore = store.getState().drawers

    // Act
    store.getState().redo()

    // Assert
    expect(store.getState().drawers).toEqual(drawersBefore)
  })

  test('new action after undo clears future', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    store.getState().undo()
    expect(store.getState().future).toHaveLength(1)

    // Act
    store.getState().addDrawer({ ...drawerPayload, name: 'New Drawer' })

    // Assert
    expect(store.getState().future).toHaveLength(0)
  })

  test('history is capped at 50 entries after 51 actions', () => {
    // Act
    for (let i = 0; i < 51; i++) {
      store.getState().addDrawer({ ...drawerPayload, name: `Drawer ${i}` })
    }

    // Assert
    expect(store.getState().past.length).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// undo — selection behaviour
// ---------------------------------------------------------------------------

describe('undo — selection', () => {
  let store: Store

  beforeEach(() => {
    store = freshStore()
  })

  test('selectedDrawerId is preserved after undo when the drawer still exists', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    const firstId = store.getState().drawers[0].id
    store.getState().selectDrawer(firstId)
    store.getState().addDrawer({ ...drawerPayload, name: 'Second' })
    store.getState().selectDrawer(firstId)
    expect(store.getState().selectedDrawerId).toBe(firstId)

    // Act
    store.getState().undo()

    // Assert
    expect(store.getState().selectedDrawerId).toBe(firstId)
  })

  test('selectedItemId is cleared after undo when selected item no longer exists in restored state', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    const drawerId = store.getState().drawers[0].id
    store.getState().addItem({
      name: 'Wrench',
      width: 42, height: 50, depth: 42,
      categoryId: null, rotation: 'h-up',
      drawerId, posX: 0, posY: 0, footprintMode: 'auto' as const,
    })
    const itemId = store.getState().selectedItemIds.values().next().value!
    expect(store.getState().selectedItemIds.has(itemId)).toBe(true)

    // Act
    store.getState().undo() // undo addItem → item no longer exists

    // Assert
    expect(store.getState().items).toHaveLength(0)
    expect(store.getState().selectedItemIds.size).toBe(0)
  })

  test('selectedItemId is restored after undoing item deletion (item exists again)', () => {
    // Arrange
    const { itemId } = addDrawerAndItem(store)
    store.getState().selectItem(itemId)
    store.getState().deleteItem(itemId)
    expect(store.getState().selectedItemIds.size).toBe(0)

    // Act
    store.getState().undo()

    // Assert
    expect(store.getState().items.find((i) => i.id === itemId)).toBeDefined()
    expect(store.getState().selectedItemIds.has(itemId)).toBe(true)
  })

  test('selectDrawer does NOT push to history', () => {
    // Arrange
    store.getState().addDrawer(drawerPayload)
    const pastLengthAfterAdd = store.getState().past.length

    // Act
    store.getState().selectDrawer(store.getState().drawers[0].id)
    store.getState().selectDrawer(null)

    // Assert
    expect(store.getState().past.length).toBe(pastLengthAfterAdd)
  })

  test('selectItem does NOT push to history', () => {
    // Arrange
    const { itemId } = addDrawerAndItem(store)
    const pastLengthAfterSetup = store.getState().past.length

    // Act
    store.getState().selectItem(itemId)
    store.getState().selectItem(null)

    // Assert
    expect(store.getState().past.length).toBe(pastLengthAfterSetup)
  })
})

// ---------------------------------------------------------------------------
// past / future — persistence
// ---------------------------------------------------------------------------

describe('past/future initial state', () => {
  test('past starts as an empty array on a fresh store', () => {
    // Act
    const store = freshStore()

    // Assert
    expect(store.getState().past).toEqual([])
  })

  test('future starts as an empty array on a fresh store', () => {
    // Act
    const store = freshStore()

    // Assert
    expect(store.getState().future).toEqual([])
  })
})
