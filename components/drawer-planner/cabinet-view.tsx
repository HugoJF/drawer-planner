'use client'

import React, { useState, useCallback, useRef, useMemo } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { computeSnap, type SnapGuide } from '@/lib/cabinet-snap'
import type { CabinetItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Pencil, Copy, Trash2 } from 'lucide-react'

export interface CabinetViewProps {
  items: CabinetItem[]
  selectedIds: Set<string>
  scale?: number           // px/mm, default 0.5
  snapThresholdPx?: number // default 8
  onMove: (updates: { id: string; x: number; y: number }[]) => void
  onSelectIds: (ids: string[]) => void
  onToggleId: (id: string) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

interface DragState {
  anchorId: string
  startMouseX: number
  startMouseY: number
  origins: { id: string; x: number; y: number }[]
}

interface BoxSelectState {
  startX: number
  startY: number
  endX: number
  endY: number
}

const DEFAULT_SCALE = 0.5
const DEFAULT_SNAP_THRESHOLD = 8

export function CabinetView({
  items,
  selectedIds,
  scale = DEFAULT_SCALE,
  snapThresholdPx = DEFAULT_SNAP_THRESHOLD,
  onMove,
  onSelectIds,
  onToggleId,
  onEdit,
  onDuplicate,
  onDelete,
}: CabinetViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [dragPreview, setDragPreview] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
  const [boxSelect, setBoxSelect] = useState<BoxSelectState | null>(null)
  const [contextItemId, setContextItemId] = useState<string | null>(null)

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) {
      return { x: 0, y: 0 }
    }
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) {
      return
    }

    // Walk up to find a cabinet item
    let target = e.target as HTMLElement | null
    let itemId: string | null = null
    while (target && target !== containerRef.current) {
      if (target.dataset.cabinetItemId) {
        itemId = target.dataset.cabinetItemId
        break
      }
      target = target.parentElement
    }

    if (itemId) {
      e.preventDefault()
      // If not selected, select just this item first (unless Ctrl held)
      const isSelected = selectedIds.has(itemId)
      let draggingIds: string[]
      if (e.ctrlKey || e.metaKey) {
        onToggleId(itemId)
        draggingIds = selectedIds.has(itemId)
          ? [...selectedIds].filter(id => id !== itemId)
          : [...selectedIds, itemId]
      } else {
        if (!isSelected) {
          onSelectIds([itemId])
          draggingIds = [itemId]
        } else {
          draggingIds = [...selectedIds]
        }
      }

      // Build origins snapshot for all dragged items
      const origins = draggingIds.map(id => {
        const item = items.find(i => i.id === id)!
        return { id, x: item.x, y: item.y }
      })

      setDragState({
        anchorId: itemId,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        origins,
      })
      setDragPreview(new Map())
      setSnapGuides([])
    } else {
      // Click on empty space — start box select
      e.preventDefault()
      const pos = getCanvasPos(e.clientX, e.clientY)
      setBoxSelect({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y })
      if (!e.ctrlKey && !e.metaKey) {
        onSelectIds([])
      }
    }
  }, [items, selectedIds, onSelectIds, onToggleId, getCanvasPos])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragState) {
      const dxPx = e.clientX - dragState.startMouseX
      const dyPx = e.clientY - dragState.startMouseY
      const dxMm = dxPx / scale
      const dyMm = dyPx / scale

      // Compute preview positions before snap
      const preSnap = dragState.origins.map(o => ({
        ...items.find(i => i.id === o.id)!,
        x: o.x + dxMm,
        y: o.y + dyMm,
      }))

      // Items not being dragged
      const draggedIds = new Set(dragState.origins.map(o => o.id))
      const staticItems = items.filter(i => !draggedIds.has(i.id))

      const { deltaXMm, deltaYMm, guides } = computeSnap(preSnap, staticItems, scale, snapThresholdPx)

      const newPreview = new Map<string, { x: number; y: number }>()
      for (const o of dragState.origins) {
        newPreview.set(o.id, {
          x: o.x + dxMm + deltaXMm,
          y: o.y + dyMm + deltaYMm,
        })
      }

      setDragPreview(newPreview)
      setSnapGuides(guides)
    } else if (boxSelect) {
      const pos = getCanvasPos(e.clientX, e.clientY)
      const updated = { ...boxSelect, endX: pos.x, endY: pos.y }
      setBoxSelect(updated)

      // Compute box in mm
      const bxMin = Math.min(updated.startX, updated.endX) / scale
      const bxMax = Math.max(updated.startX, updated.endX) / scale
      const byMin = Math.min(updated.startY, updated.endY) / scale
      const byMax = Math.max(updated.startY, updated.endY) / scale

      const hit = items
        .filter(item => {
          const right  = item.x + item.widthMm
          const bottom = item.y + item.heightMm
          return right > bxMin && item.x < bxMax && bottom > byMin && item.y < byMax
        })
        .map(i => i.id)

      onSelectIds(hit)
    }
  }, [dragState, boxSelect, items, scale, snapThresholdPx, getCanvasPos, onSelectIds])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragState) {
      if (dragPreview.size > 0) {
        const updates = [...dragPreview.entries()].map(([id, pos]) => ({ id, ...pos }))
        onMove(updates)
      }
      setDragState(null)
      setDragPreview(new Map())
      setSnapGuides([])
    }

    if (boxSelect) {
      const dx = Math.abs(boxSelect.endX - boxSelect.startX)
      const dy = Math.abs(boxSelect.endY - boxSelect.startY)
      // Pure click (no drag) — deselect
      if (dx < 3 && dy < 3 && !e.ctrlKey && !e.metaKey) {
        onSelectIds([])
      }
      setBoxSelect(null)
    }
  }, [dragState, dragPreview, boxSelect, onMove, onSelectIds])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    let target = e.target as HTMLElement | null
    let itemId: string | null = null
    while (target && target !== containerRef.current) {
      if (target.dataset.cabinetItemId) {
        itemId = target.dataset.cabinetItemId
        break
      }
      target = target.parentElement
    }
    setContextItemId(itemId)
  }, [])

  // Canvas size: enough to fit all items + padding
  const canvasSize = useMemo(() => {
    if (items.length === 0) {
      return { width: 800, height: 600 }
    }
    const maxX = Math.max(...items.map(i => i.x + i.widthMm))
    const maxY = Math.max(...items.map(i => i.y + i.heightMm))
    return {
      width: Math.max(800, (maxX + 100) * scale),
      height: Math.max(600, (maxY + 100) * scale),
    }
  }, [items, scale])

  const boxSelectRect = useMemo(() => {
    if (!boxSelect) {
      return null
    }
    return {
      left:   Math.min(boxSelect.startX, boxSelect.endX),
      top:    Math.min(boxSelect.startY, boxSelect.endY),
      width:  Math.abs(boxSelect.endX - boxSelect.startX),
      height: Math.abs(boxSelect.endY - boxSelect.startY),
    }
  }, [boxSelect])

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={containerRef}
          className="relative overflow-auto w-full h-full bg-muted/30 rounded-md border border-border select-none cursor-default"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        >
          <div
            className="relative"
            style={{ width: canvasSize.width, height: canvasSize.height }}
          >
            {/* Subtle dot grid background */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvasSize.width}
              height={canvasSize.height}
            >
              <defs>
                <pattern id="dot-grid" x="0" y="0" width={20 * scale} height={20 * scale} patternUnits="userSpaceOnUse">
                  <circle cx={scale * 10} cy={scale * 10} r="1" className="fill-muted-foreground/20" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dot-grid)" />
            </svg>

            {/* Snap guides */}
            {snapGuides.map((guide, i) => (
              guide.axis === 'x' ? (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-blue-400/70 pointer-events-none"
                  style={{ left: guide.positionPx, zIndex: 50 }}
                />
              ) : (
                <div
                  key={i}
                  className="absolute left-0 right-0 h-px bg-blue-400/70 pointer-events-none"
                  style={{ top: guide.positionPx, zIndex: 50 }}
                />
              )
            ))}

            {/* Drawer rectangles */}
            {items.map(item => {
              const preview = dragPreview.get(item.id)
              const x = (preview?.x ?? item.x) * scale
              const y = (preview?.y ?? item.y) * scale
              const w = item.widthMm * scale
              const h = item.heightMm * scale
              const isSelected = selectedIds.has(item.id)
              const isDragging = dragPreview.has(item.id)

              return (
                <div
                  key={item.id}
                  data-cabinet-item-id={item.id}
                  className={cn(
                    'absolute border rounded-sm flex items-center justify-center overflow-hidden',
                    'bg-card text-card-foreground transition-shadow',
                    isSelected
                      ? 'border-primary ring-1 ring-primary z-10'
                      : 'border-border hover:border-primary/50',
                    isDragging && 'opacity-90 shadow-lg',
                  )}
                  style={{ left: x, top: y, width: w, height: h }}
                >
                  <div className="flex flex-col items-center gap-0.5 px-1 text-center pointer-events-none">
                    <span className="text-xs font-medium leading-tight truncate max-w-full">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {item.widthMm}×{item.heightMm}mm
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Box select overlay */}
            {boxSelectRect && (
              <div
                className="absolute border border-primary/60 bg-primary/10 pointer-events-none"
                style={{
                  left:   boxSelectRect.left,
                  top:    boxSelectRect.top,
                  width:  boxSelectRect.width,
                  height: boxSelectRect.height,
                  zIndex: 100,
                }}
              />
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      {contextItemId ? (
        <ContextMenuContent className="w-44">
          <ContextMenuItem onClick={() => onEdit(contextItemId)}>
            <Pencil className="h-4 w-4" />Edit drawer
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDuplicate(contextItemId)}>
            <Copy className="h-4 w-4" />Duplicate drawer
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => onDelete(contextItemId)}>
            <Trash2 className="h-4 w-4" />Delete drawer
          </ContextMenuItem>
        </ContextMenuContent>
      ) : (
        <ContextMenuContent className="w-44">
          <ContextMenuItem disabled className="text-muted-foreground text-xs">
            Cabinet view
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}
