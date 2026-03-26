import { createStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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

type Snapshot = { drawers: Drawer[]; items: Item[]; config: GridfinityConfig; selectedDrawerId: string | null; selectedItemId: string | null }

export interface DrawerStore {
  // State
  config: GridfinityConfig
  drawers: Drawer[]
  items: Item[]
  selectedDrawerId: string | null
  selectedItemId: string | null
  past: Snapshot[]
  future: Snapshot[]

  // Actions
  addDrawer: (drawer: Omit<Drawer, 'id' | 'gridCols' | 'gridRows'>) => void
  updateDrawer: (drawer: Drawer) => void
  deleteDrawer: (id: string, deleteContents?: boolean) => void
  duplicateDrawer: (id: string) => void
  addItem: (item: Omit<Item, 'id'>) => void
  updateItem: (item: Item) => void
  deleteItem: (id: string) => void
  duplicateItem: (id: string) => boolean
  moveItem: (itemId: string, drawerId: string | null, gridX: number, gridY: number) => void
  updateConfig: (config: Partial<GridfinityConfig>) => void
  selectDrawer: (id: string | null) => void
  selectItem: (id: string | null) => void
  undo: () => void
  redo: () => void

  // Computed getters
  getDrawerById: (id: string) => Drawer | undefined
  getItemById: (id: string) => Item | undefined
  getItemsInDrawer: (drawerId: string) => Item[]
  getUnassignedItems: () => Item[]
  exportData: () => ExportData
  importData: (data: ExportData) => void
}

// Factory — used by tests to get a fresh isolated instance
export function createDrawerStore(storage?: ReturnType<typeof createJSONStorage>) {
  return createStore<DrawerStore>()(
    persist(
      (set, get) => {
        const snap = (): Snapshot => {
          const { drawers, items, config, selectedDrawerId, selectedItemId } = get()
          return { drawers, items, config, selectedDrawerId, selectedItemId }
        }

        const push = () => {
          const { past } = get()
          set({ past: [...past.slice(-49), snap()], future: [] })
        }

        return {
          // Initial state
          config: DEFAULT_CONFIG,
          drawers: [],
          items: [],
          selectedDrawerId: null,
          selectedItemId: null,
          past: [],
          future: [],

          // Actions
          addDrawer: (drawer) => {
            push()
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
            push()
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

          deleteDrawer: (id, deleteContents = false) => {
            push()
            set((state) => ({
              drawers: state.drawers.filter((d) => d.id !== id),
              items: deleteContents
                ? state.items.filter((item) => item.drawerId !== id)
                : state.items.map((item) =>
                    item.drawerId === id
                      ? { ...item, drawerId: null, gridX: 0, gridY: 0 }
                      : item
                  ),
              selectedDrawerId:
                state.selectedDrawerId === id ? null : state.selectedDrawerId,
            }))
          },

          duplicateDrawer: (id) => {
            push()
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
            push()
            const newItem: Item = { ...item, id: generateId() }
            set((state) => ({
              items: [...state.items, newItem],
              selectedItemId: newItem.id,
            }))
          },

          updateItem: (item) => {
            push()
            set((state) => ({
              items: state.items.map((i) => (i.id === item.id ? item : i)),
            }))
          },

          deleteItem: (id) => {
            push()
            set((state) => ({
              items: state.items.filter((i) => i.id !== id),
              selectedItemId:
                state.selectedItemId === id ? null : state.selectedItemId,
            }))
          },

          duplicateItem: (id) => {
            push()
            const state = get()
            const src = state.items.find((i) => i.id === id)
            if (!src) return false
            const drawer = src.drawerId
              ? state.drawers.find((d) => d.id === src.drawerId)
              : null
            const srcDims = calculateItemGridDimensions(src, state.config)
            const foundPos = drawer
              ? findAvailablePosition(srcDims, drawer, state.items, state.config)
              : null
            const pos = foundPos ?? { gridX: src.gridX, gridY: src.gridY }
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
            return foundPos !== null
          },

          moveItem: (itemId, drawerId, gridX, gridY) => {
            push()
            set((state) => ({
              items: state.items.map((item) =>
                item.id === itemId
                  ? { ...item, drawerId, gridX, gridY }
                  : item
              ),
            }))
          },

          updateConfig: (config) => {
            push()
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

          undo: () => {
            const { past, future, drawers, items, config, selectedDrawerId, selectedItemId } = get()
            if (past.length === 0) return
            const prev = past[past.length - 1]
            set({
              past: past.slice(0, -1),
              future: [{ drawers, items, config, selectedDrawerId, selectedItemId }, ...future.slice(0, 49)],
              drawers: prev.drawers,
              items: prev.items,
              config: prev.config,
              selectedDrawerId: prev.selectedDrawerId,
              selectedItemId: prev.selectedItemId,
            })
          },

          redo: () => {
            const { past, future, drawers, items, config, selectedDrawerId, selectedItemId } = get()
            if (future.length === 0) return
            const next = future[0]
            set({
              future: future.slice(1),
              past: [...past.slice(-49), { drawers, items, config, selectedDrawerId, selectedItemId }],
              drawers: next.drawers,
              items: next.items,
              config: next.config,
              selectedDrawerId: next.selectedDrawerId,
              selectedItemId: next.selectedItemId,
            })
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
              push()
              set({
                config: { ...DEFAULT_CONFIG, ...data.config },
                drawers: data.drawers,
                items: data.items,
                selectedDrawerId: null,
                selectedItemId: null,
              })
            }
          },
        }
      },
      {
        name: 'gridfinity-drawer-planner',
        partialize: (state) => ({
          config: state.config,
          drawers: state.drawers,
          items: state.items,
        }),
        ...(storage ? { storage } : {}),
      }
    )
  )
}

// Singleton for the app
const drawerStore = createDrawerStore()

export function useDrawerStore<T>(selector: (s: DrawerStore) => T): T {
  return useStore(drawerStore, selector)
}
