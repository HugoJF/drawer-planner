'use client'

import React, { useState, useEffect } from 'react'
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
import { useDrawerPlanner } from './drawer-planner-provider'
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
  initialDimensions?: { width: number; depth: number } | null // in mm
}

export function ItemForm({ open, onOpenChange, item, initialPosition, initialDimensions }: ItemFormProps) {
  const { state, addItem, updateItem } = useDrawerPlanner()
  const isEditing = !!item

  const [name, setName] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [depth, setDepth] = useState('')
  const [color, setColor] = useState(ITEM_COLORS[0])
  const [rotation, setRotation] = useState<ItemRotation>('normal')
  const [drawerId, setDrawerId] = useState<string | null>(null)

  const unit = state.config.displayUnit

  useEffect(() => {
    if (item) {
      setName(item.name)
      setWidth(toDisplayUnit(item.width, unit).toString())
      setHeight(toDisplayUnit(item.height, unit).toString())
      setDepth(toDisplayUnit(item.depth, unit).toString())
      setColor(item.color)
      setRotation(item.rotation)
      setDrawerId(item.drawerId)
    } else {
      setName('')
      setWidth(initialDimensions ? toDisplayUnit(initialDimensions.width, unit).toString() : '')
      setHeight('')
      setDepth(initialDimensions ? toDisplayUnit(initialDimensions.depth, unit).toString() : '')
      setColor(ITEM_COLORS[Math.floor(Math.random() * ITEM_COLORS.length)])
      setRotation('normal')
      setDrawerId(state.selectedDrawerId)
    }
  }, [item, open, state.selectedDrawerId, unit, initialDimensions])

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

    if (isEditing && item) {
      updateItem({
        ...item,
        name,
        width: widthMm,
        height: heightMm,
        depth: depthMm,
        color,
        rotation,
        drawerId,
      })
    } else {
      addItem({
        name,
        width: widthMm,
        height: heightMm,
        depth: depthMm,
        color,
        rotation,
        drawerId,
        gridX: initialPosition?.gridX ?? 0,
        gridY: initialPosition?.gridY ?? 0,
      })
    }

    onOpenChange(false)
  }

  // Calculate preview (convert display unit to mm)
  const widthDisplay = parseFloat(width) || 0
  const heightDisplay = parseFloat(height) || 0
  const depthDisplay = parseFloat(depth) || 0
  const widthMm = fromDisplayUnit(widthDisplay, unit)
  const heightMm = fromDisplayUnit(heightDisplay, unit)
  const depthMm = fromDisplayUnit(depthDisplay, unit)

  const previewItem = widthMm > 0 && heightMm > 0 && depthMm > 0
    ? {
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
      }
    : null

  const previewDims = previewItem 
    ? calculateItemGridDimensions(previewItem, state.config) 
    : null

  const rotatedDims = previewItem 
    ? getRotatedDimensions(previewItem) 
    : null

  const rotationLabels: Record<ItemRotation, string> = {
    normal: 'Normal (upright)',
    layDown: 'Lay Down (on side)',
    rotated: 'Rotated 90deg',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Item' : 'Add Item'}</DialogTitle>
          <DialogDescription>
            Enter the dimensions of your item in {unit} (original orientation).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Screwdriver, Battery Pack"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-width">Width ({unit})</Label>
              <Input
                id="item-width"
                type="number"
                step="0.1"
                min="0.1"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder={unit === 'cm' ? '3' : '30'}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-height">Height ({unit})</Label>
              <Input
                id="item-height"
                type="number"
                step="0.1"
                min="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder={unit === 'cm' ? '10' : '100'}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-depth">Depth ({unit})</Label>
              <Input
                id="item-depth"
                type="number"
                step="0.1"
                min="0.1"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                placeholder={unit === 'cm' ? '3' : '30'}
                required
              />
            </div>
          </div>

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
                  <SelectItem value="rotated">Rotated 90deg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign to Drawer</Label>
            <Select 
              value={drawerId || 'unassigned'} 
              onValueChange={(v) => setDrawerId(v === 'unassigned' ? null : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a drawer..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {state.drawers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {previewDims && rotatedDims && (
            <div className="rounded-md bg-secondary/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-6 h-6 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-medium">Grid Preview</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Size: <span className="font-medium text-foreground">{previewDims.gridWidth} x {previewDims.gridDepth}</span> cells
              </p>
              <p className="text-sm text-muted-foreground">
                Height: <span className="font-medium text-foreground">{rotatedDims.height}mm</span> ({previewDims.heightUnits}U)
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <RotateCw className="h-3 w-3" />
                {rotationLabels[rotation]}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {isEditing ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
