import { createStore } from 'zustand'
import { persist } from 'zustand/middleware'
import { useStore } from 'zustand'
import type {
  GridfinityConfig,
  Drawer,
  Item,
  ExportData,
} from '@/lib/types'
import { DEFAULT_CONFIG } from '@/lib/types'
import {
  calculateDrawerGrid,
  calculateItemGridDimensions,
  generateId,
  findAvailablePosition,
} from '@/lib/gridfinity'

export interface DrawerStore {
  // State
  config: GridfinityConfig
  drawers: Drawer[]
  items: Item[]
  selectedDrawerId: string | null
  selectedItemId: string | null

  // Actions
  addDrawer: (drawer: Omit<Drawer, 'id' | 'gridCols' | 'gridRows'>) => void
  updateDrawer: (drawer: Drawer) => void
  deleteDrawer: (id: string) => void
  duplicateDrawer: (id: string) => void
  addItem: (item: Omit<Item, 'id'>) => void
  updateItem: (item: Item) => void
  deleteItem: (id: string) => void
  duplicateItem: (id: string) => void
  moveItem: (itemId: string, drawerId: string | null, gridX: number, gridY: number) => void
  updateConfig: (config: Partial<GridfinityConfig>) => void
  selectDrawer: (id: string | null) => void
  selectItem: (id: string | null) => void

  // Computed getters
  getDrawerById: (id: string) => Drawer | undefined
  getItemById: (id: string) => Item | undefined
  getItemsInDrawer: (drawerId: string) => Item[]
  getUnassignedItems: () => Item[]
  exportData: () => ExportData
  importData: (data: ExportData) => void
}

// Factory — used by tests to get a fresh isolated instance
export function createDrawerStore() {
  return createStore<DrawerStore>()(
    persist(
      (set, get) => ({
        // Initial state
        config: DEFAULT_CONFIG,
        drawers: [],
        items: [],
        selectedDrawerId: null,
        selectedItemId: null,

        // Actions
        addDrawer: (drawer) => {
          const { gridCols, gridRows } = calculateDrawerGrid(
            drawer.width,
            drawer.depth,
            get().config
          )
          const newDrawer: Drawer = {
            ...drawer,
            id: generateId(),
            gridCols,
            gridRows,
          }
          set((state) => ({
            drawers: [...state.drawers, newDrawer],
            selectedDrawerId: newDrawer.id,
          }))
        },

        updateDrawer: (drawer) => {
          const { gridCols, gridRows } = calculateDrawerGrid(
            drawer.width,
            drawer.depth,
            get().config
          )
          set((state) => ({
            drawers: state.drawers.map((d) =>
              d.id === drawer.id
                ? { ...drawer, gridCols, gridRows }
                : d
            ),
          }))
        },

        deleteDrawer: (id) => {
          set((state) => ({
            drawers: state.drawers.filter((d) => d.id !== id),
            items: state.items.map((item) =>
              item.drawerId === id
                ? { ...item, drawerId: null, gridX: 0, gridY: 0 }
                : item
            ),
            selectedDrawerId:
              state.selectedDrawerId === id ? null : state.selectedDrawerId,
          }))
        },

        duplicateDrawer: (id) => {
          const state = get()
          const src = state.drawers.find((d) => d.id === id)
          if (!src) return
          const newId = generateId()
          const newDrawer: Drawer = { ...src, id: newId, name: `${src.name} (copy)` }
          const newItems = state.items
            .filter((i) => i.drawerId === src.id)
            .map((i) => ({ ...i, id: generateId(), drawerId: newId }))
          set((s) => ({
            drawers: [...s.drawers, newDrawer],
            items: [...s.items, ...newItems],
            selectedDrawerId: newId,
          }))
        },

        addItem: (item) => {
          const newItem: Item = { ...item, id: generateId() }
          set((state) => ({
            items: [...state.items, newItem],
            selectedItemId: newItem.id,
          }))
        },

        updateItem: (item) => {
          set((state) => ({
            items: state.items.map((i) => (i.id === item.id ? item : i)),
          }))
        },

        deleteItem: (id) => {
          set((state) => ({
            items: state.items.filter((i) => i.id !== id),
            selectedItemId:
              state.selectedItemId === id ? null : state.selectedItemId,
          }))
        },

        duplicateItem: (id) => {
          const state = get()
          const src = state.items.find((i) => i.id === id)
          if (!src) return
          const drawer = src.drawerId
            ? state.drawers.find((d) => d.id === src.drawerId)
            : null
          const srcDims = calculateItemGridDimensions(src, state.config)
          const pos =
            (drawer
              ? findAvailablePosition(srcDims, drawer, state.items, state.config)
              : null) ?? { gridX: src.gridX, gridY: src.gridY }
          const newItem: Item = {
            ...src,
            id: generateId(),
            name: `${src.name} (copy)`,
            ...pos,
          }
          set((s) => ({
            items: [...s.items, newItem],
            selectedItemId: newItem.id,
          }))
        },

        moveItem: (itemId, drawerId, gridX, gridY) => {
          set((state) => ({
            items: state.items.map((item) =>
              item.id === itemId
                ? { ...item, drawerId, gridX, gridY }
                : item
            ),
          }))
        },

        updateConfig: (config) => {
          set((state) => {
            const newConfig = { ...state.config, ...config }
            const updatedDrawers = state.drawers.map((drawer) => {
              const { gridCols, gridRows } = calculateDrawerGrid(
                drawer.width,
                drawer.depth,
                newConfig
              )
              return { ...drawer, gridCols, gridRows }
            })
            return { config: newConfig, drawers: updatedDrawers }
          })
        },

        selectDrawer: (id) => {
          set({ selectedDrawerId: id })
        },

        selectItem: (id) => {
          set({ selectedItemId: id })
        },

        // Computed getters
        getDrawerById: (id) => {
          return get().drawers.find((d) => d.id === id)
        },

        getItemById: (id) => {
          return get().items.find((i) => i.id === id)
        },

        getItemsInDrawer: (drawerId) => {
          return get().items.filter((item) => item.drawerId === drawerId)
        },

        getUnassignedItems: () => {
          return get().items.filter((item) => item.drawerId === null)
        },

        exportData: (): ExportData => {
          const state = get()
          return {
            version: '1.0',
            exportDate: new Date().toISOString(),
            config: state.config,
            drawers: state.drawers,
            items: state.items,
          }
        },

        importData: (data) => {
          if (data.version && data.drawers && data.items) {
            set({
              config: { ...DEFAULT_CONFIG, ...data.config },
              drawers: data.drawers,
              items: data.items,
              selectedDrawerId: null,
              selectedItemId: null,
            })
          }
        },
      }),
      { name: 'gridfinity-drawer-planner' }
    )
  )
}

// Singleton for the app
const drawerStore = createDrawerStore()

export function useDrawerStore<T>(selector: (s: DrawerStore) => T): T {
  return useStore(drawerStore, selector)
}
