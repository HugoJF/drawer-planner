'use client'

import React, { useState, useRef, useMemo } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDrawerStore } from '@/lib/store'
import { calculateItemGridDimensions, getRotatedDimensions, getDistinctRotations, getRotationLabel } from '@/lib/gridfinity'
import { cn } from '@/lib/utils'
import type { Item } from '@/lib/types'
import { ITEM_COLORS, toDisplayUnit, fromDisplayUnit, ItemRotation, FootprintMode } from '@/lib/types'
import { RotateCw } from 'lucide-react'
import { CategorySelector } from './category-selector'

interface ItemFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Item | null
  initialPosition: { posX: number; posY: number } | null
  initialGridDimensions: { cols: number; rows: number } | null
}

export function ItemForm({ open, onOpenChange, item, initialPosition, initialGridDimensions }: ItemFormProps) {
  const config           = useDrawerStore(s => s.config)
  const drawers          = useDrawerStore(s => s.drawers)
  const categories       = useDrawerStore(s => s.categories)
  const selectedDrawerId = useDrawerStore(s => s.selectedDrawerId)
  const addItem          = useDrawerStore(s => s.addItem)
  const updateItem       = useDrawerStore(s => s.updateItem)
  const addCategory      = useDrawerStore(s => s.addCategory)
  const isEditing = !!item

  const unit = config.displayUnit

  const [name, setName]           = useState(item?.name ?? '')
  const [width, setWidth]         = useState(item && item.width > 0 ? toDisplayUnit(item.width, unit).toString() : '')
  const [height, setHeight]       = useState(item && item.height > 0 ? toDisplayUnit(item.height, unit).toString() : '')
  const [depth, setDepth]         = useState(item && item.depth > 0 ? toDisplayUnit(item.depth, unit).toString() : '')
  const [categoryId, setCategoryId] = useState<string | null>(item?.categoryId ?? null)
  const [rotation, setRotation]   = useState<ItemRotation>(item?.rotation ?? ItemRotation.HeightUp)
  const [drawerId, setDrawerId]   = useState<string | null>(item?.drawerId ?? selectedDrawerId)
  const [footprintMode, setFootprintMode] = useState<FootprintMode>(item?.footprintMode ?? (initialGridDimensions ? FootprintMode.Manual : FootprintMode.Auto))
  // Grid mode: footprint in cells
  const [manualCols, setManualCols] = useState(item?.footprintW != null ? Math.round(item.footprintW / config.cellSize) : (initialGridDimensions?.cols ?? 1))
  const [manualRows, setManualRows] = useState(item?.footprintH != null ? Math.round(item.footprintH / config.cellSize) : (initialGridDimensions?.rows ?? 1))
  // Gridless mode: footprint in mm (initialGridDimensions.cols/rows carry raw mm from DrawerFreeAdapter)
  const [manualW, setManualW] = useState(item?.footprintW ?? (initialGridDimensions?.cols ?? config.cellSize))
  const [manualH, setManualH] = useState(item?.footprintH ?? (initialGridDimensions?.rows ?? config.cellSize))
  const [notes, setNotes]         = useState(item?.notes ?? '')
  const [newCatName, setNewCatName] = useState('')
  const newCatInputRef = useRef<HTMLInputElement>(null)

  const currentDrawer = useMemo(() => drawers.find(d => d.id === drawerId) ?? null, [drawers, drawerId])
  const isGridless = currentDrawer?.gridless ?? false

  // Preview calculations
  const widthMm  = fromDisplayUnit(parseFloat(width) || 0, unit)
  const heightMm = fromDisplayUnit(parseFloat(height) || 0, unit)
  const depthMm  = fromDisplayUnit(parseFloat(depth) || 0, unit)
  const hasPhysical = widthMm > 0 && depthMm > 0

  const distinctRotations = useMemo(
    () => getDistinctRotations({ width: widthMm, height: heightMm, depth: depthMm } as Item),
    [widthMm, heightMm, depthMm]
  )

  const effectiveRotation = useMemo(() => {
    if (distinctRotations.includes(rotation)) {
      return rotation
    }
    const dimKey = (r: ItemRotation) => {
      const d = getRotatedDimensions({ width: widthMm, height: heightMm, depth: depthMm } as Item, r)
      return `${d.width}|${d.depth}|${d.height}`
    }
    const currentKey = dimKey(rotation)
    return distinctRotations.find(r => dimKey(r) === currentKey) ?? distinctRotations[0]
  }, [distinctRotations, rotation, widthMm, heightMm, depthMm])

  const previewItem: Item = {
    id: 'preview', name, width: widthMm, height: heightMm, depth: depthMm,
    categoryId, rotation: effectiveRotation, drawerId: null, posX: 0, posY: 0, footprintMode,
    footprintW: isGridless ? manualW : manualCols * config.cellSize,
    footprintH: isGridless ? manualH : manualRows * config.cellSize,
    locked: false,
  }

  const previewDims = (footprintMode === FootprintMode.Auto ? hasPhysical : true)
    ? calculateItemGridDimensions(previewItem, config)
    : null

  const rotatedDims = hasPhysical ? getRotatedDimensions(previewItem) : null

  const autoInvalid = footprintMode === FootprintMode.Auto && (!width || !height || !depth)

  const nextColor = (): string => {
    const used = new Set(categories.map(c => c.color))
    return ITEM_COLORS.find(c => !used.has(c)) ?? ITEM_COLORS[0]
  }

  const handleCreateCategory = () => {
    const trimmed = newCatName.trim()
    if (!trimmed) {
      return
    }
    const id = addCategory(trimmed, nextColor())
    setCategoryId(id)
    setNewCatName('')
  }

  const handleFootprintModeChange = (newMode: FootprintMode) => {
    if (newMode === FootprintMode.Manual && footprintMode === FootprintMode.Auto) {
      const wMm = fromDisplayUnit(parseFloat(width) || 0, unit)
      const hMm = fromDisplayUnit(parseFloat(height) || 0, unit)
      const dMm = fromDisplayUnit(parseFloat(depth) || 0, unit)
      if (wMm > 0 && dMm > 0) {
        if (isGridless) {
          const d = getRotatedDimensions({ width: wMm, height: hMm, depth: dMm, rotation, id: '', name, categoryId, drawerId, posX: 0, posY: 0, footprintMode: FootprintMode.Auto, locked: false } as Item)
          setManualW(Math.round(d.width))
          setManualH(Math.round(d.depth))
        } else {
          const fakeItem: Item = { id: '', name, width: wMm, height: hMm, depth: dMm, categoryId, rotation, drawerId, posX: 0, posY: 0, footprintMode: FootprintMode.Auto, locked: false }
          const dims = calculateItemGridDimensions(fakeItem, config)
          setManualCols(dims.gridWidth)
          setManualRows(dims.gridDepth)
        }
      }
    }
    setFootprintMode(newMode)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      return
    }

    const widthDisplay  = parseFloat(width)
    const heightDisplay = parseFloat(height)
    const depthDisplay  = parseFloat(depth)
    const widthMm  = width  ? fromDisplayUnit(widthDisplay,  unit) : 0
    const heightMm = height ? fromDisplayUnit(heightDisplay, unit) : 0
    const depthMm  = depth  ? fromDisplayUnit(depthDisplay,  unit) : 0

    if (footprintMode === FootprintMode.Auto) {
      if (isNaN(widthDisplay) || isNaN(heightDisplay) || isNaN(depthDisplay) ||
          widthMm <= 0 || heightMm <= 0 || depthMm <= 0) return
    }

    const itemData = {
      name: name.trim(),
      width: widthMm,
      height: heightMm,
      depth: depthMm,
      categoryId,
      rotation: effectiveRotation,
      drawerId,
      footprintMode,
      footprintW: isGridless ? manualW : manualCols * config.cellSize,
      footprintH: isGridless ? manualH : manualRows * config.cellSize,
      notes: notes.trim() || undefined,
    }

    if (isEditing && item) {
      updateItem({ ...item, ...itemData })
    } else {
      addItem({ ...itemData, posX: initialPosition?.posX ?? 0, posY: initialPosition?.posY ?? 0 })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Item' : 'Add Item'}</DialogTitle>
          <DialogDescription>
            {footprintMode === FootprintMode.Manual
              ? isGridless
                ? 'Set footprint size in mm. Physical dimensions are optional.'
                : 'Set grid footprint directly. Physical dimensions are optional.'
              : `Enter the item's physical dimensions in ${unit}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Drawer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input id="item-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Screwdriver" required />
            </div>
            <div className="space-y-2">
              <Label>Drawer</Label>
              <Select value={drawerId || 'unassigned'} onValueChange={v => setDrawerId(v === 'unassigned' ? null : v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select a drawer..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {drawers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Physical Dimensions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Physical Dimensions ({unit})</Label>
              {footprintMode === FootprintMode.Manual && <span className="text-xs text-muted-foreground">optional</span>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['Width', 'Depth', 'Height'] as const).map((label, i) => {
                const val = [width, depth, height][i]
                const setter = [setWidth, setDepth, setHeight][i]
                const placeholder = unit === 'cm' ? (i === 2 ? '10' : '3') : (i === 2 ? '100' : '30')
                return (
                  <div key={label} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input type="number" step="0.1" min="0.1" value={val} onChange={e => setter(e.target.value)}
                      placeholder={placeholder} required={footprintMode === FootprintMode.Auto} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Category + Rotation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <CategorySelector
                categories={categories}
                categoryId={categoryId}
                onSelect={setCategoryId}
                newCatName={newCatName}
                onNewCatNameChange={setNewCatName}
                onCreateCategory={handleCreateCategory}
                newCatInputRef={newCatInputRef}
              />
            </div>
            <div className="space-y-2">
              <Label>Rotation</Label>
              <Select value={effectiveRotation} onValueChange={v => setRotation(v as ItemRotation)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {distinctRotations.map(r => (
                    <SelectItem key={r} value={r}>{getRotationLabel(r, previewItem, config, isGridless)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Footprint Settings */}
          <div className="rounded-md bg-secondary/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{isGridless ? 'Footprint' : 'Grid Footprint'}</span>
              <div className="flex rounded-md border border-input overflow-hidden text-xs">
                {([FootprintMode.Auto, FootprintMode.Manual] as const).map(mode => (
                  <button key={mode} type="button"
                    className={cn('px-3 py-1 font-medium transition-colors', mode === 'manual' && 'border-l border-input',
                      footprintMode === mode ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-accent')}
                    onClick={() => handleFootprintModeChange(mode)}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {footprintMode === FootprintMode.Manual ? (
              isGridless ? (
                <div className="flex items-center gap-1.5">
                  <Input type="number" min="1" step="1" value={manualW}
                    onChange={e => setManualW(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-20 h-7 text-center text-sm" />
                  <span className="text-muted-foreground text-sm">×</span>
                  <Input type="number" min="1" step="1" value={manualH}
                    onChange={e => setManualH(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-20 h-7 text-center text-sm" />
                  <span className="text-xs text-muted-foreground">mm</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Input type="number" min="1" step="1" value={manualCols}
                      onChange={e => setManualCols(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-7 text-center text-sm" />
                    <span className="text-muted-foreground text-sm">×</span>
                    <Input type="number" min="1" step="1" value={manualRows}
                      onChange={e => setManualRows(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-7 text-center text-sm" />
                    <span className="text-xs text-muted-foreground">cells</span>
                  </div>
                </div>
              )
            ) : isGridless ? (
              rotatedDims ? (
                <p className="text-sm text-muted-foreground">
                  Calculated: <span className="font-medium text-foreground">{Math.round(rotatedDims.width)} × {Math.round(rotatedDims.depth)}</span> mm
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Fill physical dimensions above to see calculated footprint.</p>
              )
            ) : previewDims ? (
              <p className="text-sm text-muted-foreground">
                Calculated: <span className="font-medium text-foreground">{previewDims.gridWidth} × {previewDims.gridDepth}</span> cells
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Fill physical dimensions above to see calculated grid size.</p>
            )}

            {rotatedDims && rotatedDims.height > 0 && (
              <p className="text-sm text-muted-foreground">
                Height: {isGridless ? (
                  <span className="font-medium text-foreground">{Math.round(rotatedDims.height)}mm</span>
                ) : (
                  <>
                    {previewDims && previewDims.heightUnits > 0 && (
                      <span className="font-medium text-foreground">{previewDims.heightUnits} U</span>
                    )}
                    <span className="text-xs ml-1">({rotatedDims.height}mm)</span>
                  </>
                )}
              </p>
            )}
            {footprintMode === 'manual' && !hasPhysical && (
              <p className="text-xs text-muted-foreground">
                {isGridless
                  ? 'Add physical dimensions to see height and inset visualization.'
                  : 'Add physical dimensions to see height units and inset visualization.'}
              </p>
            )}
            {(isGridless ? rotatedDims : previewDims) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <RotateCw className="h-3 w-3" />{getRotationLabel(rotation, previewItem, config, isGridless)}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={autoInvalid && false}>
              {isEditing ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
