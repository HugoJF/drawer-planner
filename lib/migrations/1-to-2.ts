export interface StateV1 {
  version: 1
  items?: unknown[]
  [key: string]: unknown
}

export interface StateV2 {
  version: 2
  items: unknown[]
  [key: string]: unknown
}

export function oneTo2(raw: StateV1): StateV2 {
  return {
    ...raw,
    version: 2,
    items: (raw.items ?? []).map((i) => {
      const item = i as Record<string, unknown>
      if (item.gridMode !== undefined) {
        return item
      }
      // Default to 'auto' — will be renamed to footprintMode in the 3→4 migration
      return { ...item, gridMode: 'auto' }
    }),
  }
}
