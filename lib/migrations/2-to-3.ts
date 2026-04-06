export interface StateV2 {
  version: 2
  drawers?: unknown[]
  [key: string]: unknown
}

export interface StateV3 {
  version: 3
  drawers: unknown[]
  [key: string]: unknown
}

export function twoTo3(raw: StateV2): StateV3 {
  return {
    ...raw,
    version: 3,
    drawers: (raw.drawers ?? []).map((d) => ({
      cabinetX: 0,
      cabinetY: 0,
      ...(d as Record<string, unknown>),
    })),
  }
}
