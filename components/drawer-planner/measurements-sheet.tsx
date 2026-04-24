'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Trash2, Check, Plus } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDrawerStore } from '@/lib/store'
import { fromDisplayUnit } from '@/lib/types'
import type { PendingItem, Category, DimensionUnit } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PendingItemRowProps {
  item: PendingItem
  categories: Category[]
  displayUnit: DimensionUnit
  onUpdate: (item: PendingItem) => void
  onDelete: (id: string) => void
  onMeasure: (id: string, dims: { width: number; height: number; depth: number }) => void
}

function PendingItemRow({ item, categories, displayUnit, onUpdate, onDelete, onMeasure }: PendingItemRowProps) {
  const [name, setName]   = useState(item.name)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [depth, setDepth] = useState('')

  const widthMm  = fromDisplayUnit(parseFloat(width)  || 0, displayUnit)
  const heightMm = fromDisplayUnit(parseFloat(height) || 0, displayUnit)
  const depthMm  = fromDisplayUnit(parseFloat(depth)  || 0, displayUnit)
  const allFilled = widthMm > 0 && heightMm > 0 && depthMm > 0

  const handleNameBlur = useCallback(() => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== item.name) {
      onUpdate({ ...item, name: trimmed })
    } else if (!trimmed) {
      setName(item.name)
    }
  }, [name, item, onUpdate])

  const handleCategoryChange = useCallback((value: string) => {
    onUpdate({ ...item, categoryId: value === 'none' ? null : value })
  }, [item, onUpdate])

  const unit = displayUnit

  return (
    <div className="flex flex-col gap-1.5 py-2.5 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
          className="h-7 text-sm flex-1"
        />
        <button
          onClick={() => onDelete(item.id)}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <Select
          value={item.categoryId ?? 'none'}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">None</span>
            </SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm shrink-0 inline-block" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DimInput label={`W (${unit})`} value={width} onChange={setWidth} />
        <DimInput label={`H (${unit})`} value={height} onChange={setHeight} />
        <DimInput label={`D (${unit})`} value={depth} onChange={setDepth} />
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <span className="text-[10px] leading-none invisible">_</span>
          <button
            disabled={!allFilled}
            onClick={() => onMeasure(item.id, { width: widthMm, height: heightMm, depth: depthMm })}
            className={cn(
              'p-1 rounded transition-colors',
              allFilled
                ? 'text-green-600 hover:bg-green-600/10'
                : 'text-muted-foreground/30 cursor-not-allowed'
            )}
            title={allFilled ? 'Mark as measured' : 'Enter all dimensions first'}
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface DimInputProps {
  label: string
  value: string
  onChange: (v: string) => void
}

function DimInput({ label, value, onChange }: DimInputProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 w-14 shrink-0">
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
      <Input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        step="0.1"
        min="0.1"
        placeholder="—"
        className="h-7 text-xs text-center px-1 w-full"
      />
    </div>
  )
}

interface MeasurementsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MeasurementsSheet({ open, onOpenChange }: MeasurementsSheetProps) {
  const pendingItems      = useDrawerStore(s => s.pendingItems)
  const categories        = useDrawerStore(s => s.categories)
  const config            = useDrawerStore(s => s.config)
  const addPendingItem    = useDrawerStore(s => s.addPendingItem)
  const updatePendingItem = useDrawerStore(s => s.updatePendingItem)
  const deletePendingItem = useDrawerStore(s => s.deletePendingItem)
  const measurePendingItem = useDrawerStore(s => s.measurePendingItem)

  const [newName, setNewName] = useState('')
  const newNameInputRef = useRef<HTMLInputElement>(null)

  const handleAdd = useCallback(() => {
    const trimmed = newName.trim()
    if (!trimmed) {
      return
    }
    addPendingItem({ name: trimmed, categoryId: null })
    setNewName('')
    newNameInputRef.current?.focus()
  }, [newName, addPendingItem])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            Needs Measurement
            {pendingItems.length > 0 && (
              <span className="text-xs font-normal bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                {pendingItems.length}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            Register items without dimensions. Fill in W/H/D and click ✓ to create the item.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          {pendingItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No items pending measurement.
            </p>
          ) : (
            <div>
              {pendingItems.map(item => (
                <PendingItemRow
                  key={item.id}
                  item={item}
                  categories={categories}
                  displayUnit={config.displayUnit}
                  onUpdate={updatePendingItem}
                  onDelete={deletePendingItem}
                  onMeasure={measurePendingItem}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="px-4 py-3 border-t border-border flex gap-2">
          <Input
            ref={newNameInputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { handleAdd() } }}
            placeholder="Item name…"
            className="h-8 text-sm flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="shrink-0"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
