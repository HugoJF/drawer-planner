import { describe, expect, test } from 'bun:test'
import { DrawerFreeAdapter } from '@/components/canvas/drawer-free-adapter'
import { DEFAULT_CONFIG, FootprintMode, ItemRotation } from '@/lib/types'
import type { Drawer, Item } from '@/lib/types'

const drawer: Drawer = {
  id: 'drawer-1',
  name: 'Drawer',
  width: 100,
  height: 50,
  depth: 100,
  gridCols: 2,
  gridRows: 2,
  cabinetX: 0,
  cabinetY: 0,
  gridless: true,
}

function makeItem(id: string, posX: number, posY: number, width: number, depth: number): Item {
  return {
    id,
    name: id,
    width,
    height: 10,
    depth,
    categoryId: null,
    rotation: ItemRotation.HeightUp,
    drawerId: drawer.id,
    posX,
    posY,
    footprintMode: FootprintMode.Auto,
    locked: false,
  }
}

function container(): HTMLElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) }),
  } as HTMLElement
}

describe('DrawerFreeAdapter', () => {
  test('clamps multi-item drag by full group bounds', () => {
    // Arrange
    const anchor = makeItem('anchor', 40, 40, 20, 20)
    const right = makeItem('right', 70, 70, 20, 20)
    const items = [anchor, right]
    const adapter = new DrawerFreeAdapter(drawer, DEFAULT_CONFIG, items)
    const init = adapter.initDrag(anchor, items, new Set(items.map(i => i.id)))

    // Act
    const drop = adapter.computeDrop(1000, 1000, 0, 0, {
      itemId: anchor.id,
      grabPxX: 0,
      grabPxY: 0,
      anchorSize: init.anchorSize,
      offsets: init.offsets,
      adapterData: init.adapterData,
    }, container())

    // Assert
    expect(drop).toEqual({ x: 50, y: 50 })
  })
})
