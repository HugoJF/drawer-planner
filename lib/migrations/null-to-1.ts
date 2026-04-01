import type { Category, Item } from '../types'
import { ItemRotation } from '../types'

export interface StateV0 {
  config?: unknown
  drawers?: unknown[]
  items?: unknown[]
  categories?: unknown[]
}

export interface StateV1 {
  version: 1
  config?: unknown
  drawers: unknown[]
  items: Item[]
  categories: Category[]
}

export function nullTo1(raw: StateV0): StateV1 {
  const legacyRotation: Record<string, ItemRotation> = {
    normal:  ItemRotation.HeightUp,
    layDown: ItemRotation.DepthUp,
    rotated: ItemRotation.HeightUpR,
  }
  return {
    ...raw,
    version: 1,
    drawers: raw.drawers ?? [],
    items: (raw.items ?? []).map((i) => {
      const item = i as Item & { locked?: boolean; categoryId?: string | null }
      return {
        ...item,
        locked: item.locked ?? false,
        categoryId: item.categoryId ?? null,
        rotation: (legacyRotation[item.rotation as unknown as string] ?? item.rotation) as ItemRotation,
      }
    }),
    categories: (raw.categories ?? []) as Category[],
  }
}
