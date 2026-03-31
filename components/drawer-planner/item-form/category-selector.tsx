'use client'

import React from 'react'
import { Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/types'

export interface CategorySelectorProps {
  categories: Category[]
  categoryId: string | null
  onSelect: (id: string | null) => void
  newCatName: string
  onNewCatNameChange: (v: string) => void
  onCreateCategory: () => void
  newCatInputRef: React.RefObject<HTMLInputElement | null>
}

export function CategorySelector({ categories, categoryId, onSelect, newCatName, onNewCatNameChange, onCreateCategory, newCatInputRef }: CategorySelectorProps) {
  return (
    <div className="rounded-md border border-input bg-background text-sm overflow-hidden">
      {/* None option */}
      <button type="button" onClick={() => onSelect(null)}
        className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent/50 transition-colors text-left',
          categoryId === null && 'bg-accent/30')}>
        <div className="h-3 w-3 rounded-sm shrink-0 border border-border" />
        <span className="flex-1 text-muted-foreground">None</span>
        {categoryId === null && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
      </button>

      {/* Existing categories */}
      {categories.map(cat => (
        <button key={cat.id} type="button" onClick={() => onSelect(cat.id)}
          className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent/50 transition-colors text-left border-t border-border/40',
            categoryId === cat.id && 'bg-accent/30')}>
          <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: cat.color }} />
          <span className="flex-1 truncate">{cat.name}</span>
          {categoryId === cat.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
        </button>
      ))}

      {/* Inline quick-create */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-border/40">
        <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={newCatInputRef}
          type="text"
          value={newCatName}
          onChange={e => onNewCatNameChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onCreateCategory() } }}
          placeholder="New category…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {newCatName.trim() && (
          <button type="button" onClick={onCreateCategory} className="text-xs text-primary hover:underline shrink-0">
            Add
          </button>
        )}
      </div>
    </div>
  )
}
