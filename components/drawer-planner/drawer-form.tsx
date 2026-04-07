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
import { Switch } from '@/components/ui/switch'
import { useDrawerStore } from '@/lib/store'
import { calculateDrawerGrid } from '@/lib/gridfinity'
import type { Drawer } from '@/lib/types'
import { toDisplayUnit, fromDisplayUnit } from '@/lib/types'

interface DrawerFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawer?: Drawer | null
}

export function DrawerForm({ open, onOpenChange, drawer }: DrawerFormProps) {
  const config = useDrawerStore(s => s.config)
  const addDrawer = useDrawerStore(s => s.addDrawer)
  const updateDrawer = useDrawerStore(s => s.updateDrawer)
  const isEditing = !!drawer

  const unit = config.displayUnit

  const [name, setName] = useState(drawer?.name ?? '')
  const [width, setWidth] = useState(drawer ? toDisplayUnit(drawer.width, unit).toString() : '')
  const [height, setHeight] = useState(drawer ? toDisplayUnit(drawer.height, unit).toString() : '')
  const [depth, setDepth] = useState(drawer ? toDisplayUnit(drawer.depth, unit).toString() : '')
  const [gridless, setGridless] = useState(drawer?.gridless ?? false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const widthDisplay = parseFloat(width)
    const heightDisplay = parseFloat(height)
    const depthDisplay = parseFloat(depth)

    if (!name || isNaN(widthDisplay) || isNaN(heightDisplay) || isNaN(depthDisplay)) {
      return
    }

    // Convert to mm for storage
    const widthMm = fromDisplayUnit(widthDisplay, unit)
    const heightMm = fromDisplayUnit(heightDisplay, unit)
    const depthMm = fromDisplayUnit(depthDisplay, unit)

    if (isEditing && drawer) {
      const { gridCols, gridRows } = calculateDrawerGrid(widthMm, depthMm, config)
      updateDrawer({
        ...drawer,
        name,
        width: widthMm,
        height: heightMm,
        depth: depthMm,
        gridCols,
        gridRows,
        gridless,
      })
    } else {
      addDrawer({
        name,
        width: widthMm,
        height: heightMm,
        depth: depthMm,
        gridless,
      })
    }

    onOpenChange(false)
  }

  // Calculate preview grid (convert display unit to mm)
  const previewWidthDisplay = parseFloat(width) || 0
  const previewDepthDisplay = parseFloat(depth) || 0
  const previewWidthMm = fromDisplayUnit(previewWidthDisplay, unit)
  const previewDepthMm = fromDisplayUnit(previewDepthDisplay, unit)
  const previewGrid = previewWidthMm > 0 && previewDepthMm > 0
    ? calculateDrawerGrid(previewWidthMm, previewDepthMm, config)
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Drawer' : 'Add Drawer'}</DialogTitle>
          <DialogDescription>
            Enter the internal dimensions of your drawer in {unit}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tool Drawer, Parts Bin"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="width">Width ({unit})</Label>
              <Input
                id="width"
                type="number"
                step="0.1"
                min="0.1"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder={unit === 'cm' ? '40' : '400'}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height ({unit})</Label>
              <Input
                id="height"
                type="number"
                step="0.1"
                min="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder={unit === 'cm' ? '5' : '50'}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depth">Depth ({unit})</Label>
              <Input
                id="depth"
                type="number"
                step="0.1"
                min="0.1"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                placeholder={unit === 'cm' ? '30' : '300'}
                required
              />
            </div>
          </div>

          {/* Preview */}
          {previewGrid && !gridless && (
            <div className="rounded-md bg-secondary/30 p-3">
              <p className="text-sm text-muted-foreground">
                Grid Preview: <span className="font-medium text-foreground">{previewGrid.gridCols} x {previewGrid.gridRows}</span> cells
                ({previewGrid.gridCols * previewGrid.gridRows} total)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on {config.cellSize}mm cell size with {config.tolerance}mm tolerance
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="gridless">Free positioning</Label>
              <p className="text-xs text-muted-foreground">
                Items snap to millimetres instead of Gridfinity grid cells
              </p>
            </div>
            <Switch id="gridless" checked={gridless} onCheckedChange={setGridless} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? 'Save Changes' : 'Add Drawer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
