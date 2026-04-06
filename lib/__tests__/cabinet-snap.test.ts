import { describe, test, expect } from 'bun:test'
import { computeSnap } from '@/lib/cabinet-snap'
import type { CabinetItem } from '@/lib/types'

function makeItem(id: string, x: number, y: number, w: number, h: number): CabinetItem {
  return { id, label: id, widthMm: w, heightMm: h, x, y }
}

const SCALE = 1   // 1 px/mm (simplifies threshold comparisons)
const THRESHOLD = 8

describe('computeSnap', () => {
  test('returns zero deltas and no guides when no static items', () => {
    // Arrange
    const dragged = [makeItem('a', 10, 10, 50, 30)]

    // Act
    const result = computeSnap(dragged, [], SCALE, THRESHOLD)

    // Assert
    expect(result.deltaXMm).toBe(0)
    expect(result.deltaYMm).toBe(0)
    expect(result.guides).toHaveLength(0)
  })

  test('returns zero deltas and no guides when dragged is empty', () => {
    // Arrange
    const statics = [makeItem('b', 100, 100, 50, 30)]

    // Act
    const result = computeSnap([], statics, SCALE, THRESHOLD)

    // Assert
    expect(result.deltaXMm).toBe(0)
    expect(result.deltaYMm).toBe(0)
    expect(result.guides).toHaveLength(0)
  })

  test('snaps left edge of dragged to right edge of static when within threshold', () => {
    // Arrange — dragged left edge at 108, static right edge at 100 (diff = 8, at threshold)
    // Y positions are far apart so only X snaps
    const dragged  = [makeItem('a', 108, 500, 50, 30)]
    const statics  = [makeItem('b',  50, 200, 50, 30)]  // right edge = 100

    // Act
    const result = computeSnap(dragged, statics, SCALE, THRESHOLD)

    // Assert — should snap left edge 108 → 100
    expect(result.deltaXMm).toBe(-8)
    expect(result.guides).toHaveLength(1)
    expect(result.guides[0].axis).toBe('x')
    expect(result.guides[0].positionPx).toBe(100)
  })

  test('does not snap X when distance exceeds threshold', () => {
    // Arrange — dragged left edge at 120, static right edge at 100 (diff = 20 > 8)
    const dragged = [makeItem('a', 120, 200, 50, 30)]
    const statics = [makeItem('b',  50, 200, 50, 30)]

    // Act
    const result = computeSnap(dragged, statics, SCALE, THRESHOLD)

    // Assert
    expect(result.deltaXMm).toBe(0)
    expect(result.guides.filter(g => g.axis === 'x')).toHaveLength(0)
  })

  test('snaps Y axis independently', () => {
    // Arrange — dragged top at 105, static bottom at 100 (diff = 5 < 8)
    // X positions are far apart so only Y snaps
    const dragged = [makeItem('a', 500, 105, 50, 30)]
    const statics = [makeItem('b', 200,  70, 50, 30)]  // bottom = 100

    // Act
    const result = computeSnap(dragged, statics, SCALE, THRESHOLD)

    // Assert
    expect(result.deltaYMm).toBe(-5)
    expect(result.guides).toHaveLength(1)
    expect(result.guides[0].axis).toBe('y')
    expect(result.guides[0].positionPx).toBe(100)
  })

  test('snaps both axes simultaneously', () => {
    // Arrange — dragged at (108, 105), statics with right edge 100 and bottom edge 100
    const dragged = [makeItem('a', 108, 105, 50, 30)]
    const statics = [makeItem('b',  50,  70, 50, 30)]

    // Act
    const result = computeSnap(dragged, statics, SCALE, THRESHOLD)

    // Assert
    expect(result.deltaXMm).toBe(-8)
    expect(result.deltaYMm).toBe(-5)
    expect(result.guides).toHaveLength(2)
  })

  test('emits a guide even when snap delta is zero (items already aligned)', () => {
    // Arrange — dragged left edge exactly at static left edge (dist=0, delta=0)
    // Y positions are far apart so only X snaps
    const dragged = [makeItem('a', 50, 500, 10, 30)]
    const statics = [makeItem('b', 50, 200, 54, 30)]   // same left edge = 50

    // Act
    const result = computeSnap(dragged, statics, SCALE, THRESHOLD)

    // Assert — already aligned: delta=0, but guide is still emitted
    expect(result.deltaXMm).toBe(0)
    expect(result.guides).toHaveLength(1)
    expect(result.guides[0].axis).toBe('x')
  })

  test('handles multi-item dragged group bounding box', () => {
    // Arrange — two items forming a group with left edge at 20 and right edge at 120
    const dragged = [
      makeItem('a', 20, 0, 50, 30),
      makeItem('b', 70, 0, 50, 30),
    ]
    // Static: right edge at 200 (far), left edge at 13 (diff from group-left 20 = 7 < 8)
    const statics = [makeItem('c', 13, 100, 50, 30)]   // left = 13, right = 63, center = 38

    // Act
    const result = computeSnap(dragged, statics, SCALE, THRESHOLD)

    // Assert — group left(20) snaps to static left(13), delta = -7
    expect(result.deltaXMm).toBe(-7)
    expect(result.guides).toHaveLength(1)
  })

  test('chooses the closest snap line when multiple candidates are within threshold', () => {
    // Arrange — dragged left at 98; two static candidates at 100 (diff=2) and 104 (diff=6)
    const dragged = [makeItem('a', 98, 200, 50, 30)]
    const statics = [
      makeItem('b',  50, 200, 50, 30),   // right edge = 100 (diff = 2)
      makeItem('c', 100, 200, 54, 30),   // right edge = 154; left = 100 (diff = 2 too) — but center = 127
      makeItem('d',  54, 200, 50, 30),   // right edge = 104 (diff = 6)
    ]

    // Act
    const result = computeSnap(dragged, statics, SCALE, THRESHOLD)

    // Assert — closest is 100 (diff = 2), so delta = +2
    expect(result.deltaXMm).toBe(2)
  })
})
