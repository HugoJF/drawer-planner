import { createStore } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { useStore } from 'zustand'
import type {
  GridfinityConfig,
  Drawer,
  Item,
  ItemRotation,
  Category,
  ExportData,
} from '@/lib/types'
import { DEFAULT_CONFIG } from '@/lib/types'
import {
  calculateDrawerGrid,
  calculateItemGridDimensions,
  generateId,
  findAvailablePosition,
} from '@/lib/gridfinity'

export type Snapshot = { drawers: Drawer[]; items: Item[]; categories: Category[]; config: GridfinityConfig; selectedDrawerId: string | null; selectedItemIds: Set<string> }

export interface DrawerStore {
  // State
  config: GridfinityConfig
  drawers: Drawer[]
  items: Item[]
  categories: Category[]
  selectedDrawerId: string | null
  selectedItemIds: Set<string>
  searchQuery: string
  past: Snapshot[]
  future: Snapshot[]

  // Actions
  setSearchQuery: (query: string) => void
  selectItem: (id: string | null) => void
  toggleItemSelection: (id: string) => void
  selectItems: (ids: string[]) => void
  addDrawer: (drawer: Omit<Drawer, 'id' | 'gridCols' | 'gridRows'>) => void
  updateDrawer: (drawer: Drawer) => void
  deleteDrawer: (id: string, deleteContents?: boolean) => void
  duplicateDrawer: (id: string) => void
  addItem: (item: Omit<Item, 'id' | 'locked'>) => void
  updateItem: (item: Item) => void
  deleteItem: (id: string) => void
  deleteItems: (ids: string[]) => void
  setItemsLocked: (ids: string[], locked: boolean) => void
  duplicateItem: (id: string) => boolean
  moveItem: (itemId: string, drawerId: string | null, gridX: number, gridY: number) => void
  repositionItems: (updates: { id: string; drawerId: string | null; gridX: number; gridY: number }[]) => void
  updateConfig: (config: Partial<GridfinityConfig>) => void
  addCategory: (name: string, color: string) => string
  updateCategory: (category: Category) => void
  deleteCategory: (id: string) => void
  selectDrawer: (id: string | null) => void
  undo: () => void
  redo: () => void
  jumpToHistory: (index: number) => void
  jumpToFuture: (index: number) => void

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
          const { drawers, items, categories, config, selectedDrawerId, selectedItemIds } = get()
          return { drawers, items, categories, config, selectedDrawerId, selectedItemIds: new Set(selectedItemIds) }
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
          categories: [],
          selectedDrawerId: null,
          selectedItemIds: new Set(),
          searchQuery: '',
          past: [],
          future: [],

          setSearchQuery: (query) => set({ searchQuery: query }),
          selectItem: (id) => set({ selectedItemIds: id ? new Set([id]) : new Set() }),
          toggleItemSelection: (id) => set((state) => {
            const next = new Set(state.selectedItemIds)
            if (next.has(id)) next.delete(id); else next.add(id)
            return { selectedItemIds: next }
          }),
          selectItems: (ids) => set({ selectedItemIds: new Set(ids) }),

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
            const newItem: Item = { locked: false, ...item, id: generateId() }
            set((state) => ({
              items: [...state.items, newItem],
              selectedItemIds: new Set([newItem.id]),
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
              selectedItemIds: state.selectedItemIds.has(id)
                ? new Set([...state.selectedItemIds].filter(sid => sid !== id))
                : state.selectedItemIds,
            }))
          },

          setItemsLocked: (ids, locked) => {
            push()
            const idSet = new Set(ids)
            set((state) => ({
              items: state.items.map(item => idSet.has(item.id) ? { ...item, locked } : item),
            }))
          },

          deleteItems: (ids) => {
            push()
            const idSet = new Set(ids)
            set((state) => ({
              items: state.items.filter((i) => !idSet.has(i.id)),
              selectedItemIds: new Set([...state.selectedItemIds].filter(id => !idSet.has(id))),
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
              selectedItemIds: new Set([newItem.id]),
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

          repositionItems: (updates) => {
            push()
            const map = new Map(updates.map(u => [u.id, u]))
            set((state) => ({
              items: state.items.map(item => {
                const u = map.get(item.id)
                return u ? { ...item, drawerId: u.drawerId, gridX: u.gridX, gridY: u.gridY } : item
              }),
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

          addCategory: (name, color) => {
            push()
            const id = generateId()
            set((state) => ({ categories: [...state.categories, { id, name, color }] }))
            return id
          },

          updateCategory: (category) => {
            push()
            set((state) => ({ categories: state.categories.map(c => c.id === category.id ? category : c) }))
          },

          deleteCategory: (id) => {
            push()
            set((state) => ({
              categories: state.categories.filter(c => c.id !== id),
              items: state.items.map(i => i.categoryId === id ? { ...i, categoryId: null } : i),
            }))
          },

          selectDrawer: (id) => {
            set({ selectedDrawerId: id })
          },

          undo: () => {
            const { past, future, drawers, items, categories, config, selectedDrawerId, selectedItemIds } = get()
            if (past.length === 0) return
            const prev = past[past.length - 1]
            set({
              past: past.slice(0, -1),
              future: [{ drawers, items, categories, config, selectedDrawerId, selectedItemIds: new Set(selectedItemIds) }, ...future.slice(0, 49)],
              drawers: prev.drawers,
              items: prev.items,
              categories: prev.categories,
              config: prev.config,
              selectedDrawerId: prev.selectedDrawerId,
              selectedItemIds: prev.selectedItemIds,
            })
          },

          redo: () => {
            const { past, future, drawers, items, categories, config, selectedDrawerId, selectedItemIds } = get()
            if (future.length === 0) return
            const next = future[0]
            set({
              future: future.slice(1),
              past: [...past.slice(-49), { drawers, items, categories, config, selectedDrawerId, selectedItemIds: new Set(selectedItemIds) }],
              drawers: next.drawers,
              items: next.items,
              categories: next.categories,
              config: next.config,
              selectedDrawerId: next.selectedDrawerId,
              selectedItemIds: next.selectedItemIds,
            })
          },

          jumpToHistory: (index) => {
            const { past, future, drawers, items, categories, config, selectedDrawerId, selectedItemIds } = get()
            const target = past[index]
            if (!target) return
            const current = { drawers, items, categories, config, selectedDrawerId, selectedItemIds: new Set(selectedItemIds) }
            set({
              past: past.slice(0, index),
              future: [...past.slice(index + 1), current, ...future].slice(0, 50),
              drawers: target.drawers,
              items: target.items,
              categories: target.categories,
              config: target.config,
              selectedDrawerId: target.selectedDrawerId,
              selectedItemIds: target.selectedItemIds,
            })
          },

          jumpToFuture: (index) => {
            const { past, future, drawers, items, categories, config, selectedDrawerId, selectedItemIds } = get()
            const target = future[index]
            if (!target) return
            const current = { drawers, items, categories, config, selectedDrawerId, selectedItemIds: new Set(selectedItemIds) }
            set({
              past: [...past, current, ...future.slice(0, index)].slice(-50),
              future: future.slice(index + 1),
              drawers: target.drawers,
              items: target.items,
              categories: target.categories,
              config: target.config,
              selectedDrawerId: target.selectedDrawerId,
              selectedItemIds: target.selectedItemIds,
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
              categories: state.categories,
            }
          },

          importData: (data) => {
            if (data.version && data.drawers && data.items) {
              push()
              const legacyRotation: Record<string, ItemRotation> = { normal: 'h-up', layDown: 'd-up', rotated: 'h-up-r' }
              set({
                config: { ...DEFAULT_CONFIG, ...data.config },
                drawers: data.drawers,
                items: data.items.map(i => ({
                  ...i,
                  categoryId: (i as Item & { categoryId?: string | null }).categoryId ?? null,
                  rotation: legacyRotation[i.rotation as unknown as string] ?? i.rotation,
                })),
                categories: data.categories ?? [],
                selectedDrawerId: null,
                selectedItemIds: new Set(),
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
          categories: state.categories,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // TODO: promote to proper versioned migration (store has no version field yet)
            const legacyRotation: Record<string, ItemRotation> = { normal: 'h-up', layDown: 'd-up', rotated: 'h-up-r' }
            state.items = state.items.map(i => ({
              ...i,
              locked: (i as Item & { locked?: boolean }).locked ?? false,
              categoryId: (i as Item & { categoryId?: string | null }).categoryId ?? null,
              rotation: legacyRotation[i.rotation as unknown as string] ?? i.rotation,
            }))
            state.categories = state.categories ?? []
          }
        },
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
