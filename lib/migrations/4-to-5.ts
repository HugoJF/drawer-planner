export interface StateV4 {
  version: 4
  drawers?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface StateV5 {
  version: 5
  [key: string]: unknown
}

/**
 * Backfill gridless: false on all existing drawers.
 * The `gridless` field was added in v5 to mark drawers that use
 * free mm-based item positioning instead of Gridfinity grid cells.
 */
export function fourTo5(raw: StateV4): StateV5 {
  return {
    ...raw,
    version: 5,
    drawers: (raw.drawers ?? []).map(d => ({ gridless: false, ...d })),
  }
}
