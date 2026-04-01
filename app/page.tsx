import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useDrawerStore } from '@/lib/store'
import { useProjectsStore } from '@/lib/projects-store'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut'
import { SHORTCUTS } from '@/lib/shortcuts'
import { DrawerTree } from '@/components/drawer-planner/drawer-tree'
import { DrawerGrid } from '@/components/drawer-planner/drawer-grid'
import { SidebarStats } from '@/components/drawer-planner/sidebar-stats'
import { DrawerForm } from '@/components/drawer-planner/drawer-form'
import { ItemForm } from '@/components/drawer-planner/item-form'
import { SettingsPanel } from '@/components/drawer-planner/settings-panel'
import { ShortcutsDialog } from '@/components/drawer-planner/shortcuts-dialog'
import { HistoryPanel } from '@/components/drawer-planner/history-panel'
import { ProjectWizard } from '@/components/drawer-planner/project-wizard'
import { ProjectSelect } from '@/components/drawer-planner/project-select'
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
  const projects = useProjectsStore(s => s.projects)

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
  const addItems         = useDrawerStore(s => s.addItems)

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
  const clipboard = useRef<Item[]>([])

  const isFormOpen = drawerFormOpen || itemFormOpen
  const hasSelection = selectedItemIds.size > 0
  const singleSelected = selectedItemIds.size === 1

  // Undo / redo — always active
  useKeyboardShortcut(SHORTCUTS.undo, undo)
  useKeyboardShortcut(SHORTCUTS.redo, redo)
  useKeyboardShortcut(SHORTCUTS.redoAlt, redo)

  // Select all items in the current drawer
  useKeyboardShortcut({ ...SHORTCUTS.selectAll, enabled: !isFormOpen }, useCallback(() => {
    if (selectedDrawerId)
      selectItems(allItems.filter(i => i.drawerId === selectedDrawerId).map(i => i.id))
  }, [selectedDrawerId, allItems, selectItems]))

  // Open keyboard shortcuts cheatsheet
  useKeyboardShortcut({ ...SHORTCUTS.shortcuts, enabled: !isFormOpen }, useCallback(() => {
    setShortcutsOpen(true)
  }, []))

  // Copy selected items into clipboard
  useKeyboardShortcut({ ...SHORTCUTS.copy, enabled: !isFormOpen && hasSelection }, useCallback(() => {
    clipboard.current = allItems.filter(i => selectedItemIds.has(i.id))
  }, [allItems, selectedItemIds]))

  // Paste clipboard items into the active drawer
  useKeyboardShortcut({ ...SHORTCUTS.paste, enabled: !isFormOpen }, useCallback(() => {
    const items = clipboard.current
    if (!items.length || !selectedDrawerId || !selectedDrawer) return

    // Normalize positions relative to the group's top-left corner
    const minX = Math.min(...items.map(i => i.gridX))
    const minY = Math.min(...items.map(i => i.gridY))

    // Compute bounding box of the group (in grid cells)
    const groupW = Math.max(...items.map(i => {
      const d = calculateItemGridDimensions(i, config)
      return (i.gridX - minX) + d.gridWidth
    }))
    const groupH = Math.max(...items.map(i => {
      const d = calculateItemGridDimensions(i, config)
      return (i.gridY - minY) + d.gridDepth
    }))

    // Build occupied-cell set from items already in this drawer
    const occupied = new Set<string>()
    for (const item of allItems) {
      if (item.drawerId !== selectedDrawerId) continue
      const d = calculateItemGridDimensions(item, config)
      for (let x = item.gridX; x < item.gridX + d.gridWidth; x++)
        for (let y = item.gridY; y < item.gridY + d.gridDepth; y++)
          occupied.add(`${x},${y}`)
    }

    // Scan for a free origin that fits the entire group
    let origin: { x: number; y: number } | null = null
    outer: for (let oy = 0; oy <= selectedDrawer.gridRows - groupH; oy++) {
      for (let ox = 0; ox <= selectedDrawer.gridCols - groupW; ox++) {
        const clear = items.every(item => {
          const d = calculateItemGridDimensions(item, config)
          const rx = item.gridX - minX, ry = item.gridY - minY
          for (let x = ox + rx; x < ox + rx + d.gridWidth; x++)
            for (let y = oy + ry; y < oy + ry + d.gridDepth; y++)
              if (occupied.has(`${x},${y}`)) return false
          return true
        })
        if (clear) { origin = { x: ox, y: oy }; break outer }
      }
    }

    const ox = origin?.x ?? 0
    const oy = origin?.y ?? 0

    addItems(items.map(item => ({
      ...item,
      drawerId: selectedDrawerId,
      gridX: ox + (item.gridX - minX),
      gridY: oy + (item.gridY - minY),
    })))

    if (!origin) toast({ title: 'No space available', description: 'Items pasted at origin — check for overlaps.' })
  }, [selectedDrawerId, selectedDrawer, allItems, config, addItems, toast]))

  // Delete selected item(s)
  const deleteSelected = useCallback(() => {
    const ids = [...selectedItemIds]
    ids.length === 1 ? deleteItem(ids[0]) : deleteItems(ids)
  }, [selectedItemIds, deleteItem, deleteItems])
  useKeyboardShortcut({ ...SHORTCUTS.delete,    enabled: !isFormOpen && hasSelection }, deleteSelected)
  useKeyboardShortcut({ ...SHORTCUTS.backspace, enabled: !isFormOpen && hasSelection }, deleteSelected)

  // Duplicate selected item (single selection)
  useKeyboardShortcut({ ...SHORTCUTS.duplicate, enabled: !isFormOpen && singleSelected }, useCallback(() => {
    const placed = duplicateItem([...selectedItemIds][0])
    if (!placed) toast({ title: 'No space available', description: 'Item was placed at the same position as the original.' })
  }, [selectedItemIds, duplicateItem, toast]))

  // Edit selected item (single selection)
  useKeyboardShortcut({ ...SHORTCUTS.edit, enabled: !isFormOpen && singleSelected }, useCallback(() => {
    const item = allItems.find(i => i.id === [...selectedItemIds][0])
    if (!item) return
    setEditingItem(item)
    setNewItemPosition(null)
    setItemFormOpen(true)
  }, [allItems, selectedItemIds]))

  // Cycle rotation of selected item (single selection)
  useKeyboardShortcut({ ...SHORTCUTS.rotate, enabled: !isFormOpen && singleSelected }, useCallback(() => {
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

  useKeyboardShortcut({ ...SHORTCUTS.moveUp,    enabled: !isFormOpen && hasSelection }, useCallback(() => moveSelected( 0, -1), [moveSelected]))
  useKeyboardShortcut({ ...SHORTCUTS.moveDown,  enabled: !isFormOpen && hasSelection }, useCallback(() => moveSelected( 0,  1), [moveSelected]))
  useKeyboardShortcut({ ...SHORTCUTS.moveLeft,  enabled: !isFormOpen && hasSelection }, useCallback(() => moveSelected(-1,  0), [moveSelected]))
  useKeyboardShortcut({ ...SHORTCUTS.moveRight, enabled: !isFormOpen && hasSelection }, useCallback(() => moveSelected( 1,  0), [moveSelected]))

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

  if (projects.length === 0) return <ProjectWizard />

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
            {(config.showSidebarStats ?? true) && <SidebarStats />}
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
              <ProjectSelect />
              {selectedDrawer && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{selectedDrawer.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDimension(selectedDrawer.width, config.displayUnit)} ×{' '}
                      {formatDimension(selectedDrawer.depth, config.displayUnit)} ×{' '}
                      {formatDimension(selectedDrawer.height, config.displayUnit)}
                    </span>
                  </div>
                </>
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
