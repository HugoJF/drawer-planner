import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useDrawerStore } from '@/lib/store'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut'
import { DrawerTree } from '@/components/drawer-planner/drawer-tree'
import { DrawerGrid } from '@/components/drawer-planner/drawer-grid'
import { SidebarStats } from '@/components/drawer-planner/sidebar-stats'
import { DrawerForm } from '@/components/drawer-planner/drawer-form'
import { ItemForm } from '@/components/drawer-planner/item-form'
import { SettingsPanel } from '@/components/drawer-planner/settings-panel'
import { ShortcutsDialog } from '@/components/drawer-planner/shortcuts-dialog'
import { HistoryPanel } from '@/components/drawer-planner/history-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  FolderPlus,
  Package,
  PanelLeftClose,
  PanelLeft,
  Grid3X3,
  Undo2,
  Redo2,
} from 'lucide-react'
import type { Drawer, Item } from '@/lib/types'
import { formatDimension } from '@/lib/types'
import { cn } from '@/lib/utils'
import { calculateItemGridDimensions, applyNextRotation } from '@/lib/gridfinity'
import { labelAction } from '@/lib/history'

function DashboardContent() {
  // Store — data
  const selectedDrawerId = useDrawerStore(s => s.selectedDrawerId)
  const drawers          = useDrawerStore(s => s.drawers)
  const config           = useDrawerStore(s => s.config)
  const past             = useDrawerStore(s => s.past)
  const future           = useDrawerStore(s => s.future)
  const selectedItemIds  = useDrawerStore(s => s.selectedItemIds)
  const allItems         = useDrawerStore(s => s.items)
  const categories       = useDrawerStore(s => s.categories)

  // Store — actions
  const undo             = useDrawerStore(s => s.undo)
  const redo             = useDrawerStore(s => s.redo)
  const deleteItem       = useDrawerStore(s => s.deleteItem)
  const deleteItems      = useDrawerStore(s => s.deleteItems)
  const duplicateItem    = useDrawerStore(s => s.duplicateItem)
  const updateItem       = useDrawerStore(s => s.updateItem)
  const selectItems      = useDrawerStore(s => s.selectItems)
  const moveItem         = useDrawerStore(s => s.moveItem)
  const repositionItems  = useDrawerStore(s => s.repositionItems)

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return 288
    return parseInt(localStorage.getItem('sidebarWidth') ?? '288', 10)
  })
  const [drawerFormOpen, setDrawerFormOpen] = useState(false)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editingDrawer, setEditingDrawer] = useState<Drawer | null>(null)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [newItemPosition, setNewItemPosition] = useState<{ gridX: number; gridY: number } | null>(null)
  const [newItemGridDimensions, setNewItemGridDimensions] = useState<{ cols: number; rows: number } | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Derived
  const canUndo = past.length > 0
  const canRedo = future.length > 0

  const selectedDrawer = useMemo(
    () => drawers.find(d => d.id === selectedDrawerId) ?? null,
    [drawers, selectedDrawerId]
  )
  const undoLabel = useMemo(
    () => canUndo ? labelAction(past[past.length - 1], { drawers, items: allItems, categories, config, selectedDrawerId, selectedItemIds }) : null,
    [canUndo, past, drawers, allItems, categories, config, selectedDrawerId, selectedItemIds]
  )
  const redoLabel = useMemo(
    () => canRedo ? labelAction({ drawers, items: allItems, categories, config, selectedDrawerId, selectedItemIds }, future[0]) : null,
    [canRedo, future, drawers, allItems, categories, config, selectedDrawerId, selectedItemIds]
  )

  const { toast } = useToast()
  const isResizing = useRef(false)

  const isFormOpen = drawerFormOpen || itemFormOpen
  const hasSelection = selectedItemIds.size > 0
  const singleSelected = selectedItemIds.size === 1

  // Undo / redo — always active
  useKeyboardShortcut({ key: 'z', ctrl: true }, undo)
  useKeyboardShortcut({ key: 'y', ctrl: true }, redo)
  useKeyboardShortcut({ key: 'z', ctrl: true, shift: true }, redo)

  // Select all items in the current drawer
  useKeyboardShortcut({ key: 'a', ctrl: true, enabled: !isFormOpen }, useCallback(() => {
    if (selectedDrawerId)
      selectItems(allItems.filter(i => i.drawerId === selectedDrawerId).map(i => i.id))
  }, [selectedDrawerId, allItems, selectItems]))

  // Open keyboard shortcuts cheatsheet
  useKeyboardShortcut({ key: '?', enabled: !isFormOpen }, useCallback(() => {
    setShortcutsOpen(true)
  }, []))

  // Delete selected item(s)
  const deleteSelected = useCallback(() => {
    const ids = [...selectedItemIds]
    ids.length === 1 ? deleteItem(ids[0]) : deleteItems(ids)
  }, [selectedItemIds, deleteItem, deleteItems])
  useKeyboardShortcut({ key: 'Delete',    enabled: !isFormOpen && hasSelection }, deleteSelected)
  useKeyboardShortcut({ key: 'Backspace', enabled: !isFormOpen && hasSelection }, deleteSelected)

  // Duplicate selected item (single selection)
  useKeyboardShortcut({ key: 'd', enabled: !isFormOpen && singleSelected }, useCallback(() => {
    const placed = duplicateItem([...selectedItemIds][0])
    if (!placed) toast({ title: 'No space available', description: 'Item was placed at the same position as the original.' })
  }, [selectedItemIds, duplicateItem, toast]))

  // Edit selected item (single selection)
  useKeyboardShortcut({ key: 'e', enabled: !isFormOpen && singleSelected }, useCallback(() => {
    const item = allItems.find(i => i.id === [...selectedItemIds][0])
    if (!item) return
    setEditingItem(item)
    setNewItemPosition(null)
    setItemFormOpen(true)
  }, [allItems, selectedItemIds]))

  // Cycle rotation of selected item (single selection)
  useKeyboardShortcut({ key: 'r', enabled: !isFormOpen && singleSelected }, useCallback(() => {
    const item = allItems.find(i => i.id === [...selectedItemIds][0])
    if (!item) return
    updateItem({ ...item, ...applyNextRotation(item) })
  }, [allItems, selectedItemIds, updateItem]))

  // Move selected item(s) by one grid cell, clamped to drawer bounds
  const moveSelected = useCallback((dx: number, dy: number) => {
    if (!selectedDrawer) return
    const drawerItems = allItems.filter(i => selectedItemIds.has(i.id) && i.drawerId === selectedDrawerId)
    if (drawerItems.length === 0) return
    const clampedPos = (item: Item, dx: number, dy: number) => {
      const dims = calculateItemGridDimensions(item, config)
      return {
        id: item.id,
        drawerId: item.drawerId,
        gridX: Math.max(0, Math.min(selectedDrawer.gridCols - dims.gridWidth,  item.gridX + dx)),
        gridY: Math.max(0, Math.min(selectedDrawer.gridRows - dims.gridDepth, item.gridY + dy)),
      }
    }
    if (drawerItems.length === 1) {
      const { id, drawerId, gridX, gridY } = clampedPos(drawerItems[0], dx, dy)
      moveItem(id, drawerId, gridX, gridY)
    } else {
      repositionItems(drawerItems.map(item => clampedPos(item, dx, dy)))
    }
  }, [selectedDrawer, allItems, selectedItemIds, selectedDrawerId, config, moveItem, repositionItems])

  useKeyboardShortcut({ key: 'ArrowUp',    enabled: !isFormOpen && hasSelection }, useCallback(() => moveSelected( 0, -1), [moveSelected]))
  useKeyboardShortcut({ key: 'ArrowDown',  enabled: !isFormOpen && hasSelection }, useCallback(() => moveSelected( 0,  1), [moveSelected]))
  useKeyboardShortcut({ key: 'ArrowLeft',  enabled: !isFormOpen && hasSelection }, useCallback(() => moveSelected(-1,  0), [moveSelected]))
  useKeyboardShortcut({ key: 'ArrowRight', enabled: !isFormOpen && hasSelection }, useCallback(() => moveSelected( 1,  0), [moveSelected]))

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const width = Math.min(480, Math.max(180, startWidth + e.clientX - startX))
      setSidebarWidth(width)
    }
    const onUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth))
  }, [sidebarWidth])

  const handleAddDrawer = () => {
    setEditingDrawer(null)
    setDrawerFormOpen(true)
  }

  const handleEditDrawer = (drawer: Drawer) => {
    setEditingDrawer(drawer)
    setDrawerFormOpen(true)
  }

  const handleAddItem = () => {
    setEditingItem(null)
    setNewItemPosition(null)
    setNewItemGridDimensions(null)
    setItemFormOpen(true)
  }

  const handleAddItemAtCell = (gridX: number, gridY: number, initialCols?: number, initialRows?: number) => {
    setEditingItem(null)
    setNewItemPosition({ gridX, gridY })
    setNewItemGridDimensions(initialCols && initialRows ? { cols: initialCols, rows: initialRows } : null)
    setItemFormOpen(true)
  }

  const handleEditItem = (item: Item) => {
    setEditingItem(item)
    setNewItemPosition(null)
    setItemFormOpen(true)
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "relative flex flex-col border-r border-border bg-card/50",
          sidebarOpen ? "" : "w-0 overflow-hidden"
        )}
        style={sidebarOpen ? { width: sidebarWidth } : undefined}
      >
        {sidebarOpen && (
          <>
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h2 className="text-sm font-semibold">Organization</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSidebarOpen(false)}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DrawerTree
                onEditDrawer={handleEditDrawer}
                onEditItem={handleEditItem}
                onAddDrawer={handleAddDrawer}
              />
            </div>
            {/* Sidebar Stats at bottom */}
            <SidebarStats />
            {/* Resize handle */}
            <div
              className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
              onMouseDown={handleResizeStart}
            />
          </>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/30">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5 text-primary" />
              {selectedDrawer ? (
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold">{selectedDrawer.name}</h1>
                  <span className="text-sm text-muted-foreground">
                    {formatDimension(selectedDrawer.width, config.displayUnit)} ×{' '}
                    {formatDimension(selectedDrawer.depth, config.displayUnit)} ×{' '}
                    {formatDimension(selectedDrawer.height, config.displayUnit)}
                  </span>
                </div>
              ) : (
                <h1 className="text-lg font-semibold">Gridfinity Drawer Planner</h1>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={!canUndo}
              title={undoLabel ? `Undo: ${undoLabel}` : 'Undo'}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={!canRedo}
              title={redoLabel ? `Redo: ${redoLabel}` : 'Redo'}>
              <Redo2 className="h-4 w-4" />
            </Button>
            <HistoryPanel />
            <Separator orientation="vertical" className="h-6" />
            <SettingsPanel />
            <Separator orientation="vertical" className="h-6" />
            <Button variant="outline" size="sm" className="gap-2" onClick={handleAddDrawer}>
              <FolderPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Drawer</span>
            </Button>
            <Button size="sm" className="gap-2" onClick={handleAddItem} disabled={!selectedDrawerId}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Item</span>
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-hidden p-4">
            {selectedDrawer ? (
              <DrawerGrid
                drawer={selectedDrawer}
                onEditDrawer={handleEditDrawer}
                onEditItem={handleEditItem}
                onAddItemAtCell={handleAddItemAtCell}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Card className="max-w-md w-full">
                  <CardContent className="pt-6 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Drawer Selected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {drawers.length === 0
                        ? "Get started by adding your first drawer."
                        : "Select a drawer from the sidebar to view its contents."}
                    </p>
                    {drawers.length === 0 && (
                      <Button onClick={handleAddDrawer} className="gap-2">
                        <FolderPlus className="h-4 w-4" />
                        Add Your First Drawer
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
        </div>
      </main>

      {/* Dialogs */}
      <DrawerForm
        key={drawerFormOpen ? (editingDrawer?.id ?? 'new') : 'closed'}
        open={drawerFormOpen}
        onOpenChange={setDrawerFormOpen}
        drawer={editingDrawer}
      />
      <ItemForm
        key={itemFormOpen ? (editingItem?.id ?? 'new') : 'closed'}
        open={itemFormOpen}
        onOpenChange={setItemFormOpen}
        item={editingItem}
        initialPosition={newItemPosition}
        initialGridDimensions={newItemGridDimensions}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <Toaster />
    </div>
  )
}

export default function Page() {
  return <DashboardContent />
}
