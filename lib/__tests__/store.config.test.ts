import { describe, test, expect, beforeEach } from 'bun:test'
import { createJSONStorage } from 'zustand/middleware'
import { createDrawerStore } from '@/lib/store'
import { DEFAULT_CONFIG } from '@/lib/types'
import type { ExportData, Item, Drawer } from '@/lib/types'

// ---------------------------------------------------------------------------
// Noop storage — prevents Zustand persist from touching localStorage
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

/** Add a drawer and return its generated id. */
function addDrawerAndGetId(
  store: ReturnType<typeof freshStore>,
  overrides: Partial<Omit<Drawer, 'id' | 'gridCols' | 'gridRows'>> = {}
): string {
  const before = store.getState().drawers.length
  store.getState().addDrawer({
    name: 'Test Drawer',
    width: 300,
    height: 100,
    depth: 200,
    ...overrides,
  })
  return store.getState().drawers[before].id
}

/** Add an item and return its generated id. */
function addItemAndGetId(
  store: ReturnType<typeof freshStore>,
  drawerId: string | null = null
): string {
  const before = store.getState().items.length
  store.getState().addItem({
    name: 'Widget',
    width: 30,
    height: 20,
    depth: 15,
    categoryId: null,
    rotation: 'h-up',
    drawerId,
    gridX: 0,
    gridY: 0,
    gridMode: 'auto' as const,
  })
  return store.getState().items[before].id
}

// ---------------------------------------------------------------------------
// updateConfig
// ---------------------------------------------------------------------------

describe('updateConfig', () => {
  let store: ReturnType<typeof freshStore>

  beforeEach(() => {
    store = freshStore()
  })

  test('merges a partial config change (displayUnit)', () => {
    // Act
    store.getState().updateConfig({ displayUnit: 'cm' })

    // Assert
    const { config } = store.getState()
    expect(config.displayUnit).toBe('cm')
    expect(config.cellSize).toBe(DEFAULT_CONFIG.cellSize)
    expect(config.heightUnit).toBe(DEFAULT_CONFIG.heightUnit)
    expect(config.tolerance).toBe(DEFAULT_CONFIG.tolerance)
    expect(config.wallThickness).toBe(DEFAULT_CONFIG.wallThickness)
  })

  test('unrelated config fields remain unchanged after a partial update', () => {
    // Act
    store.getState().updateConfig({ tolerance: 1.0 })

    // Assert
    const { config } = store.getState()
    expect(config.tolerance).toBe(1.0)
    expect(config.cellSize).toBe(DEFAULT_CONFIG.cellSize)
    expect(config.displayUnit).toBe(DEFAULT_CONFIG.displayUnit)
    expect(config.heightUnit).toBe(DEFAULT_CONFIG.heightUnit)
    expect(config.wallThickness).toBe(DEFAULT_CONFIG.wallThickness)
  })

  test('recomputes gridCols/gridRows for all drawers when cellSize changes', () => {
    // Arrange
    // Default config: cellSize=42, tolerance=0.5
    // Drawer width=300, depth=200
    // floor((300 - 0.5*2) / 42) = 7 cols
    // floor((200 - 0.5*2) / 42) = 4 rows
    addDrawerAndGetId(store, { width: 300, depth: 200 })
    expect(store.getState().drawers[0].gridCols).toBe(7)
    expect(store.getState().drawers[0].gridRows).toBe(4)

    // Act
    // Change cellSize to 30
    // floor((300 - 0.5*2) / 30) = 9 cols
    // floor((200 - 0.5*2) / 30) = 6 rows
    store.getState().updateConfig({ cellSize: 30 })

    // Assert
    const drawerAfter = store.getState().drawers[0]
    expect(drawerAfter.gridCols).toBe(9)
    expect(drawerAfter.gridRows).toBe(6)
  })

  test('recomputes grid for every drawer when cellSize changes (multiple drawers)', () => {
    // Arrange
    addDrawerAndGetId(store, { width: 300, depth: 200 })
    addDrawerAndGetId(store, { width: 126, depth: 84 })

    // Act
    store.getState().updateConfig({ cellSize: 30 })

    // Assert
    const drawers = store.getState().drawers
    // width=300: floor((300-1)/30)=9, depth=200: floor((200-1)/30)=6
    expect(drawers[0].gridCols).toBe(9)
    expect(drawers[0].gridRows).toBe(6)
    // width=126: floor((126-1)/30)=4, depth=84: floor((84-1)/30)=2
    expect(drawers[1].gridCols).toBe(4)
    expect(drawers[1].gridRows).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// exportData
// ---------------------------------------------------------------------------

describe('exportData', () => {
  let store: ReturnType<typeof freshStore>

  beforeEach(() => {
    store = freshStore()
  })

  test('returns an object with version, exportDate, config, drawers, items', () => {
    // Act
    const data = store.getState().exportData()

    // Assert
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('exportDate')
    expect(data).toHaveProperty('config')
    expect(data).toHaveProperty('drawers')
    expect(data).toHaveProperty('items')
  })

  test('exportDate is a valid ISO 8601 string', () => {
    // Act
    const { exportDate } = store.getState().exportData()

    // Assert
    expect(isNaN(Date.parse(exportDate))).toBe(false)
  })

  test('drawers matches current state', () => {
    // Arrange
    addDrawerAndGetId(store)
    addDrawerAndGetId(store, { name: 'Second' })

    // Act
    const { drawers } = store.getState().exportData()

    // Assert
    expect(drawers).toEqual(store.getState().drawers)
    expect(drawers).toHaveLength(2)
  })

  test('items matches current state', () => {
    // Arrange
    const drawerId = addDrawerAndGetId(store)
    addItemAndGetId(store, drawerId)
    addItemAndGetId(store, null)

    // Act
    const { items } = store.getState().exportData()

    // Assert
    expect(items).toEqual(store.getState().items)
    expect(items).toHaveLength(2)
  })

  test('config matches current state', () => {
    // Arrange
    store.getState().updateConfig({ displayUnit: 'cm' })

    // Act
    const { config } = store.getState().exportData()

    // Assert
    expect(config).toEqual(store.getState().config)
    expect(config.displayUnit).toBe('cm')
  })

  test('export from empty store has empty drawers and items arrays', () => {
    // Act
    const data = store.getState().exportData()

    // Assert
    expect(data.drawers).toEqual([])
    expect(data.items).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// importData
// ---------------------------------------------------------------------------

describe('importData', () => {
  let store: ReturnType<typeof freshStore>

  const sampleDrawer: Drawer = {
    id: 'imported-drawer-1',
    name: 'Imported Drawer',
    width: 210,
    height: 80,
    depth: 150,
    gridCols: 4,
    gridRows: 3,
  }

  const sampleItem: Item = {
    id: 'imported-item-1',
    name: 'Imported Item',
    width: 40,
    height: 20,
    depth: 30,
    categoryId: null,
    rotation: 'h-up',
    drawerId: 'imported-drawer-1',
    gridX: 0,
    gridY: 0,
    gridMode: 'auto' as const,
    locked: false,
  }

  const validExport: ExportData = {
    version: 1,
    exportDate: '2026-01-01T00:00:00.000Z',
    config: { ...DEFAULT_CONFIG, displayUnit: 'cm', cellSize: 50 },
    drawers: [sampleDrawer],
    items: [sampleItem],
  }

  beforeEach(() => {
    store = freshStore()
  })

  test('replaces drawers and items with imported data', () => {
    // Arrange
    addDrawerAndGetId(store)
    addItemAndGetId(store)

    // Act
    store.getState().importData(validExport)

    // Assert
    expect(store.getState().drawers).toEqual([sampleDrawer])
    expect(store.getState().items).toEqual([sampleItem])
  })

  test('replaces config with imported config', () => {
    // Act
    store.getState().importData(validExport)

    // Assert
    expect(store.getState().config.displayUnit).toBe('cm')
    expect(store.getState().config.cellSize).toBe(50)
  })

  test('merges imported config with DEFAULT_CONFIG so missing fields get defaults', () => {
    // Arrange
    const exportWithPartialConfig: ExportData = {
      ...validExport,
      config: { displayUnit: 'cm' } as ExportData['config'],
    }

    // Act
    store.getState().importData(exportWithPartialConfig)

    // Assert
    const { config } = store.getState()
    expect(config.displayUnit).toBe('cm')
    expect(config.cellSize).toBe(DEFAULT_CONFIG.cellSize)
    expect(config.heightUnit).toBe(DEFAULT_CONFIG.heightUnit)
    expect(config.tolerance).toBe(DEFAULT_CONFIG.tolerance)
    expect(config.wallThickness).toBe(DEFAULT_CONFIG.wallThickness)
  })

  test('resets selectedDrawerId to null', () => {
    // Arrange
    const drawerId = addDrawerAndGetId(store)
    store.getState().selectDrawer(drawerId)
    expect(store.getState().selectedDrawerId).toBe(drawerId)

    // Act
    store.getState().importData(validExport)

    // Assert
    expect(store.getState().selectedDrawerId).toBeNull()
  })

  test('resets selectedItemId to null', () => {
    // Arrange
    const itemId = addItemAndGetId(store)
    store.getState().selectItem(itemId)
    expect(store.getState().selectedItemIds.has(itemId)).toBe(true)

    // Act
    store.getState().importData(validExport)

    // Assert
    expect(store.getState().selectedItemIds.size).toBe(0)
  })

  test('does nothing when version is missing', () => {
    // Arrange
    const drawerId = addDrawerAndGetId(store)
    const invalid = { drawers: [sampleDrawer], items: [sampleItem] } as unknown as ExportData

    // Act
    store.getState().importData(invalid)

    // Assert
    expect(store.getState().drawers).toHaveLength(1)
    expect(store.getState().drawers[0].id).toBe(drawerId)
  })

  test('does nothing when drawers is missing', () => {
    // Arrange
    addDrawerAndGetId(store)
    const invalid = { version: 1, items: [sampleItem] } as unknown as ExportData

    // Act
    store.getState().importData(invalid)

    // Assert
    expect(store.getState().drawers).toHaveLength(1)
  })

  test('does nothing when items is missing', () => {
    // Arrange
    addItemAndGetId(store)
    const invalid = { version: 1, drawers: [sampleDrawer] } as unknown as ExportData

    // Act
    store.getState().importData(invalid)

    // Assert
    expect(store.getState().items).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Getters
// ---------------------------------------------------------------------------

describe('getDrawerById', () => {
  let store: ReturnType<typeof freshStore>

  beforeEach(() => {
    store = freshStore()
  })

  test('returns the correct drawer for a known id', () => {
    // Arrange
    const id = addDrawerAndGetId(store, { name: 'My Drawer' })

    // Act
    const drawer = store.getState().getDrawerById(id)

    // Assert
    expect(drawer).toBeDefined()
    expect(drawer!.id).toBe(id)
    expect(drawer!.name).toBe('My Drawer')
  })

  test('returns undefined for an unknown id', () => {
    // Arrange
    addDrawerAndGetId(store)

    // Act
    const drawer = store.getState().getDrawerById('nonexistent-id')

    // Assert
    expect(drawer).toBeUndefined()
  })
})

describe('getItemById', () => {
  let store: ReturnType<typeof freshStore>

  beforeEach(() => {
    store = freshStore()
  })

  test('returns the correct item for a known id', () => {
    // Arrange
    const id = addItemAndGetId(store)

    // Act
    const item = store.getState().getItemById(id)

    // Assert
    expect(item).toBeDefined()
    expect(item!.id).toBe(id)
    expect(item!.name).toBe('Widget')
  })

  test('returns undefined for an unknown id', () => {
    // Arrange
    addItemAndGetId(store)

    // Act
    const item = store.getState().getItemById('no-such-item')

    // Assert
    expect(item).toBeUndefined()
  })
})

describe('getItemsInDrawer', () => {
  let store: ReturnType<typeof freshStore>

  beforeEach(() => {
    store = freshStore()
  })

  test('returns only items belonging to the specified drawer', () => {
    // Arrange
    const drawerId1 = addDrawerAndGetId(store, { name: 'Drawer A' })
    const drawerId2 = addDrawerAndGetId(store, { name: 'Drawer B' })
    addItemAndGetId(store, drawerId1)
    addItemAndGetId(store, drawerId1)
    addItemAndGetId(store, drawerId2)
    addItemAndGetId(store, null)

    // Act
    const inDrawer1 = store.getState().getItemsInDrawer(drawerId1)

    // Assert
    expect(inDrawer1).toHaveLength(2)
    expect(inDrawer1.every((i) => i.drawerId === drawerId1)).toBe(true)
  })

  test('returns an empty array when a drawer has no items', () => {
    // Arrange
    const drawerId = addDrawerAndGetId(store)

    // Act
    const result = store.getState().getItemsInDrawer(drawerId)

    // Assert
    expect(result).toEqual([])
  })

  test('returns an empty array for an unknown drawer id', () => {
    // Arrange
    addItemAndGetId(store, null)

    // Act
    const result = store.getState().getItemsInDrawer('ghost-drawer')

    // Assert
    expect(result).toEqual([])
  })
})

describe('getUnassignedItems', () => {
  let store: ReturnType<typeof freshStore>

  beforeEach(() => {
    store = freshStore()
  })

  test('returns only items with drawerId === null', () => {
    // Arrange
    const drawerId = addDrawerAndGetId(store)
    addItemAndGetId(store, drawerId)
    addItemAndGetId(store, null)
    addItemAndGetId(store, null)

    // Act
    const unassigned = store.getState().getUnassignedItems()

    // Assert
    expect(unassigned).toHaveLength(2)
    expect(unassigned.every((i) => i.drawerId === null)).toBe(true)
  })

  test('returns an empty array when all items are assigned', () => {
    // Arrange
    const drawerId = addDrawerAndGetId(store)
    addItemAndGetId(store, drawerId)
    addItemAndGetId(store, drawerId)

    // Act
    const unassigned = store.getState().getUnassignedItems()

    // Assert
    expect(unassigned).toEqual([])
  })

  test('returns all items when none are assigned', () => {
    // Arrange
    addItemAndGetId(store, null)
    addItemAndGetId(store, null)

    // Act
    const unassigned = store.getState().getUnassignedItems()

    // Assert
    expect(unassigned).toHaveLength(2)
  })
})
