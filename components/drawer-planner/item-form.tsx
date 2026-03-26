'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDrawerStore } from '@/lib/store'
import { calculateItemGridDimensions, getRotatedDimensions } from '@/lib/gridfinity'
import { cn } from '@/lib/utils'
import type { Item, ItemRotation } from '@/lib/types'
import { ITEM_COLORS, toDisplayUnit, fromDisplayUnit } from '@/lib/types'
import { RotateCw } from 'lucide-react'

interface ItemFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: Item | null
  initialPosition?: { gridX: number; gridY: number } | null
  initialGridDimensions?: { cols: number; rows: number } | null
}

export function ItemForm({ open, onOpenChange, item, initialPosition, initialGridDimensions }: ItemFormProps) {
  const config = useDrawerStore(s => s.config)
  const drawers = useDrawerStore(s => s.drawers)
  const selectedDrawerId = useDrawerStore(s => s.selectedDrawerId)
  const addItem = useDrawerStore(s => s.addItem)
  const updateItem = useDrawerStore(s => s.updateItem)
  const isEditing = !!item

  const unit = config.displayUnit

  const [name, setName] = useState(item?.name ?? '')
  const [width, setWidth] = useState(
    item && item.width > 0 ? toDisplayUnit(item.width, unit).toString() : ''
  )
  const [height, setHeight] = useState(
    item && item.height > 0 ? toDisplayUnit(item.height, unit).toString() : ''
  )
  const [depth, setDepth] = useState(
    item && item.depth > 0 ? toDisplayUnit(item.depth, unit).toString() : ''
  )
  const [color, setColor] = useState(
    item?.color ?? ITEM_COLORS[Math.floor(Math.random() * ITEM_COLORS.length)]
  )
  const [rotation, setRotation] = useState<ItemRotation>(item?.rotation ?? 'normal')
  const [drawerId, setDrawerId] = useState<string | null>(item?.drawerId ?? selectedDrawerId)
  const [gridMode, setGridMode] = useState<'auto' | 'manual'>(item?.gridMode ?? 'manual')
  const [manualCols, setManualCols] = useState(
    item?.manualGridCols ?? initialGridDimensions?.cols ?? 1
  )
  const [manualRows, setManualRows] = useState(
    item?.manualGridRows ?? initialGridDimensions?.rows ?? 1
  )

  const handleGridModeChange = (newMode: 'auto' | 'manual') => {
    if (newMode === 'manual' && gridMode === 'auto') {
      // Seed manual dims from current computed dims
      const widthMm = fromDisplayUnit(parseFloat(width) || 0, unit)
      const heightMm = fromDisplayUnit(parseFloat(height) || 0, unit)
      const depthMm = fromDisplayUnit(parseFloat(depth) || 0, unit)
      if (widthMm > 0 && depthMm > 0) {
        const fakeItem = { id: '', name, width: widthMm, height: heightMm, depth: depthMm, color, rotation, drawerId, gridX: 0, gridY: 0, gridMode: 'auto' as const, locked: false }
        const dims = calculateItemGridDimensions(fakeItem, config)
        setManualCols(dims.gridWidth)
        setManualRows(dims.gridDepth)
      }
    }
    setGridMode(newMode)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) return

    const widthDisplay = parseFloat(width)
    const heightDisplay = parseFloat(height)
    const depthDisplay = parseFloat(depth)
    const widthMm = width ? fromDisplayUnit(widthDisplay, unit) : 0
    const heightMm = height ? fromDisplayUnit(heightDisplay, unit) : 0
    const depthMm = depth ? fromDisplayUnit(depthDisplay, unit) : 0

    // Auto mode requires all physical dimensions
    if (gridMode === 'auto') {
      if (isNaN(widthDisplay) || isNaN(heightDisplay) || isNaN(depthDisplay) ||
          widthMm <= 0 || heightMm <= 0 || depthMm <= 0) return
    }

    const itemData = {
      name: name.trim(),
      width: widthMm,
      height: heightMm,
      depth: depthMm,
      color,
      rotation,
      drawerId,
      gridMode,
      manualGridCols: manualCols,
      manualGridRows: manualRows,
    }

    if (isEditing && item) {
      updateItem({ ...item, ...itemData })
    } else {
      addItem({
        ...itemData,
        gridX: initialPosition?.gridX ?? 0,
        gridY: initialPosition?.gridY ?? 0,
      })
    }

    onOpenChange(false)
  }

  // Build preview item to compute grid dims and rotated dims
  const widthMm = fromDisplayUnit(parseFloat(width) || 0, unit)
  const heightMm = fromDisplayUnit(parseFloat(height) || 0, unit)
  const depthMm = fromDisplayUnit(parseFloat(depth) || 0, unit)
  const hasPhysical = widthMm > 0 && depthMm > 0

  const previewItem: Item = {
    id: 'preview',
    name,
    width: widthMm,
    height: heightMm,
    depth: depthMm,
    color,
    rotation,
    drawerId: null,
    gridX: 0,
    gridY: 0,
    gridMode,
    manualGridCols: manualCols,
    manualGridRows: manualRows,
    locked: false,
  }

  const previewDims = (gridMode === 'auto' ? hasPhysical : true)
    ? calculateItemGridDimensions(previewItem, config)
    : null

  const rotatedDims = hasPhysical ? getRotatedDimensions(previewItem) : null

  const rotationLabels: Record<ItemRotation, string> = {
    normal: 'Normal (upright)',
    layDown: 'Lay Down (on side)',
    rotated: 'Rotated 90°',
  }

  const autoInvalid = gridMode === 'auto' && (!width || !height || !depth)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Item' : 'Add Item'}</DialogTitle>
          <DialogDescription>
            {gridMode === 'manual'
              ? 'Set grid footprint directly. Physical dimensions are optional.'
              : `Enter the item's physical dimensions in ${unit}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Drawer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Screwdriver"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Drawer</Label>
              <Select
                value={drawerId || 'unassigned'}
                onValueChange={(v) => setDrawerId(v === 'unassigned' ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a drawer..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {drawers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Physical Dimensions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Physical Dimensions ({unit})</Label>
              {gridMode === 'manual' && (
                <span className="text-xs text-muted-foreground">optional</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="item-width" className="text-xs text-muted-foreground">Width</Label>
                <Input
                  id="item-width"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder={unit === 'cm' ? '3' : '30'}
                  required={gridMode === 'auto'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-height" className="text-xs text-muted-foreground">Height</Label>
                <Input
                  id="item-height"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder={unit === 'cm' ? '10' : '100'}
                  required={gridMode === 'auto'}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-depth" className="text-xs text-muted-foreground">Depth</Label>
                <Input
                  id="item-depth"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={depth}
                  onChange={(e) => setDepth(e.target.value)}
                  placeholder={unit === 'cm' ? '3' : '30'}
                  required={gridMode === 'auto'}
                />
              </div>
            </div>
          </div>

          {/* Color + Rotation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-1.5 flex-wrap">
                {ITEM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-md transition-all",
                      color === c && "ring-2 ring-offset-2 ring-offset-background ring-primary"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rotation</Label>
              <Select value={rotation} onValueChange={(v) => setRotation(v as ItemRotation)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="layDown">Lay Down</SelectItem>
                  <SelectItem value="rotated">Rotated 90°</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Grid Settings */}
          <div className="rounded-md bg-secondary/30 p-3 space-y-3">
            {/* Mode toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Grid Footprint</span>
              <div className="flex rounded-md border border-input overflow-hidden text-xs">
                <button
                  type="button"
                  className={cn(
                    "px-3 py-1 font-medium transition-colors",
                    gridMode === 'auto'
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  )}
                  onClick={() => handleGridModeChange('auto')}
                >
                  Auto
                </button>
                <button
                  type="button"
                  className={cn(
                    "px-3 py-1 font-medium border-l border-input transition-colors",
                    gridMode === 'manual'
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-accent"
                  )}
                  onClick={() => handleGridModeChange('manual')}
                >
                  Manual
                </button>
              </div>
            </div>

            {/* Grid dims: editable in manual, computed in auto */}
            {gridMode === 'manual' ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={manualCols}
                    onChange={(e) => setManualCols(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 h-7 text-center text-sm"
                  />
                  <span className="text-muted-foreground text-sm">×</span>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={manualRows}
                    onChange={(e) => setManualRows(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 h-7 text-center text-sm"
                  />
                  <span className="text-xs text-muted-foreground">cells</span>
                </div>
              </div>
            ) : previewDims ? (
              <p className="text-sm text-muted-foreground">
                Calculated: <span className="font-medium text-foreground">{previewDims.gridWidth} × {previewDims.gridDepth}</span> cells
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Fill physical dimensions above to see calculated grid size.
              </p>
            )}

            {/* Additional info */}
            {previewDims && previewDims.heightUnits > 0 && (
              <p className="text-sm text-muted-foreground">
                Height: <span className="font-medium text-foreground">{previewDims.heightUnits} U</span>
                {rotatedDims && <span className="text-xs ml-1">({rotatedDims.height}mm)</span>}
              </p>
            )}
            {gridMode === 'manual' && !hasPhysical && (
              <p className="text-xs text-muted-foreground">
                Add physical dimensions to see height units and inset visualization.
              </p>
            )}
            {previewDims && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <RotateCw className="h-3 w-3" />
                {rotationLabels[rotation]}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={autoInvalid && false}>
              {isEditing ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
