'use client'

import React, { useMemo } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useDrawerStore } from '@/lib/store'
import type { Snapshot } from '@/lib/store'
import { labelAction } from '@/lib/history'

interface HistoryEntry {
  label: string
  isCurrent: boolean
  onClick: (() => void) | null
}

export function HistoryPanel() {
  const past           = useDrawerStore(s => s.past)
  const future         = useDrawerStore(s => s.future)
  const items          = useDrawerStore(s => s.items)
  const drawers        = useDrawerStore(s => s.drawers)
  const config         = useDrawerStore(s => s.config)
  const categories     = useDrawerStore(s => s.categories)
  const selectedDrawerId = useDrawerStore(s => s.selectedDrawerId)
  const selectedItemIds          = useDrawerStore(s => s.selectedItemIds)
  const selectedCabinetDrawerIds = useDrawerStore(s => s.selectedCabinetDrawerIds)
  const jumpToHistory  = useDrawerStore(s => s.jumpToHistory)
  const jumpToFuture   = useDrawerStore(s => s.jumpToFuture)

  const currentSnapshot = useMemo<Snapshot>(() => ({
    drawers, items, categories, config, selectedDrawerId, selectedItemIds, selectedCabinetDrawerIds,
  }), [drawers, items, categories, config, selectedDrawerId, selectedItemIds, selectedCabinetDrawerIds])

  const entries = useMemo<HistoryEntry[]>(() => {
    const result: HistoryEntry[] = []

    // Future entries: future[last] at top (furthest ahead), future[0] just above current
    for (let i = future.length - 1; i >= 0; i--) {
      const after  = future[i]
      const before = i === 0 ? currentSnapshot : future[i - 1]
      result.push({
        label: labelAction(before, after),
        isCurrent: false,
        onClick: () => jumpToFuture(i),
      })
    }

    // Current state
    result.push({ label: 'Current', isCurrent: true, onClick: null })

    // Past entries: past[last] just below current, past[0] at bottom (oldest)
    for (let i = past.length - 1; i >= 0; i--) {
      const before = past[i]
      const after  = i === past.length - 1 ? currentSnapshot : past[i + 1]
      result.push({
        label: labelAction(before, after),
        isCurrent: false,
        onClick: () => jumpToHistory(i),
      })
    }

    return result
  }, [past, future, currentSnapshot, jumpToHistory, jumpToFuture])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <History className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="flex items-center px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">History</span>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {entries.map((entry, idx) => (
            <button
              key={idx}
              disabled={entry.isCurrent || entry.onClick === null}
              onClick={entry.onClick ?? undefined}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors',
                entry.isCurrent
                  ? 'bg-primary/10 text-primary font-medium cursor-default'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {entry.isCurrent && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
              <span className={cn(!entry.isCurrent && 'pl-3.5')}>{entry.label}</span>
            </button>
          ))}
          {entries.length === 1 && (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">No history yet</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
