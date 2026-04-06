export interface StateV3 {
  version: 3
  config?: { cellSize?: number }
  items?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface StateV4 {
  version: 4
  [key: string]: unknown
}

/**
 * Migrate Item fields from grid-cell-based to mm-based coordinates.
 * gridX/gridY → posX/posY (mm = cell * cellSize)
 * gridMode → footprintMode (same values: 'auto'|'manual')
 * manualGridCols/manualGridRows → footprintW/footprintH (mm = cells * cellSize)
 */
export function threeTo4(raw: StateV3): StateV4 {
  const cellSize = raw.config?.cellSize ?? 42
  return {
    ...raw,
    version: 4,
    items: (raw.items ?? []).map((item) => {
      const { gridX, gridY, gridMode, manualGridCols, manualGridRows, ...rest } = item
      const posX = typeof gridX === 'number' ? gridX * cellSize : 0
      const posY = typeof gridY === 'number' ? gridY * cellSize : 0
      const footprintMode = gridMode ?? 'auto'
      const result: Record<string, unknown> = { ...rest, posX, posY, footprintMode }
      if (typeof manualGridCols === 'number') {
        result.footprintW = manualGridCols * cellSize
      }
      if (typeof manualGridRows === 'number') {
        result.footprintH = manualGridRows * cellSize
      }
      return result
    }),
  }
}
