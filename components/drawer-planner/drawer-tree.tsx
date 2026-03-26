'use client'

import React, { useState } from 'react'
import { 
  ChevronRight,
  ChevronDown,
  Package,
  Box,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertTriangle,
  ArrowRightLeft,
  Copy
} from 'lucide-react'
import { useDrawerStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { isItemOversized, getRotatedDimensions } from '@/lib/gridfinity'
import { formatDimension } from '@/lib/types'
import type { Drawer, Item, DimensionUnit } from '@/lib/types'
import { DeleteConfirmDialog } from '@/components/drawer-planner/delete-confirm-dialog'

interface DrawerTreeProps {
  onEditDrawer: (drawer: Drawer) => void
  onEditItem: (item: Item) => void
}

export function DrawerTree({ onEditDrawer, onEditItem }: DrawerTreeProps) {
  const drawers = useDrawerStore(s => s.drawers)
  const selectedDrawerId = useDrawerStore(s => s.selectedDrawerId)
  const selectedItemId = useDrawerStore(s => s.selectedItemId)
  const selectDrawer = useDrawerStore(s => s.selectDrawer)
  const selectItem = useDrawerStore(s => s.selectItem)
  const deleteDrawer = useDrawerStore(s => s.deleteDrawer)
  const duplicateDrawer = useDrawerStore(s => s.duplicateDrawer)
  const deleteItem = useDrawerStore(s => s.deleteItem)
  const duplicateItem = useDrawerStore(s => s.duplicateItem)
  const moveItem = useDrawerStore(s => s.moveItem)
  const getItemsInDrawer = useDrawerStore(s => s.getItemsInDrawer)
  const getUnassignedItems = useDrawerStore(s => s.getUnassignedItems)
  const config = useDrawerStore(s => s.config)

  const [expandedDrawers, setExpandedDrawers] = useState<Set<string>>(new Set())
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<{ type: 'drawer' | 'item'; id: string; name: string } | null>(null)

  const toggleDrawer = (id: string) => {
    setExpandedDrawers(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDragStart = (e: React.DragEvent, itemId: string) => {
    e.dataTransfer.setData('text/plain', itemId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem(itemId)
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDropOnDrawer = (e: React.DragEvent, drawerId: string | null) => {
    e.preventDefault()
    const itemId = e.dataTransfer.getData('text/plain')
    if (itemId) {
      moveItem(itemId, drawerId, 0, 0)
    }
    setDraggedItem(null)
  }

  const unassignedItems = getUnassignedItems()

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1 mb-2">
          Drawers
        </div>
        
        {drawers.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No drawers yet. Add one to get started.
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {drawers.map(drawer => {
              const drawerItems = getItemsInDrawer(drawer.id)
              const isExpanded = expandedDrawers.has(drawer.id)
              const isSelected = selectedDrawerId === drawer.id
              const hasOversizedItems = drawerItems.some(item => isItemOversized(item, drawer))

              return (
                <Collapsible 
                  key={drawer.id} 
                  open={isExpanded}
                  onOpenChange={() => toggleDrawer(drawer.id)}
                >
                  <div
                    className={cn(
                      "group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer",
                      "hover:bg-accent/50 transition-colors",
                      isSelected && "bg-accent",
                      draggedItem && "transition-all"
                    )}
                    onClick={() => selectDrawer(drawer.id)}
                    onDoubleClick={() => onEditDrawer(drawer)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnDrawer(e, drawer.id)}
                  >
                    <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <button className="p-0.5 rounded hover:bg-accent">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    
                    <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    
                    <span className="flex-1 truncate text-sm">{drawer.name}</span>
                    
                    {hasOversizedItems && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          Contains items that exceed drawer height
                        </TooltipContent>
                      </Tooltip>
                    )}
                    
                    <span className="text-xs text-muted-foreground">
                      {drawerItems.length}
                    </span>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity">
                          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => onEditDrawer(drawer)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateDrawer(drawer.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setPendingDelete({ type: 'drawer', id: drawer.id, name: drawer.name })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CollapsibleContent>
                    <div className="ml-4 pl-2 border-l border-border/50 flex flex-col gap-0.5 py-0.5">
                      {drawerItems.length === 0 ? (
                        <div className="px-2 py-1 text-xs text-muted-foreground italic">
                          No items
                        </div>
                      ) : (
                        drawerItems.map(item => (
                          <TreeItem
                            key={item.id}
                            item={item}
                            drawer={drawer}
                            isSelected={selectedItemId === item.id}
                            isDragging={draggedItem === item.id}
                            onSelect={() => {
                              selectDrawer(drawer.id)
                              selectItem(item.id)
                            }}
                            onEdit={() => onEditItem(item)}
                            onDuplicate={() => duplicateItem(item.id)}
                            onDelete={() => setPendingDelete({ type: 'item', id: item.id, name: item.name })}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            allDrawers={drawers}
                            onMoveToDrawer={(drawerId) => moveItem(item.id, drawerId, 0, 0)}
                            displayUnit={config.displayUnit}
                          />
                        ))
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </div>
        )}

        {/* Unassigned Items */}
        <div className="mt-4">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1 mb-2">
            Unassigned Items
          </div>
          
          <div
            className={cn(
              "rounded-md border border-dashed border-border/50 min-h-[60px] p-1",
              draggedItem && "border-primary/50 bg-primary/5"
            )}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropOnDrawer(e, null)}
          >
            {unassignedItems.length === 0 ? (
              <div className="flex items-center justify-center h-[52px] text-xs text-muted-foreground">
                Drop items here to unassign
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {unassignedItems.map(item => (
                  <TreeItem
                    key={item.id}
                    item={item}
                    drawer={null}
                    isSelected={selectedItemId === item.id}
                    isDragging={draggedItem === item.id}
                    onSelect={() => selectItem(item.id)}
                    onEdit={() => onEditItem(item)}
                    onDuplicate={() => duplicateItem(item.id)}
                    onDelete={() => setPendingDelete({ type: 'item', id: item.id, name: item.name })}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    allDrawers={drawers}
                    onMoveToDrawer={(drawerId) => moveItem(item.id, drawerId, 0, 0)}
                    displayUnit={config.displayUnit}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        type={pendingDelete?.type ?? 'item'}
        name={pendingDelete?.name ?? ''}
        onConfirm={() => {
          if (!pendingDelete) return
          if (pendingDelete.type === 'drawer') deleteDrawer(pendingDelete.id)
          else deleteItem(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </ScrollArea>
  )
}

interface TreeItemProps {
  item: Item
  drawer: Drawer | null
  isSelected: boolean
  isDragging: boolean
  onSelect: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent, itemId: string) => void
  onDragEnd: () => void
  allDrawers: Drawer[]
  onMoveToDrawer: (drawerId: string | null) => void
  displayUnit: DimensionUnit
}

function TreeItem({
  item,
  drawer,
  isSelected,
  isDragging,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onDragStart,
  onDragEnd,
  allDrawers,
  onMoveToDrawer,
  displayUnit,
}: TreeItemProps) {
  const isOversized = drawer ? isItemOversized(item, drawer) : false

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer",
        "hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent",
        isDragging && "opacity-50",
        isOversized && "text-destructive"
      )}
      onClick={onSelect}
      onDoubleClick={onEdit}
    >
      <div 
        className="h-3 w-3 rounded-sm shrink-0" 
        style={{ backgroundColor: item.color }}
      />
      
      <Box className={cn(
        "h-3.5 w-3.5 shrink-0",
        isOversized ? "text-destructive" : "text-muted-foreground"
      )} />
      
      <span className="flex-1 truncate text-sm">{item.name}</span>
      
      {isOversized && drawer && (
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="right">
            Item height ({formatDimension(getRotatedDimensions(item).height, displayUnit)}) exceeds drawer height ({formatDimension(drawer.height, displayUnit)})
          </TooltipContent>
        </Tooltip>
      )}
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity">
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent sideOffset={2} alignOffset={-5} className="max-h-60 overflow-auto">
              <DropdownMenuItem 
                onClick={() => onMoveToDrawer(null)}
                disabled={!item.drawerId}
              >
                <Package className="h-4 w-4 mr-2" />
                Unassigned
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {allDrawers.map(d => (
                <DropdownMenuItem
                  key={d.id}
                  onClick={() => onMoveToDrawer(d.id)}
                  disabled={d.id === item.drawerId}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  {d.name}
                  {isItemOversized(item, d) && (
                    <AlertTriangle className="h-3 w-3 text-destructive ml-auto" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
