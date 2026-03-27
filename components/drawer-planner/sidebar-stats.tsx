'use client'

import React, { useMemo } from 'react'
import { useDrawerStore } from '@/lib/store'
import { calculateDrawerStats } from '@/lib/gridfinity'
import { Progress } from '@/components/ui/progress'
import { Grid3X3, Box, Layers, AlertTriangle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatDimension } from '@/lib/types'

export function SidebarStats() {
  const selectedDrawerId = useDrawerStore(s => s.selectedDrawerId)
  const config = useDrawerStore(s => s.config)
  const drawers = useDrawerStore(s => s.drawers)
  const allItems = useDrawerStore(s => s.items)

  const selectedDrawer = useMemo(
    () => drawers.find(d => d.id === selectedDrawerId) ?? null,
    [drawers, selectedDrawerId]
  )
  const items = useMemo(
    () => allItems.filter(i => i.drawerId === selectedDrawerId),
    [allItems, selectedDrawerId]
  )

  if (!selectedDrawer) {
    return (
      <div className="p-3 border-t border-border bg-card/30">
        <p className="text-xs text-muted-foreground text-center">
          Select a drawer to view stats
        </p>
      </div>
    )
  }

  const stats = calculateDrawerStats(selectedDrawer, items, config)
  const cellUtilization = stats.totalCells > 0 
    ? (stats.usedCells / stats.totalCells) * 100 
    : 0

  return (
    <div className="p-3 border-t border-border bg-card/30 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Drawer Stats
        </span>
        <span className="text-xs text-muted-foreground">
          {selectedDrawer.name}
        </span>
      </div>

      {/* Grid Cells */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Grid3X3 className="h-3 w-3 text-muted-foreground" />
            <span>Grid Cells</span>
          </div>
          <span className="font-medium">
            {stats.availableCells}/{stats.totalCells}
          </span>
        </div>
        <Progress value={cellUtilization} className="h-1" />
      </div>

      {/* Volume */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Box className="h-3 w-3 text-muted-foreground" />
            <span>Volume</span>
          </div>
          <span className="font-medium">
            {stats.volumeUtilization.toFixed(0)}%
          </span>
        </div>
        <Progress value={stats.volumeUtilization} className="h-1" />
      </div>

      {/* Dead Room & Warnings */}
      <div className="flex items-center justify-between gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span>Dead Room:</span>
              <span className="font-medium">
                {formatDimension(stats.deadRoom, config.displayUnit)}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Unused height (drawer height - tallest item)
          </TooltipContent>
        </Tooltip>

        {stats.heightWarnings > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />
                <span>{stats.heightWarnings}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {stats.heightWarnings} item{stats.heightWarnings > 1 ? 's' : ''} exceed drawer height
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Grid info */}
      <div className="text-xs text-muted-foreground border-t border-border/50 pt-2 space-y-0.5">
        <div className="flex justify-between">
          <span>Grid</span>
          <span className="font-medium text-foreground">{selectedDrawer.gridCols} × {selectedDrawer.gridRows}</span>
        </div>
        <div className="flex justify-between">
          <span>Cell size</span>
          <span className="font-medium text-foreground">{formatDimension(config.cellSize, config.displayUnit)}</span>
        </div>
      </div>
    </div>
  )
}
