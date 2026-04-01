'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ITEM_COLORS } from '@/lib/types'
import type { Category } from '@/lib/types'

interface CategoryFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pass an existing category to edit it; omit to create a new one. */
  category?: Category | null
  /** Default color when creating a new category. */
  defaultColor?: string
  onSave: (name: string, color: string) => void
}

export function CategoryForm({ open, onOpenChange, category, defaultColor, onSave }: CategoryFormProps) {
  const isEditing = !!category
  const [name, setName] = useState(category?.name ?? '')
  const [color, setColor] = useState(category?.color ?? defaultColor ?? ITEM_COLORS[0])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      return
    }
    onSave(name.trim(), color)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Category' : 'New Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Tools"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-1.5 flex-wrap">
              {ITEM_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-md transition-all',
                    color === c && 'ring-2 ring-offset-2 ring-offset-background ring-primary'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{isEditing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
