'use client'

import React, { useState, useCallback, useMemo } from 'react'
import {
  ContextMenu,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { cn } from '@/lib/utils'
import type { Item } from '@/lib/types'
import type {
  CoordAdapter,
  ACoord,
  CanvasDragState,
  PendingDrag,
  ResizeState,
  DrawState,
  ItemRenderCtx,
} from './coord-adapter'

interface ItemCanvasProps {
  adapter: CoordAdapter
  items: Item[]
  selectedItemIds: Set<string>
  /** Already trimmed/lowercased search query; empty string means no search. */
  searchTerm?: string
  /** Whether Ctrl+drag creates a new item. */
  canDraw?: boolean
  /** Whether resize handles are shown on selected items. */
  canResize?: boolean
  onDragCommit:       (updates: { id: string; posX: number; posY: number }[]) => void
  onResizeCommit:     (id: string, partial: Partial<Item>) => void
  /** Called on box-select movement with the current matching ids ([] to deselect). */
  onSelectChange:     (ids: string[]) => void
  onItemClick:        (id: string, ctrl: boolean) => void
  onItemDoubleClick:  (id: string) => void
  onDrawComplete:     (posX: number, posY: number, cols: number, rows: number) => void
  onContextMenu:      (itemId: string | null) => void
  renderItem:         (item: Item, ctx: ItemRenderCtx) => React.ReactNode
  renderContextMenu:  (itemId: string | null) => React.ReactNode
}

export function ItemCanvas({
  adapter,
  items,
  selectedItemIds,
  searchTerm = '',
  canDraw = false,
  canResize = false,
  onDragCommit,
  onResizeCommit,
  onSelectChange,
  onItemClick,
  onItemDoubleClick,
  onDrawComplete,
  onContextMenu,
  renderItem,
  renderContextMenu,
}: ItemCanvasProps) {
  const [pendingDrag, setPendingDrag] = useState<PendingDrag | null>(null)
  const [dragState, setDragState]         = useState<CanvasDragState | null>(null)
  const [dropCoord, setDropCoord]         = useState<ACoord | null>(null)
  const [resizeState, setResizeState]     = useState<ResizeState | null>(null)
  const [boxSelectState, setBoxSelectState] = useState<DrawState | null>(null)
  const [drawState, setDrawState]         = useState<DrawState | null>(null)
  const [contextItemId, setContextItemId] = useState<string | null>(null)
  const [dragOverlay, setDragOverlay]     = useState<React.ReactNode>(null)
  const containerRef   = React.useRef<HTMLDivElement>(null)
  const suppressNextClick = React.useRef(false)

  // ---------------------------------------------------------------------------
  // Occupancy map — excludes items currently being dragged
  // ---------------------------------------------------------------------------
  const occupancyMap = useMemo(() => {
    const excludeIds = dragState
      ? new Set(dragState.offsets.map(o => o.id))
      : undefined
    return adapter.buildOccupancyMap(items, excludeIds)
  }, [adapter, items, dragState])

  // ---------------------------------------------------------------------------
  // Drag
  // ---------------------------------------------------------------------------
  const handleItemMouseDown = useCallback((e: React.MouseEvent, item: Item) => {
    if (e.button !== 0 || item.locked || resizeState || drawState || boxSelectState) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPendingDrag({
      item,
      startClientX: e.clientX,
      startClientY: e.clientY,
      grabPxX: e.clientX - rect.left,
      grabPxY: e.clientY - rect.top,
    })
  }, [resizeState, drawState, boxSelectState])

  const promotePendingDrag = useCallback((
    pd: NonNullable<typeof pendingDrag>,
    clientX: number,
    clientY: number,
  ) => {
    const init = adapter.initDrag(pd.item, items, selectedItemIds)
    const newDragState: CanvasDragState = {
      itemId:     pd.item.id,
      grabPxX:    pd.grabPxX,
      grabPxY:    pd.grabPxY,
      anchorSize: init.anchorSize,
      offsets:    init.offsets,
      adapterData: init.adapterData,
    }
    const initialDrop = containerRef.current
      ? adapter.computeDrop(clientX, clientY, pd.grabPxX, pd.grabPxY, newDragState, containerRef.current)
      : null
    setDragState(newDragState)
    if (initialDrop) {
      setDropCoord(initialDrop)
    }
    setPendingDrag(null)
    suppressNextClick.current = true
  }, [adapter, items, selectedItemIds])

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------
  const handleResizeStart = useCallback((
    e: React.MouseEvent,
    item: Item,
    handle: ResizeState['handle'],
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const startDims = adapter.initResizeDims(item)
    setResizeState({
      itemId: item.id,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startDims,
      previewDims: startDims,
    })
  }, [adapter])

  // ---------------------------------------------------------------------------
  // Container mouse handlers
  // ---------------------------------------------------------------------------
  const handleGridMouseMove = useCallback((e: React.MouseEvent) => {
    if (pendingDrag) {
      if (Math.abs(e.clientX - pendingDrag.startClientX) > 3 || Math.abs(e.clientY - pendingDrag.startClientY) > 3) {
        promotePendingDrag(pendingDrag, e.clientX, e.clientY)
      }
      return
    }
    if (dragState && containerRef.current) {
      const drop = adapter.computeDrop(
        e.clientX, e.clientY,
        dragState.grabPxX, dragState.grabPxY,
        dragState,
        containerRef.current,
      )
      if (drop) {
        setDropCoord(drop)
      }
      if (adapter.getOverlay) {
        setDragOverlay(adapter.getOverlay())
      }
      return
    }
    if (resizeState) {
      const previewDims = adapter.computeResizePreview(
        resizeState.handle,
        resizeState.startDims,
        e.clientX - resizeState.startMouseX,
        e.clientY - resizeState.startMouseY,
      )
      setResizeState(s => s ? { ...s, previewDims } : null)
      return
    }
    if (boxSelectState && containerRef.current) {
      const coord = adapter.mouseToCoord(e.clientX, e.clientY, containerRef.current)
      setBoxSelectState(s => s ? { ...s, endX: coord.x, endY: coord.y } : null)
      const matched = adapter.boxSelectItems(
        items,
        { x: boxSelectState.startX, y: boxSelectState.startY },
        coord,
      )
      onSelectChange(matched.length > 0 ? matched.map(i => i.id) : [])
    }
  }, [pendingDrag, dragState, resizeState, boxSelectState, adapter, items, onSelectChange, promotePendingDrag])

  const handleGridMouseUp = useCallback((e: React.MouseEvent) => {
    if (pendingDrag) {
      setPendingDrag(null)
      onItemClick(pendingDrag.item.id, e.ctrlKey || e.metaKey || selectedItemIds.has(pendingDrag.item.id))
      return
    }
    if (dragState && dropCoord) {
      onDragCommit(
        dragState.offsets.map(({ id, dx, dy }) => {
          const item = items.find(i => i.id === id)!
          return { id, ...adapter.applyDrop(item, dropCoord, { dx, dy }) }
        }),
      )
      setDragState(null)
      setDropCoord(null)
      setDragOverlay(null)
      return
    }
    if (resizeState) {
      const item = items.find(i => i.id === resizeState.itemId)
      if (item) {
        onResizeCommit(item.id, adapter.applyResize(item, resizeState.previewDims))
      }
      setResizeState(null)
      return
    }
    if (boxSelectState) {
      if (boxSelectState.startX === boxSelectState.endX && boxSelectState.startY === boxSelectState.endY) {
        onSelectChange([])
      }
      setBoxSelectState(null)
      return
    }
    if (drawState) {
      const args = adapter.drawRangeToArgs(
        { x: drawState.startX, y: drawState.startY },
        { x: drawState.endX,   y: drawState.endY   },
      )
      setDrawState(null)
      onDrawComplete(args.posX, args.posY, args.cols, args.rows)
    }
  }, [pendingDrag, dragState, dropCoord, resizeState, boxSelectState, drawState,
      items, selectedItemIds, adapter, onItemClick, onDragCommit, onResizeCommit, onSelectChange, onDrawComplete])

  const handleGridMouseLeave = useCallback(() => {
    setPendingDrag(null)
    setDragState(null)
    setDropCoord(null)
    setDragOverlay(null)
    setDrawState(null)
    setBoxSelectState(null)
    setResizeState(null)
  }, [])

  // handleGridMouseDown: starts draw or box-select when clicking a background cell.
  // Falls back to mouse-coord-based box-select for adapters without data-gx cells (free mode).
  const handleGridMouseDown = useCallback((e: React.MouseEvent) => {
    if (dragState || resizeState) {
      return
    }
    const target = (e.target as HTMLElement).closest('[data-gx]') as HTMLElement | null
    if (target) {
      // Grid mode: cell-based start
      const gx = parseInt(target.dataset.gx!)
      const gy = parseInt(target.dataset.gy!)
      e.preventDefault()
      if (canDraw && (e.ctrlKey || e.metaKey)) {
        if (!occupancyMap.has(`${gx},${gy}`)) {
          setDrawState({ startX: gx, startY: gy, endX: gx, endY: gy })
        }
      } else {
        setBoxSelectState({ startX: gx, startY: gy, endX: gx, endY: gy })
      }
      return
    }
    // Free mode: no grid cells — start box-select from mouse position if not on an item
    if (containerRef.current && !(e.target as HTMLElement).closest('[data-item-id]')) {
      const coord = adapter.mouseToCoord(e.clientX, e.clientY, containerRef.current)
      e.preventDefault()
      setBoxSelectState({ startX: coord.x, startY: coord.y, endX: coord.x, endY: coord.y })
    }
  }, [dragState, resizeState, canDraw, occupancyMap, adapter])

  // handleGridMouseOver: extends draw/box-select range as mouse moves over cells
  const handleGridMouseOver = useCallback((e: React.MouseEvent) => {
    if (!drawState && !boxSelectState) {
      return
    }
    const target = (e.target as HTMLElement).closest('[data-gx]') as HTMLElement | null
    if (!target) {
      return
    }
    const gx = parseInt(target.dataset.gx!)
    const gy = parseInt(target.dataset.gy!)
    if (drawState) {
      setDrawState(s => s ? { ...s, endX: gx, endY: gy } : null)
    }
    if (boxSelectState) {
      setBoxSelectState(s => s ? { ...s, endX: gx, endY: gy } : null)
    }
  }, [drawState, boxSelectState])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    let el = e.target as HTMLElement | null
    while (el && el !== e.currentTarget) {
      if (el.dataset.itemId) {
        setContextItemId(el.dataset.itemId)
        onContextMenu(el.dataset.itemId)
        return
      }
      el = el.parentElement
    }
    setContextItemId(null)
    onContextMenu(null)
  }, [onContextMenu])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="flex-1 min-h-0 flex flex-col"
        onContextMenu={handleContextMenu}
      >
        <div
          ref={containerRef}
          className="relative"
          onMouseMove={handleGridMouseMove}
          onMouseUp={handleGridMouseUp}
          onMouseLeave={handleGridMouseLeave}
          onMouseDown={handleGridMouseDown}
          onMouseOver={handleGridMouseOver}
          style={adapter.containerStyle()}
        >
          {/* Background (grid cells, dot pattern, etc.) */}
          {adapter.renderBackground(occupancyMap, drawState)}

          {/* Adapter drag overlay (e.g. snap guides in free mode) */}
          {dragOverlay}

          {/* Drag ghost overlays */}
          {dragState && dropCoord && dragState.offsets.map(({ id, dx, dy }) => {
            const di = items.find(i => i.id === id)
            if (!di) {
              return null
            }
            const rect = adapter.ghostRect(di, dropCoord, { dx, dy })
            return (
              <div
                key={`ghost-${id}`}
                className="absolute rounded-sm pointer-events-none z-20"
                style={{
                  left: rect.left,
                  top:  rect.top,
                  width:  rect.width,
                  height: rect.height,
                  background: 'color-mix(in oklch, var(--primary) 40%, transparent)',
                  outline: '2px solid rgba(255,255,255,0.4)',
                }}
              />
            )
          })}

          {/* Box-select overlay */}
          {boxSelectState && (() => {
            const rect = adapter.boxSelectRect(
              { x: boxSelectState.startX, y: boxSelectState.startY },
              { x: boxSelectState.endX,   y: boxSelectState.endY   },
            )
            return (
              <div
                className="absolute pointer-events-none z-20"
                style={{
                  left: rect.left, top: rect.top,
                  width: rect.width, height: rect.height,
                  border: '2px dashed var(--primary)',
                  background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
                }}
              />
            )
          })()}

          {/* Resize ghost overlay */}
          {resizeState && (() => {
            const item = items.find(i => i.id === resizeState.itemId)
            if (!item) {
              return null
            }
            const rect = adapter.resizeGhostRect(item, resizeState.previewDims)
            return (
              <div
                className="absolute rounded-sm pointer-events-none z-30"
                style={{
                  left: rect.left, top: rect.top,
                  width: rect.width, height: rect.height,
                  border: '2px dashed var(--primary)',
                  background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
                }}
              >
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-primary text-primary-foreground whitespace-nowrap">
                  {adapter.resizeLabel(resizeState.previewDims)}
                </span>
              </div>
            )
          })()}

          {/* Items */}
          {items.map(item => {
            const itemRect    = adapter.itemRect(item)
            const isSelected  = selectedItemIds.has(item.id)
            const isDragging  = dragState?.offsets.some(o => o.id === item.id) ?? false
            const isResizing  = resizeState?.itemId === item.id
            const isSearchMatch = searchTerm !== '' && item.name.toLowerCase().includes(searchTerm)
            const ctx: ItemRenderCtx = {
              isSelected,
              isDragging,
              isResizing,
              isSearchMatch,
              cardRect: { width: itemRect.width, height: itemRect.height },
            }
            return (
              <div
                key={item.id}
                data-item-id={item.id}
                onMouseDown={(e) => handleItemMouseDown(e, item)}
                onClick={(e) => {
                  if (suppressNextClick.current) { suppressNextClick.current = false; return }
                  onItemClick(item.id, e.ctrlKey || e.metaKey || selectedItemIds.has(item.id))
                }}
                onDoubleClick={() => onItemDoubleClick(item.id)}
                className={cn(
                  "absolute rounded-sm transition-all",
                  item.locked ? "cursor-default" : "cursor-move",
                  isSelected && !isResizing && "ring-1 ring-primary ring-offset-1 ring-offset-background",
                  isDragging && "opacity-0",
                  !isSelected && !isDragging && selectedItemIds.size > 0 && "opacity-50",
                  isResizing && "opacity-40",
                )}
                style={{
                  left:   itemRect.left,
                  top:    itemRect.top,
                  width:  itemRect.width,
                  height: itemRect.height,
                  zIndex: isSelected ? 10 : 1,
                  transition: isResizing ? 'none' : 'opacity 0.1s',
                  pointerEvents: (
                    drawState ||
                    (pendingDrag && pendingDrag.item.id !== item.id) ||
                    (dragState && dragState.itemId !== item.id) ||
                    (resizeState && resizeState.itemId !== item.id)
                  ) ? 'none' : undefined,
                }}
              >
                {renderItem(item, ctx)}

                {/* Resize handles — rendered by ItemCanvas so renderItem stays content-only */}
                {canResize && isSelected && !item.locked && (
                  <>
                    <div
                      className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 bg-white border border-primary cursor-e-resize z-20"
                      onMouseDown={(e) => handleResizeStart(e, item, 'e')}
                    />
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-white border border-primary cursor-s-resize z-20"
                      onMouseDown={(e) => handleResizeStart(e, item, 's')}
                    />
                    <div
                      className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 bg-white border border-primary cursor-se-resize z-20"
                      onMouseDown={(e) => handleResizeStart(e, item, 'se')}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
      </ContextMenuTrigger>
      {renderContextMenu(contextItemId)}
    </ContextMenu>
  )
}
