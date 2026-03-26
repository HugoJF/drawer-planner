import React, { useState, useEffect, useMemo } from 'react'
import { useDrawerStore } from '@/lib/store'
import { DrawerTree } from '@/components/drawer-planner/drawer-tree'
import { DrawerGrid } from '@/components/drawer-planner/drawer-grid'
import { SidebarStats } from '@/components/drawer-planner/sidebar-stats'
import { DrawerForm } from '@/components/drawer-planner/drawer-form'
import { ItemForm } from '@/components/drawer-planner/item-form'
import { SettingsPanel } from '@/components/drawer-planner/settings-panel'
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
import type { Drawer, Item, ItemRotation } from '@/lib/types'
import { formatDimension } from '@/lib/types'
import { cn } from '@/lib/utils'

function DashboardContent() {
  const selectedDrawerId = useDrawerStore(s => s.selectedDrawerId)
  const drawers = useDrawerStore(s => s.drawers)
  const config = useDrawerStore(s => s.config)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [drawerFormOpen, setDrawerFormOpen] = useState(false)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editingDrawer, setEditingDrawer] = useState<Drawer | null>(null)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [newItemPosition, setNewItemPosition] = useState<{ gridX: number; gridY: number } | null>(null)
  const [newItemGridDimensions, setNewItemGridDimensions] = useState<{ cols: number; rows: number } | null>(null)

  const undo = useDrawerStore(s => s.undo)
  const redo = useDrawerStore(s => s.redo)
  const canUndo = useDrawerStore(s => s.past.length > 0)
  const canRedo = useDrawerStore(s => s.future.length > 0)

  const selectedItemId = useDrawerStore(s => s.selectedItemId)
  const allItems = useDrawerStore(s => s.items)
  const deleteItem = useDrawerStore(s => s.deleteItem)
  const updateItem = useDrawerStore(s => s.updateItem)
  const selectedDrawer = useMemo(
    () => drawers.find(d => d.id === selectedDrawerId) ?? null,
    [drawers, selectedDrawerId]
  )
  const { toast } = useToast()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }

      if (!selectedItemId || drawerFormOpen || itemFormOpen) return
      const item = allItems.find(i => i.id === selectedItemId)
      if (!item) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteItem(selectedItemId)
      } else if ((e.key === 'e' || e.key === 'E') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setEditingItem(item)
        setNewItemPosition(null)
        setItemFormOpen(true)
      } else if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        const rotations: ItemRotation[] = ['normal', 'layDown', 'rotated']
        const next = rotations[(rotations.indexOf(item.rotation) + 1) % rotations.length]
        const isManual = (item.gridMode ?? 'auto') === 'manual'
        const shouldSwap = isManual && (item.rotation === 'rotated') !== (next === 'rotated')
        updateItem({
          ...item,
          rotation: next,
          ...(shouldSwap && { manualGridCols: item.manualGridRows ?? 1, manualGridRows: item.manualGridCols ?? 1 }),
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, selectedItemId, allItems, deleteItem, updateItem, drawerFormOpen, itemFormOpen])

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
          "flex flex-col border-r border-border bg-card/50 transition-all duration-300",
          sidebarOpen ? "w-64" : "w-0"
        )}
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4" />
            </Button>
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
        <div className="flex-1 overflow-auto p-4">
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
      <Toaster />
    </div>
  )
}

export default function Page() {
  return <DashboardContent />
}
