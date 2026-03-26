# Code Review: Drawer Planner

**Reviewed:** 2026-03-25
**Scope:** `app/page.tsx`, `components/drawer-planner/drawer-form.tsx`, `components/drawer-planner/item-form.tsx`, `components/drawer-planner/delete-confirm-dialog.tsx`, `components/drawer-planner/drawer-grid.tsx`, `components/drawer-planner/drawer-tree.tsx`, `components/drawer-planner/sidebar-stats.tsx`, `hooks/use-toast.ts`, `lib/store.ts`

---

## Summary of Issues Found

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | High | `hooks/use-toast.ts:182` | `useEffect` dependency `[state]` causes listener churn — every toast state change unregisters and re-registers the listener |
| 2 | High | `components/drawer-planner/drawer-form.tsx:39` | `useEffect` syncing form state from props is an anti-pattern; React docs recommend `key` prop reset instead |
| 3 | High | `components/drawer-planner/item-form.tsx:55` | Same `useEffect`-to-sync-state anti-pattern as `drawer-form.tsx`; also contains a non-deterministic random call inside the effect |
| 4 | High | `app/page.tsx:56` | Keyboard handler `useEffect` closes over `allItems` — stale closure risk for the `'e'` / `'r'` key paths since `handleEditItem` is not in the dependency array |
| 5 | Medium | `components/drawer-planner/delete-confirm-dialog.tsx:34` | `useEffect` used to reset checkbox on open; should be replaced with `key` prop reset |
| 6 | Medium | `components/drawer-planner/drawer-grid.tsx:1` | `useEffect` imported but never used in the file |
| 7 | Medium | `components/drawer-planner/drawer-grid.tsx:97` | Magic number `cellSize = 40` (px) is hardcoded as a plain local constant; the `calc(100vh - 300px)` on line 215 is a second magic number |
| 8 | Medium | `components/drawer-planner/drawer-grid.tsx:224` | `onMouseMove`, `onMouseUp`, and `onMouseLeave` handlers on the grid div are large inline arrow functions recreated every render |
| 9 | Medium | `components/drawer-planner/drawer-grid.tsx:309` | `onMouseDown` and `onMouseEnter` handlers inside the per-cell render loop are inline arrow functions, creating new function instances for every cell on every render |
| 10 | Medium | `components/drawer-planner/drawer-tree.tsx:154` | `drawerItems` is re-filtered inline inside the `drawers.map` callback instead of being derived once outside the loop or in a `useMemo` |
| 11 | Low | `components/drawer-planner/item-form.tsx:69` | `Math.random()` called inside a `useEffect` to pick the default color produces a non-deterministic initial value and will differ between server and client in React's strict-mode double-invoke |
| 12 | Low | `lib/store.ts:9` | `TOAST_REMOVE_DELAY = 1000000` (≈16 minutes) in `use-toast.ts` — toasts are never auto-dismissed in practice |
| 13 | Low | `lib/store.ts` | `undo` and `redo` destructure `selectedDrawerId`/`selectedItemId` from `get()` but those two values are not part of the `Snapshot` type, so a redo after selection-change silently preserves the stale selection |

---

## High Severity

---

### Issue 1 — `useEffect` in `use-toast.ts` re-registers listener on every state change

**File:** `hooks/use-toast.ts`, line 182

**Problem:**
The dependency array is `[state]`, so every time a toast is added, updated, or dismissed, the effect fires, splices `setState` out of the module-level `listeners` array, and immediately pushes it back in. During the brief window between the splice and the re-push, any dispatch that happens will miss this subscriber.

```ts
// BEFORE
React.useEffect(() => {
  listeners.push(setState)
  return () => {
    const index = listeners.indexOf(setState)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }
}, [state])   // <-- fires on every state change
```

**Why it is a problem:**
The intent of the effect is purely to register `setState` once when the component mounts and deregister it on unmount. `state` is not used inside the effect body at all — it ended up in the dependency array by accident (probably from an auto-fixer). The churn is harmless most of the time but creates a subtle race condition when multiple toasts fire in quick succession, and it causes unnecessary renders in every component that calls `useToast()`.

**Fix:**
```ts
// AFTER
React.useEffect(() => {
  listeners.push(setState)
  return () => {
    const index = listeners.indexOf(setState)
    if (index > -1) {
      listeners.splice(index, 1)
    }
  }
}, [])   // register once on mount, deregister on unmount
```

---

### Issue 2 — `useEffect` syncing form state from props in `DrawerForm`

**File:** `components/drawer-planner/drawer-form.tsx`, lines 39–51

**Problem:**
The form uses `useEffect` to copy `drawer` prop values into local state whenever `drawer`, `open`, or `unit` changes. This is the "syncing state from props" anti-pattern explicitly called out in the React docs.

```ts
// BEFORE — in DrawerForm
useEffect(() => {
  if (drawer) {
    setName(drawer.name)
    setWidth(toDisplayUnit(drawer.width, unit).toString())
    // ...
  } else {
    setName('')
    // ...
  }
}, [drawer, open, unit])
```

**Why it is a problem:**
1. There is a one-render lag: the form briefly renders stale values before the effect fires.
2. The `open` prop is in the dependency array to handle "re-open with a different drawer", but this causes the effect to run even when the dialog closes (`open = false`), needlessly resetting state.
3. If `unit` changes while the dialog is open the fields are silently reset to the stored-unit values, discarding any in-progress edits.

**Fix:**
Delete the `useEffect` entirely. Pass a `key` that changes when the relevant identity changes, which causes React to unmount and remount the component with fresh state:

```tsx
// AFTER — in the parent (app/page.tsx)
<DrawerForm
  key={editingDrawer?.id ?? 'new'}
  open={drawerFormOpen}
  onOpenChange={setDrawerFormOpen}
  drawer={editingDrawer}
/>
```

Then initialise state directly from props:

```ts
// AFTER — in DrawerForm
const [name, setName] = useState(() => drawer?.name ?? '')
const [width, setWidth] = useState(() =>
  drawer ? toDisplayUnit(drawer.width, unit).toString() : ''
)
// ...
```

The `unit`-change case (issue 3 above) can be handled separately with a `useMemo` that converts on the fly for display, rather than syncing into state.

---

### Issue 3 — `useEffect` syncing form state from props in `ItemForm`

**File:** `components/drawer-planner/item-form.tsx`, lines 55–73

**Problem:**
Identical anti-pattern to Issue 2. Additional concern: `Math.random()` is called inside the effect body (line 69) to pick the initial color, which means:
- Every time the dialog re-renders and the effect re-fires (e.g. `unit` changes), the color is randomised again, discarding the user's selection.
- Under React Strict Mode (dev), the effect runs twice, producing two different random values and leaving a different color than the first run.

```ts
// BEFORE
useEffect(() => {
  if (item) {
    // ... set fields from item
  } else {
    setColor(ITEM_COLORS[Math.floor(Math.random() * ITEM_COLORS.length)])
    // ...
  }
}, [item, open, selectedDrawerId, unit, initialDimensions])
```

**Fix:**
Apply the same `key`-prop reset strategy as Issue 2. Move the random color pick into the `useState` initialiser (runs exactly once, on mount):

```ts
// AFTER
const [color, setColor] = useState<string>(
  () => item?.color ?? ITEM_COLORS[Math.floor(Math.random() * ITEM_COLORS.length)]
)
```

---

### Issue 4 — Stale closure risk in the keyboard `useEffect` in `page.tsx`

**File:** `app/page.tsx`, lines 56–81

**Problem:**
`handleEditItem` is defined at line 107 as a plain function inside the component body. It is referenced inside the `useEffect` callback (line 71) but is **not listed in the dependency array**. The effect therefore captures the initial version of `handleEditItem` from the first render, which closes over the initial values of `editingItem`, `newItemPosition`, and `setItemFormOpen`. The dependency array is:

```ts
}, [undo, redo, selectedItemId, allItems, deleteItem, updateItem, drawerFormOpen, itemFormOpen])
```

**Why it is a problem:**
If React ever re-creates the effect (which it will whenever any of the listed deps change), the freshly-created handler gets the current `handleEditItem`. But during the window where the deps *haven't* changed since the last run, the stale `handleEditItem` is used. In practice the stale reference always calls `setEditingItem` and `setItemFormOpen` which are stable setter refs, so the visible bug is small — but the pattern is fragile and will become a real bug if `handleEditItem` is ever extended to read local state that changes between renders.

**Fix:**
Either wrap `handleEditItem` in `useCallback` and add it to the dependency array, or inline the body of `handleEditItem` directly inside the effect:

```ts
// AFTER (option A — useCallback)
const handleEditItem = useCallback((item: Item) => {
  setEditingItem(item)
  setNewItemPosition(null)
  setItemFormOpen(true)
}, []) // setters are stable

// then add it to the dep array:
}, [undo, redo, selectedItemId, allItems, deleteItem, updateItem,
    drawerFormOpen, itemFormOpen, handleEditItem])
```

---

## Medium Severity

---

### Issue 5 — `useEffect` to reset checkbox state in `DeleteConfirmDialog`

**File:** `components/drawer-planner/delete-confirm-dialog.tsx`, lines 34–36

**Problem:**
```ts
// BEFORE
useEffect(() => {
  if (open) setDeleteContents(false)
}, [open])
```

**Why it is a problem:**
This is the lighter variant of the "sync from props" anti-pattern. The effect fires after the render in which `open` flips to `true`, so the dialog briefly renders with whatever `deleteContents` was left over from the previous open (always `false` here, but the timing guarantee is weak). It also introduces an unnecessary extra render cycle each time the dialog opens.

**Fix:**
```tsx
// AFTER — in the parent, add a key tied to the dialog's identity
<DeleteConfirmDialog
  key={pendingDelete ? pendingDelete.id : 'closed'}
  open={pendingDelete !== null}
  ...
/>
```

This remounts the dialog (and its state) fresh each time a new deletion is triggered, with zero extra renders.

---

### Issue 6 — `useEffect` imported but never used in `drawer-grid.tsx`

**File:** `components/drawer-planner/drawer-grid.tsx`, line 3

**Problem:**
```ts
import React, { useState, useCallback, useMemo, useEffect } from 'react'
```

`useEffect` appears in the import list but is not called anywhere in the file.

**Why it is a problem:**
Dead imports add noise, confuse readers into looking for the effect, and may trigger lint warnings. Some bundlers also fail to tree-shake named imports that are unused.

**Fix:**
```ts
// AFTER
import React, { useState, useCallback, useMemo } from 'react'
```

---

### Issue 7 — Magic numbers in `drawer-grid.tsx`

**File:** `components/drawer-planner/drawer-grid.tsx`, lines 97 and 215

**Problem A — `cellSize = 40`:**
```ts
const cellSize = 40 // px for visualization
```
This constant is used in at least eight arithmetic expressions scattered through the render function (pixel offset calculations, style widths, resize ghost sizing). It is a plain `const` inside the component body, meaning it is redeclared on every render (minor), but more importantly the value is not co-located with the Tailwind cell-sizing tokens that determine the same visual size.

**Problem B — `calc(100vh - 300px)`:**
```tsx
style={{
  maxWidth: '100%',
  maxHeight: 'calc(100vh - 300px)',
}}
```
The `300` is the combined height of the header and padding guessed at a point in time. If the header height changes this number goes stale silently.

**Fix for A:**
Hoist `cellSize` to a module-level constant (or a theme token) so it is defined in one place:
```ts
// At module level
const CELL_PX = 40
```

**Fix for B:**
Use CSS containment or a flex layout so the grid container fills the available space without a hard-coded subtracted offset. At minimum, name the magic number:
```ts
const HEADER_HEIGHT_PX = 300 // sum of header + toolbar + padding
// or better: use h-full + overflow-auto on a flex child
```

---

### Issue 8 — Large inline handlers on the grid container recreated every render

**File:** `components/drawer-planner/drawer-grid.tsx`, lines 224–268

**Problem:**
The `onMouseMove`, `onMouseUp`, and `onMouseLeave` props on the inner grid `div` are written as multi-line inline arrow functions directly in JSX:

```tsx
onMouseMove={(e) => {
  if (!resizeState) return
  // ~8 lines of logic ...
}}
onMouseUp={(e) => {
  // ~20 lines of logic ...
}}
onMouseLeave={() => {
  setDrawState(null)
  setResizeState(null)
}}
```

**Why it is a problem:**
These functions are recreated on every render of `DrawerGrid`. `DrawerGrid` itself re-renders whenever any piece of store state changes (items, config, selection, etc.), which is frequent. While React does not re-attach DOM event listeners for inline handlers, it does compare the old and new props referentially, meaning child components that receive these as props will always see them as "changed". More practically, the `onMouseUp` handler is about 25 lines long — inline handlers of this complexity belong in named, `useCallback`-wrapped functions both for readability and so they appear in stack traces.

**Fix:**
Extract and memoize:
```ts
const handleMouseMove = useCallback((e: React.MouseEvent) => {
  if (!resizeState) return
  // ...
}, [resizeState, cellStep])

const handleMouseUp = useCallback((e: React.MouseEvent) => {
  // ...
}, [resizeState, drawState, items, config, updateItem, onAddItemAtCell])
```

---

### Issue 9 — Inline handlers inside the per-cell render loop

**File:** `components/drawer-planner/drawer-grid.tsx`, lines 309–316

**Problem:**
Inside the doubly-nested `Array.from` map that renders grid cells, each cell receives freshly created `onMouseDown` and `onMouseEnter` inline arrow functions:

```tsx
onMouseDown={(e) => {
  if (isOccupied || dragState || resizeState) return
  e.preventDefault()
  setDrawState({ startX: x, startY: y, endX: x, endY: y })
}}
onMouseEnter={() => {
  if (drawState) setDrawState(s => s ? { ...s, endX: x, endY: y } : null)
}}
```

A drawer with 10×7 cells (70 cells) creates 140 new function objects on every render. Renders are frequent (every pointer move during drag/resize).

**Why it is a problem:**
Each cell is a plain `div`, so referential instability does not cause React subtree bailouts. The cost here is allocation pressure and GC churn during interactive pointer operations, which is exactly when frame budget is tight.

**Fix:**
Attach a single `onMouseDown` / `onMouseEnter` on the grid container and use `data-*` attributes (already used for items via `data-item-id`) to identify the target cell:

```tsx
// On each cell div — no inline handlers
<div
  key={`${x}-${y}`}
  data-cx={x}
  data-cy={y}
  className={...}
  style={...}
/>

// On the grid container — one stable handler
const handleCellMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  const el = (e.target as HTMLElement).closest('[data-cx]') as HTMLElement | null
  if (!el) return
  const x = Number(el.dataset.cx)
  const y = Number(el.dataset.cy)
  if (occupancyMap.has(`${x},${y}`) || dragState || resizeState) return
  e.preventDefault()
  setDrawState({ startX: x, startY: y, endX: x, endY: y })
}, [occupancyMap, dragState, resizeState])
```

---

### Issue 10 — Per-render inline `filter` inside `drawers.map` in `DrawerTree`

**File:** `components/drawer-planner/drawer-tree.tsx`, line 154

**Problem:**
```ts
// Inside drawers.map(drawer => { ... })
const drawerItems = allItems.filter(i => i.drawerId === drawer.id)
```

This runs `allItems.filter` once per drawer per render. With N drawers and M items this is O(N×M) work on every render.

**Why it is a problem:**
`DrawerTree` subscribes to the full `allItems` array from the store, so it re-renders whenever any item changes anywhere. Combined with the O(N×M) filter, large libraries will cause noticeable jank on every keystroke in an item form (which triggers store updates).

**Fix:**
Compute the per-drawer item map once with `useMemo`:

```ts
const itemsByDrawer = useMemo(() => {
  const map = new Map<string, Item[]>()
  for (const item of allItems) {
    if (item.drawerId) {
      if (!map.has(item.drawerId)) map.set(item.drawerId, [])
      map.get(item.drawerId)!.push(item)
    }
  }
  return map
}, [allItems])

// Then in the map:
const drawerItems = itemsByDrawer.get(drawer.id) ?? []
```

---

## Low Severity

---

### Issue 11 — `Math.random()` inside `useEffect` for default item color

**File:** `components/drawer-planner/item-form.tsx`, line 69

Already described as part of Issue 3. Isolated here for completeness.

**Problem:**
```ts
setColor(ITEM_COLORS[Math.floor(Math.random() * ITEM_COLORS.length)])
```
Called inside a `useEffect` that fires whenever `open`, `item`, `selectedDrawerId`, `unit`, or `initialDimensions` changes. Under React Strict Mode the effect is invoked twice with different random results; the second invocation wins, but the value changes unpredictably between dev and production.

**Fix:**
Move the random pick into the `useState` initialiser (as shown in Issue 3's fix). Initialisers run exactly once per mount and are not affected by Strict Mode double-invocation.

---

### Issue 12 — `TOAST_REMOVE_DELAY` is effectively infinite

**File:** `hooks/use-toast.ts`, line 9

**Problem:**
```ts
const TOAST_REMOVE_DELAY = 1000000
```
`1_000_000` ms is approximately 16.7 minutes. Toasts are never removed from the DOM automatically; they persist until the user explicitly dismisses them or the component unmounts.

**Why it is a problem:**
This is almost certainly a placeholder that was never replaced with a real value. Stale toasts accumulate in the module-level `listeners` / `memoryState` and in the `toastTimeouts` map. If a user triggers many toasts over a long session, memory usage grows unbounded in `toastTimeouts` until each timer eventually fires 16 minutes later.

**Fix:**
Use a typical dismiss delay (e.g. 5000 ms for auto-dismiss) and ensure the value is named to communicate intent:
```ts
const TOAST_AUTO_DISMISS_MS = 5_000
```

---

### Issue 13 — Selection state excluded from undo snapshots leads to silent stale selections

**File:** `lib/store.ts`, lines 236–263

**Problem:**
The `Snapshot` type stores `{ drawers, items, config }`. The `undo` and `redo` actions restore those three fields and then patch `selectedDrawerId` / `selectedItemId` with a validity check:

```ts
selectedDrawerId: prev.drawers.some(d => d.id === selectedDrawerId) ? selectedDrawerId : null,
selectedItemId:   prev.items.some(i => i.id === selectedItemId)     ? selectedItemId  : null,
```

**Why it is a problem:**
The current live selection is used, not the selection that was current at the time the snapshot was taken. Scenario: user selects drawer B, then adds drawer C (snapshot taken before the add), then undoes. The undo correctly removes drawer C but keeps drawer B selected — which is fine. However, if the user had changed selection to drawer C *after* the snapshot was taken, and then undoes, the selection snaps back to null (C no longer exists) rather than to whatever was selected before C was created. The undo feels broken from the user's perspective.

**Fix:**
Add `selectedDrawerId` and `selectedItemId` to the `Snapshot` type and capture them in `snap()`:

```ts
type Snapshot = {
  drawers: Drawer[]
  items: Item[]
  config: GridfinityConfig
  selectedDrawerId: string | null
  selectedItemId: string | null
}

const snap = (): Snapshot => {
  const { drawers, items, config, selectedDrawerId, selectedItemId } = get()
  return { drawers, items, config, selectedDrawerId, selectedItemId }
}
```

Then restore them directly in `undo` / `redo` without the validity workaround (they were valid at snapshot time by definition).
