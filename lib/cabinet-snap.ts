import type { CabinetItem } from '@/lib/types'

export interface SnapGuide {
  axis: 'x' | 'y'
  positionPx: number
}

export interface SnapResult {
  deltaXMm: number
  deltaYMm: number
  guides: SnapGuide[]
}

/**
 * Compute snap deltas and alignment guides for a group of dragged items.
 *
 * For each axis independently, the bounding box of the dragged group has three
 * candidate snap lines (left/right/center for X; top/bottom/center for Y).
 * Each static item also has three snap lines per axis. We find the closest
 * (dragged line, static line) pair within the threshold and snap to it.
 */
export function computeSnap(
  dragged: CabinetItem[],
  statics: CabinetItem[],
  scale: number,
  thresholdPx: number,
): SnapResult {
  if (dragged.length === 0 || statics.length === 0) {
    return { deltaXMm: 0, deltaYMm: 0, guides: [] }
  }

  const thresholdMm = thresholdPx / scale

  // Bounding box of dragged group
  const minX = Math.min(...dragged.map(d => d.x))
  const maxX = Math.max(...dragged.map(d => d.x + d.widthMm))
  const midX = (minX + maxX) / 2
  const minY = Math.min(...dragged.map(d => d.y))
  const maxY = Math.max(...dragged.map(d => d.y + d.heightMm))
  const midY = (minY + maxY) / 2

  const draggedXLines = [minX, maxX, midX]
  const draggedYLines = [minY, maxY, midY]

  // Collect all static snap lines
  const staticXLines: number[] = []
  const staticYLines: number[] = []
  for (const s of statics) {
    staticXLines.push(s.x, s.x + s.widthMm, s.x + s.widthMm / 2)
    staticYLines.push(s.y, s.y + s.heightMm, s.y + s.heightMm / 2)
  }

  let bestDistX = thresholdMm + 1
  let bestDeltaX = 0
  let snapLineX = 0

  for (const dragLine of draggedXLines) {
    for (const staticLine of staticXLines) {
      const dist = Math.abs(dragLine - staticLine)
      if (dist < bestDistX) {
        bestDistX = dist
        bestDeltaX = staticLine - dragLine
        snapLineX = staticLine
      }
    }
  }

  let bestDistY = thresholdMm + 1
  let bestDeltaY = 0
  let snapLineY = 0

  for (const dragLine of draggedYLines) {
    for (const staticLine of staticYLines) {
      const dist = Math.abs(dragLine - staticLine)
      if (dist < bestDistY) {
        bestDistY = dist
        bestDeltaY = staticLine - dragLine
        snapLineY = staticLine
      }
    }
  }

  const snapX = bestDistX <= thresholdMm
  const snapY = bestDistY <= thresholdMm
  const deltaXMm = snapX ? bestDeltaX : 0
  const deltaYMm = snapY ? bestDeltaY : 0

  const guides: SnapGuide[] = []
  if (snapX) {
    guides.push({ axis: 'x', positionPx: snapLineX * scale })
  }
  if (snapY) {
    guides.push({ axis: 'y', positionPx: snapLineY * scale })
  }

  return { deltaXMm, deltaYMm, guides }
}
