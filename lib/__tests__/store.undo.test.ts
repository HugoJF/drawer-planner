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
    gridX: 0,
    gridY: 0,
    gridMode: 'auto' as const,
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
    // Before addDrawer there are 0 drawers
    store.getState().addDrawer(drawerPayload)
    expect(store.getState().drawers).toHaveLength(1)

    store.getState().undo()

    expect(store.getState().drawers).toHaveLength(0)
  })

  test('redo after undo re-applies the undone action', () => {
    store.getState().addDrawer(drawerPayload)
    const drawerId = store.getState().drawers[0].id

    store.getState().undo()
    expect(store.getState().drawers).toHaveLength(0)

    store.getState().redo()
    expect(store.getState().drawers).toHaveLength(1)
    expect(store.getState().drawers[0].id).toBe(drawerId)
  })

  test('undo with empty history does nothing', () => {
    store.getState().addDrawer(drawerPayload)
    const drawersBefore = store.getState().drawers

    // Undo once to exhaust history (only 1 entry was pushed)
    store.getState().undo()
    expect(store.getState().drawers).toHaveLength(0)

    // Undo again — history is now empty, should be a no-op
    const stateBeforeSecondUndo = store.getState().drawers
    store.getState().undo()
    expect(store.getState().drawers).toEqual(stateBeforeSecondUndo)
  })

  test('redo with empty future does nothing', () => {
    store.getState().addDrawer(drawerPayload)

    // No undo performed, so future is empty
    const drawersBefore = store.getState().drawers
    store.getState().redo()
    expect(store.getState().drawers).toEqual(drawersBefore)
  })

  test('new action after undo clears future', () => {
    store.getState().addDrawer(drawerPayload)
    // Undo pushes current state into future
    store.getState().undo()
    expect(store.getState().future).toHaveLength(1)

    // Performing a new action should wipe future
    store.getState().addDrawer({ ...drawerPayload, name: 'New Drawer' })
    expect(store.getState().future).toHaveLength(0)
  })

  test('history is capped at 50 entries after 51 actions', () => {
    // Push 51 separate actions (addDrawer calls push() before each mutation)
    for (let i = 0; i < 51; i++) {
      store.getState().addDrawer({ ...drawerPayload, name: `Drawer ${i}` })
    }
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
    // Add two drawers; the second one is selected after addDrawer
    store.getState().addDrawer(drawerPayload)
    const firstId = store.getState().drawers[0].id

    store.getState().selectDrawer(firstId)
    expect(store.getState().selectedDrawerId).toBe(firstId)

    // Add a second drawer (this pushes a history entry and selects the new one)
    store.getState().addDrawer({ ...drawerPayload, name: 'Second' })
    // Manually re-select the first drawer
    store.getState().selectDrawer(firstId)
    expect(store.getState().selectedDrawerId).toBe(firstId)

    // Undo the addDrawer of the second drawer — first drawer still exists
    store.getState().undo()

    // First drawer is still in past snapshot, so selection should be preserved
    expect(store.getState().selectedDrawerId).toBe(firstId)
  })

  test('selectedItemId is cleared after undo when selected item no longer exists in restored state', () => {
    // Add a drawer (snapshot A: 0 drawers, 0 items)
    store.getState().addDrawer(drawerPayload)
    const drawerId = store.getState().drawers[0].id

    // Add an item (snapshot B: 1 drawer, 0 items)
    store.getState().addItem({
      name: 'Wrench',
      width: 42,
      height: 50,
      depth: 42,
      categoryId: null,
      rotation: 'h-up',
      drawerId,
      gridX: 0,
      gridY: 0,
      gridMode: 'auto' as const,
    })
    const itemId = store.getState().selectedItemIds.values().next().value!
    expect(store.getState().selectedItemIds.has(itemId)).toBe(true)

    // Delete the item (snapshot C: 1 drawer, 1 item) — selectedItemId becomes null internally
    // but we want to test undo of the delete restores item + selection
    // Instead: undo the addItem — restores to snapshot B where item doesn't exist
    store.getState().undo()

    // We are now at snapshot B (1 drawer, 0 items); item no longer exists
    expect(store.getState().items).toHaveLength(0)
    expect(store.getState().selectedItemIds.size).toBe(0)
  })

  test('selectedItemId is restored after undoing item deletion (item exists again)', () => {
    const { drawerId, itemId } = addDrawerAndItem(store)

    // Select the item explicitly
    store.getState().selectItem(itemId)
    expect(store.getState().selectedItemIds.has(itemId)).toBe(true)

    // Delete item — selectedItemId becomes null
    store.getState().deleteItem(itemId)
    expect(store.getState().selectedItemIds.size).toBe(0)

    // Undo the deletion — snapshot before deleteItem had selectedItemId = itemId,
    // so both the item and its selection are fully restored.
    store.getState().undo()
    expect(store.getState().items.find((i) => i.id === itemId)).toBeDefined()
    expect(store.getState().selectedItemIds.has(itemId)).toBe(true)
  })

  test('selectDrawer does NOT push to history', () => {
    store.getState().addDrawer(drawerPayload)
    const pastLengthAfterAdd = store.getState().past.length

    store.getState().selectDrawer(store.getState().drawers[0].id)
    store.getState().selectDrawer(null)

    // past should not have grown
    expect(store.getState().past.length).toBe(pastLengthAfterAdd)
  })

  test('selectItem does NOT push to history', () => {
    const { itemId } = addDrawerAndItem(store)
    const pastLengthAfterSetup = store.getState().past.length

    store.getState().selectItem(itemId)
    store.getState().selectItem(null)

    expect(store.getState().past.length).toBe(pastLengthAfterSetup)
  })
})

// ---------------------------------------------------------------------------
// past / future — persistence
// ---------------------------------------------------------------------------

describe('past/future initial state', () => {
  test('past starts as an empty array on a fresh store', () => {
    const store = freshStore()
    expect(store.getState().past).toEqual([])
  })

  test('future starts as an empty array on a fresh store', () => {
    const store = freshStore()
    expect(store.getState().future).toEqual([])
  })
})
