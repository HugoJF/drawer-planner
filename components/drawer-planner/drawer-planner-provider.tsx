'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import type { 
  AppState, 
  AppAction, 
  GridfinityConfig, 
  Drawer, 
  Item,
  ExportData,
} from '@/lib/types'
import { DEFAULT_CONFIG as CONFIG_DEFAULTS } from '@/lib/types'
import { calculateDrawerGrid, calculateItemGridDimensions, generateId, findAvailablePosition } from '@/lib/gridfinity'

const STORAGE_KEY = 'gridfinity-drawer-planner'

const initialState: AppState = {
  config: CONFIG_DEFAULTS,
  drawers: [],
  items: [],
  selectedDrawerId: null,
  selectedItemId: null,
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_DRAWER': {
      const { gridCols, gridRows } = calculateDrawerGrid(
        action.payload.width,
        action.payload.depth,
        state.config
      )
      const newDrawer: Drawer = {
        ...action.payload,
        id: generateId(),
        gridCols,
        gridRows,
      }
      return {
        ...state,
        drawers: [...state.drawers, newDrawer],
        selectedDrawerId: newDrawer.id,
      }
    }

    case 'UPDATE_DRAWER': {
      const { gridCols, gridRows } = calculateDrawerGrid(
        action.payload.width,
        action.payload.depth,
        state.config
      )
      return {
        ...state,
        drawers: state.drawers.map(d =>
          d.id === action.payload.id 
            ? { ...action.payload, gridCols, gridRows }
            : d
        ),
      }
    }

    case 'DELETE_DRAWER': {
      // Unassign items from deleted drawer
      const updatedItems = state.items.map(item =>
        item.drawerId === action.payload
          ? { ...item, drawerId: null, gridX: 0, gridY: 0 }
          : item
      )
      return {
        ...state,
        drawers: state.drawers.filter(d => d.id !== action.payload),
        items: updatedItems,
        selectedDrawerId: state.selectedDrawerId === action.payload 
          ? null 
          : state.selectedDrawerId,
      }
    }

    case 'ADD_ITEM': {
      const newItem: Item = {
        ...action.payload,
        id: generateId(),
      }
      return {
        ...state,
        items: [...state.items, newItem],
        selectedItemId: newItem.id,
      }
    }

    case 'UPDATE_ITEM': {
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.payload.id ? action.payload : i
        ),
      }
    }

    case 'DELETE_ITEM': {
      return {
        ...state,
        items: state.items.filter(i => i.id !== action.payload),
        selectedItemId: state.selectedItemId === action.payload 
          ? null 
          : state.selectedItemId,
      }
    }

    case 'MOVE_ITEM': {
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.itemId
            ? {
                ...item,
                drawerId: action.payload.drawerId,
                gridX: action.payload.gridX,
                gridY: action.payload.gridY,
              }
            : item
        ),
      }
    }

    case 'UPDATE_CONFIG': {
      const newConfig = { ...state.config, ...action.payload }
      // Recalculate all drawer grids with new config
      const updatedDrawers = state.drawers.map(drawer => {
        const { gridCols, gridRows } = calculateDrawerGrid(
          drawer.width,
          drawer.depth,
          newConfig
        )
        return { ...drawer, gridCols, gridRows }
      })
      return {
        ...state,
        config: newConfig,
        drawers: updatedDrawers,
      }
    }

    case 'SET_SELECTED_DRAWER': {
      return {
        ...state,
        selectedDrawerId: action.payload,
      }
    }

    case 'SET_SELECTED_ITEM': {
      return {
        ...state,
        selectedItemId: action.payload,
      }
    }

    case 'DUPLICATE_DRAWER': {
      const src = state.drawers.find(d => d.id === action.payload)
      if (!src) return state
      const newId = generateId()
      const newDrawer: Drawer = { ...src, id: newId, name: `${src.name} (copy)` }
      const newItems = state.items
        .filter(i => i.drawerId === src.id)
        .map(i => ({ ...i, id: generateId(), drawerId: newId }))
      return {
        ...state,
        drawers: [...state.drawers, newDrawer],
        items: [...state.items, ...newItems],
        selectedDrawerId: newId,
      }
    }

    case 'DUPLICATE_ITEM': {
      const src = state.items.find(i => i.id === action.payload)
      if (!src) return state
      const drawer = src.drawerId ? state.drawers.find(d => d.id === src.drawerId) : null
      const srcDims = calculateItemGridDimensions(src, state.config)
      const pos = (drawer
        ? findAvailablePosition(srcDims, drawer, state.items, state.config)
        : null) ?? { gridX: src.gridX, gridY: src.gridY }
      const newItem: Item = { ...src, id: generateId(), name: `${src.name} (copy)`, ...pos }
      return {
        ...state,
        items: [...state.items, newItem],
        selectedItemId: newItem.id,
      }
    }

    case 'LOAD_STATE': {
      return action.payload
    }

    default:
      return state
  }
}

interface DrawerPlannerContextType {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  // Convenience actions
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
  getDrawerById: (id: string) => Drawer | undefined
  getItemById: (id: string) => Item | undefined
  getItemsInDrawer: (drawerId: string) => Item[]
  getUnassignedItems: () => Item[]
  exportData: () => ExportData
  importData: (data: ExportData) => void
}

const DrawerPlannerContext = createContext<DrawerPlannerContextType | null>(null)

function loadFromStorage(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return { ...initialState, ...JSON.parse(saved) }
    }
  } catch (e) {
    console.error('Failed to load saved state:', e)
  }
  return initialState
}

export function DrawerPlannerProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, loadFromStorage)

  // Save to localStorage on state change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const addDrawer = useCallback((drawer: Omit<Drawer, 'id' | 'gridCols' | 'gridRows'>) => {
    dispatch({ type: 'ADD_DRAWER', payload: drawer })
  }, [])

  const updateDrawer = useCallback((drawer: Drawer) => {
    dispatch({ type: 'UPDATE_DRAWER', payload: drawer })
  }, [])

  const deleteDrawer = useCallback((id: string) => {
    dispatch({ type: 'DELETE_DRAWER', payload: id })
  }, [])

  const duplicateDrawer = useCallback((id: string) => {
    dispatch({ type: 'DUPLICATE_DRAWER', payload: id })
  }, [])

  const addItem = useCallback((item: Omit<Item, 'id'>) => {
    dispatch({ type: 'ADD_ITEM', payload: item })
  }, [])

  const updateItem = useCallback((item: Item) => {
    dispatch({ type: 'UPDATE_ITEM', payload: item })
  }, [])

  const deleteItem = useCallback((id: string) => {
    dispatch({ type: 'DELETE_ITEM', payload: id })
  }, [])

  const duplicateItem = useCallback((id: string) => {
    dispatch({ type: 'DUPLICATE_ITEM', payload: id })
  }, [])

  const moveItem = useCallback((
    itemId: string, 
    drawerId: string | null, 
    gridX: number, 
    gridY: number
  ) => {
    dispatch({ type: 'MOVE_ITEM', payload: { itemId, drawerId, gridX, gridY } })
  }, [])

  const updateConfig = useCallback((config: Partial<GridfinityConfig>) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: config })
  }, [])

  const selectDrawer = useCallback((id: string | null) => {
    dispatch({ type: 'SET_SELECTED_DRAWER', payload: id })
  }, [])

  const selectItem = useCallback((id: string | null) => {
    dispatch({ type: 'SET_SELECTED_ITEM', payload: id })
  }, [])

  const getDrawerById = useCallback((id: string) => {
    return state.drawers.find(d => d.id === id)
  }, [state.drawers])

  const getItemById = useCallback((id: string) => {
    return state.items.find(i => i.id === id)
  }, [state.items])

  const getItemsInDrawer = useCallback((drawerId: string) => {
    return state.items.filter(item => item.drawerId === drawerId)
  }, [state.items])

  const getUnassignedItems = useCallback(() => {
    return state.items.filter(item => item.drawerId === null)
  }, [state.items])

  const exportData = useCallback((): ExportData => {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      config: state.config,
      drawers: state.drawers,
      items: state.items,
    }
  }, [state.config, state.drawers, state.items])

  const importData = useCallback((data: ExportData) => {
    if (data.version && data.drawers && data.items) {
      dispatch({
        type: 'LOAD_STATE',
        payload: {
          config: { ...CONFIG_DEFAULTS, ...data.config },
          drawers: data.drawers,
          items: data.items,
          selectedDrawerId: null,
          selectedItemId: null,
        },
      })
    }
  }, [])

  return (
    <DrawerPlannerContext.Provider
      value={{
        state,
        dispatch,
        addDrawer,
        updateDrawer,
        deleteDrawer,
        duplicateDrawer,
        addItem,
        updateItem,
        deleteItem,
        duplicateItem,
        moveItem,
        updateConfig,
        selectDrawer,
        selectItem,
        getDrawerById,
        getItemById,
        getItemsInDrawer,
        getUnassignedItems,
        exportData,
        importData,
      }}
    >
      {children}
    </DrawerPlannerContext.Provider>
  )
}

export function useDrawerPlanner() {
  const context = useContext(DrawerPlannerContext)
  if (!context) {
    throw new Error('useDrawerPlanner must be used within a DrawerPlannerProvider')
  }
  return context
}
