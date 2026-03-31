import type { Snapshot } from '@/lib/store'

/**
 * Produce a human-readable label describing the action that transformed
 * `before` into `after`. Used by the history panel and undo/redo tooltips.
 */
export function labelAction(before: Snapshot, after: Snapshot): string {
  // Config change
  if (JSON.stringify(before.config) !== JSON.stringify(after.config)) return 'Updated settings'

  // Category changes
  const beforeCats = new Map(before.categories.map(c => [c.id, c]))
  const afterCats  = new Map(after.categories.map(c => [c.id, c]))
  const addedCats   = after.categories.filter(c => !beforeCats.has(c.id))
  const removedCats = before.categories.filter(c => !afterCats.has(c.id))
  if (addedCats.length === 1 && removedCats.length === 0)   return `Added category "${addedCats[0].name}"`
  if (removedCats.length === 1 && addedCats.length === 0)   return `Deleted category "${removedCats[0].name}"`
  if (addedCats.length === 0 && removedCats.length === 0) {
    const editedCat = after.categories.find(c => {
      const b = beforeCats.get(c.id)
      return b && JSON.stringify(b) !== JSON.stringify(c)
    })
    if (editedCat) {
      const b = beforeCats.get(editedCat.id)!
      if (b.name !== editedCat.name && b.color !== editedCat.color) return `Edited category "${editedCat.name}"`
      if (b.name !== editedCat.name)  return `Renamed category "${b.name}" → "${editedCat.name}"`
      if (b.color !== editedCat.color) return `Recolored category "${editedCat.name}"`
    }
  }

  // Drawer changes
  const beforeDrawers = new Map(before.drawers.map(d => [d.id, d]))
  const afterDrawers  = new Map(after.drawers.map(d => [d.id, d]))
  const addedDrawers   = after.drawers.filter(d => !beforeDrawers.has(d.id))
  const removedDrawers = before.drawers.filter(d => !afterDrawers.has(d.id))
  if (addedDrawers.length === 1 && removedDrawers.length === 0) return `Added drawer "${addedDrawers[0].name}"`
  if (removedDrawers.length === 1 && addedDrawers.length === 0) return `Deleted drawer "${removedDrawers[0].name}"`
  if (addedDrawers.length > 0 || removedDrawers.length > 0) return 'Changed drawers'
  // Drawer edited (same id, different fields)
  const editedDrawer = after.drawers.find(d => {
    const b = beforeDrawers.get(d.id)
    return b && JSON.stringify(b) !== JSON.stringify(d)
  })
  if (editedDrawer) return `Edited drawer "${editedDrawer.name}"`

  // Item changes
  const beforeItems = new Map(before.items.map(i => [i.id, i]))
  const afterItems  = new Map(after.items.map(i => [i.id, i]))
  const added   = after.items.filter(i => !beforeItems.has(i.id))
  const removed = before.items.filter(i => !afterItems.has(i.id))
  const changed = after.items.filter(i => {
    const b = beforeItems.get(i.id)
    return b && JSON.stringify(b) !== JSON.stringify(i)
  })

  if (added.length === 1 && removed.length === 0 && changed.length === 0) return `Added "${added[0].name}"`
  if (removed.length === 1 && added.length === 0 && changed.length === 0) return `Deleted "${removed[0].name}"`
  if (removed.length > 1 && added.length === 0 && changed.length === 0) return `Deleted ${removed.length} items`

  if (changed.length === 1 && added.length === 0 && removed.length === 0) {
    const b = beforeItems.get(changed[0].id)!
    const a = changed[0]
    if (b.name !== a.name)                                           return `Renamed "${b.name}" → "${a.name}"`
    if (b.gridX !== a.gridX || b.gridY !== a.gridY || b.drawerId !== a.drawerId) {
      if (b.drawerId !== a.drawerId) {
        const dest = a.drawerId ? after.drawers.find(d => d.id === a.drawerId)?.name : null
        if (!b.drawerId && dest)  return `Moved "${a.name}" to "${dest}"`
        if (b.drawerId && !dest)  return `Unassigned "${a.name}"`
        if (dest)                 return `Moved "${a.name}" to "${dest}"`
      }
      return `Moved "${a.name}"`
    }
    if (b.rotation !== a.rotation)                                   return `Rotated "${a.name}"`
    if (b.locked !== a.locked)                                       return a.locked ? `Locked "${a.name}"` : `Unlocked "${a.name}"`
    return `Edited "${a.name}"`
  }

  if (changed.length > 1 && added.length === 0 && removed.length === 0) {
    const allMoved = changed.every(a => {
      const b = beforeItems.get(a.id)!
      return b.gridX !== a.gridX || b.gridY !== a.gridY || b.drawerId !== a.drawerId
    })
    const allLockChanged = changed.every(a => beforeItems.get(a.id)!.locked !== a.locked)
    if (allMoved) {
      const destIds = new Set(changed.map(a => a.drawerId))
      if (destIds.size === 1) {
        const destId = [...destIds][0]
        const dest = destId ? after.drawers.find(d => d.id === destId)?.name : null
        const crossDrawer = changed.some(a => beforeItems.get(a.id)!.drawerId !== a.drawerId)
        if (crossDrawer && dest) return `Moved ${changed.length} items to "${dest}"`
      }
      return `Moved ${changed.length} items`
    }
    if (allLockChanged) return changed[0].locked ? `Locked ${changed.length} items` : `Unlocked ${changed.length} items`
    return `Changed ${changed.length} items`
  }

  return 'Changed'
}
