/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test'
import { createJSONStorage } from 'zustand/middleware'
import { createDrawerStore } from '../store'

const noopStorage = createJSONStorage(() => ({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}))

function freshStore() {
  return createDrawerStore(noopStorage)
}

function addDrawer(store: ReturnType<typeof freshStore>, name = 'Test') {
  store.getState().addDrawer({ name, width: 280, depth: 200, height: 75 })
  return store.getState().drawers[store.getState().drawers.length - 1].id
}

// ---------------------------------------------------------------------------
// addDrawer — cabinet defaults
// ---------------------------------------------------------------------------

describe('addDrawer — cabinet position', () => {
  test('new drawer has cabinetX: 0 and cabinetY: 0', () => {
    // Arrange
    const store = freshStore()

    // Act
    addDrawer(store)

    // Assert
    expect(store.getState().drawers[0].cabinetX).toBe(0)
    expect(store.getState().drawers[0].cabinetY).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// setCabinetPosition
// ---------------------------------------------------------------------------

describe('setCabinetPosition', () => {
  test('updates cabinetX and cabinetY for the specified drawer', () => {
    // Arrange
    const store = freshStore()
    const id = addDrawer(store)

    // Act
    store.getState().setCabinetPosition(id, 150, 80)

    // Assert
    const drawer = store.getState().drawers.find(d => d.id === id)!
    expect(drawer.cabinetX).toBe(150)
    expect(drawer.cabinetY).toBe(80)
  })

  test('does not affect other drawers', () => {
    // Arrange
    const store = freshStore()
    const id1 = addDrawer(store, 'A')
    const id2 = addDrawer(store, 'B')

    // Act
    store.getState().setCabinetPosition(id1, 100, 50)

    // Assert
    const d2 = store.getState().drawers.find(d => d.id === id2)!
    expect(d2.cabinetX).toBe(0)
    expect(d2.cabinetY).toBe(0)
  })

  test('pushes an undo entry', () => {
    // Arrange
    const store = freshStore()
    const id = addDrawer(store)
    const pastBefore = store.getState().past.length

    // Act
    store.getState().setCabinetPosition(id, 100, 50)

    // Assert
    expect(store.getState().past.length).toBe(pastBefore + 1)
  })

  test('undo restores previous position', () => {
    // Arrange
    const store = freshStore()
    const id = addDrawer(store)
    store.getState().setCabinetPosition(id, 100, 50)

    // Act
    store.getState().undo()

    // Assert
    const drawer = store.getState().drawers.find(d => d.id === id)!
    expect(drawer.cabinetX).toBe(0)
    expect(drawer.cabinetY).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// repositionCabinetDrawers
// ---------------------------------------------------------------------------

describe('repositionCabinetDrawers', () => {
  test('updates positions for all specified drawers in one operation', () => {
    // Arrange
    const store = freshStore()
    const id1 = addDrawer(store, 'A')
    const id2 = addDrawer(store, 'B')

    // Act
    store.getState().repositionCabinetDrawers([
      { id: id1, x: 10, y: 20 },
      { id: id2, x: 30, y: 40 },
    ])

    // Assert
    const d1 = store.getState().drawers.find(d => d.id === id1)!
    const d2 = store.getState().drawers.find(d => d.id === id2)!
    expect(d1.cabinetX).toBe(10)
    expect(d1.cabinetY).toBe(20)
    expect(d2.cabinetX).toBe(30)
    expect(d2.cabinetY).toBe(40)
  })

  test('pushes a single undo entry for the whole batch', () => {
    // Arrange
    const store = freshStore()
    const id1 = addDrawer(store, 'A')
    const id2 = addDrawer(store, 'B')
    const pastBefore = store.getState().past.length

    // Act
    store.getState().repositionCabinetDrawers([
      { id: id1, x: 10, y: 20 },
      { id: id2, x: 30, y: 40 },
    ])

    // Assert
    expect(store.getState().past.length).toBe(pastBefore + 1)
  })

  test('undo restores all positions at once', () => {
    // Arrange
    const store = freshStore()
    const id1 = addDrawer(store, 'A')
    const id2 = addDrawer(store, 'B')
    store.getState().repositionCabinetDrawers([
      { id: id1, x: 10, y: 20 },
      { id: id2, x: 30, y: 40 },
    ])

    // Act
    store.getState().undo()

    // Assert
    const d1 = store.getState().drawers.find(d => d.id === id1)!
    const d2 = store.getState().drawers.find(d => d.id === id2)!
    expect(d1.cabinetX).toBe(0)
    expect(d1.cabinetY).toBe(0)
    expect(d2.cabinetX).toBe(0)
    expect(d2.cabinetY).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// selectCabinetDrawers / toggleCabinetDrawerSelection
// ---------------------------------------------------------------------------

describe('selectCabinetDrawers', () => {
  test('sets selectedCabinetDrawerIds to the provided ids', () => {
    // Arrange
    const store = freshStore()
    const id1 = addDrawer(store, 'A')
    const id2 = addDrawer(store, 'B')

    // Act
    store.getState().selectCabinetDrawers([id1, id2])

    // Assert
    expect(store.getState().selectedCabinetDrawerIds.has(id1)).toBe(true)
    expect(store.getState().selectedCabinetDrawerIds.has(id2)).toBe(true)
  })

  test('does not push an undo entry', () => {
    // Arrange
    const store = freshStore()
    const id = addDrawer(store)
    const pastBefore = store.getState().past.length

    // Act
    store.getState().selectCabinetDrawers([id])

    // Assert
    expect(store.getState().past.length).toBe(pastBefore)
  })

  test('replaces previous selection', () => {
    // Arrange
    const store = freshStore()
    const id1 = addDrawer(store, 'A')
    const id2 = addDrawer(store, 'B')
    store.getState().selectCabinetDrawers([id1])

    // Act
    store.getState().selectCabinetDrawers([id2])

    // Assert
    expect(store.getState().selectedCabinetDrawerIds.has(id1)).toBe(false)
    expect(store.getState().selectedCabinetDrawerIds.has(id2)).toBe(true)
  })
})

describe('toggleCabinetDrawerSelection', () => {
  test('adds id when not selected', () => {
    // Arrange
    const store = freshStore()
    const id = addDrawer(store)

    // Act
    store.getState().toggleCabinetDrawerSelection(id)

    // Assert
    expect(store.getState().selectedCabinetDrawerIds.has(id)).toBe(true)
  })

  test('removes id when already selected', () => {
    // Arrange
    const store = freshStore()
    const id = addDrawer(store)
    store.getState().selectCabinetDrawers([id])

    // Act
    store.getState().toggleCabinetDrawerSelection(id)

    // Assert
    expect(store.getState().selectedCabinetDrawerIds.has(id)).toBe(false)
  })

  test('does not push an undo entry', () => {
    // Arrange
    const store = freshStore()
    const id = addDrawer(store)
    const pastBefore = store.getState().past.length

    // Act
    store.getState().toggleCabinetDrawerSelection(id)

    // Assert
    expect(store.getState().past.length).toBe(pastBefore)
  })
})
