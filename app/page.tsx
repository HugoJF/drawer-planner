import React, { useState } from 'react'
import { DrawerPlannerProvider, useDrawerPlanner } from '@/components/drawer-planner/drawer-planner-provider'
import { DrawerTree } from '@/components/drawer-planner/drawer-tree'
import { DrawerGrid } from '@/components/drawer-planner/drawer-grid'
import { SidebarStats } from '@/components/drawer-planner/sidebar-stats'
import { DrawerForm } from '@/components/drawer-planner/drawer-form'
import { ItemForm } from '@/components/drawer-planner/item-form'
import { SettingsPanel } from '@/components/drawer-planner/settings-panel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Plus, 
  FolderPlus, 
  Package, 
  PanelLeftClose, 
  PanelLeft,
  Grid3X3,
} from 'lucide-react'
import type { Drawer, Item } from '@/lib/types'
import { formatDimension } from '@/lib/types'
import { cn } from '@/lib/utils'

function DashboardContent() {
  const { state, getDrawerById } = useDrawerPlanner()
  
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [drawerFormOpen, setDrawerFormOpen] = useState(false)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [editingDrawer, setEditingDrawer] = useState<Drawer | null>(null)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [newItemPosition, setNewItemPosition] = useState<{ gridX: number; gridY: number } | null>(null)
  const [newItemDimensions, setNewItemDimensions] = useState<{ width: number; depth: number } | null>(null)

  const selectedDrawer = state.selectedDrawerId 
    ? getDrawerById(state.selectedDrawerId) 
    : null

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
    setNewItemDimensions(null)
    setItemFormOpen(true)
  }

  const handleAddItemAtCell = (gridX: number, gridY: number, initialWidth?: number, initialDepth?: number) => {
    setEditingItem(null)
    setNewItemPosition({ gridX, gridY })
    setNewItemDimensions(initialWidth && initialDepth ? { width: initialWidth, depth: initialDepth } : null)
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
                    {formatDimension(selectedDrawer.width, state.config.displayUnit)} ×{' '}
                    {formatDimension(selectedDrawer.depth, state.config.displayUnit)} ×{' '}
                    {formatDimension(selectedDrawer.height, state.config.displayUnit)}
                  </span>
                </div>
              ) : (
                <h1 className="text-lg font-semibold">Gridfinity Drawer Planner</h1>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <SettingsPanel />
            <Separator orientation="vertical" className="h-6" />
            <Button variant="outline" size="sm" className="gap-2" onClick={handleAddDrawer}>
              <FolderPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Drawer</span>
            </Button>
            <Button size="sm" className="gap-2" onClick={handleAddItem}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Item</span>
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {selectedDrawer ? (
              <div className="space-y-4">
                {/* Grid Visualization */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Grid Layout</CardTitle>
                    <CardDescription>
                      Drag items to organize. Double-click empty cells to add items. Double-click items to edit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DrawerGrid
                      drawer={selectedDrawer}
                      onEditDrawer={handleEditDrawer}
                      onEditItem={handleEditItem}
                      onAddItemAtCell={handleAddItemAtCell}
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Card className="max-w-md w-full">
                  <CardContent className="pt-6 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Drawer Selected</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {state.drawers.length === 0 
                        ? "Get started by adding your first drawer."
                        : "Select a drawer from the sidebar to view its contents."}
                    </p>
                    {state.drawers.length === 0 && (
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
        </ScrollArea>
      </main>

      {/* Dialogs */}
      <DrawerForm 
        open={drawerFormOpen}
        onOpenChange={setDrawerFormOpen}
        drawer={editingDrawer}
      />
      <ItemForm
        open={itemFormOpen}
        onOpenChange={setItemFormOpen}
        item={editingItem}
        initialPosition={newItemPosition}
        initialDimensions={newItemDimensions}
      />
    </div>
  )
}

export default function Page() {
  return (
    <DrawerPlannerProvider>
      <DashboardContent />
    </DrawerPlannerProvider>
  )
}
