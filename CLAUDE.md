# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev        # start dev server (Vite)
bun run build      # tsc -b && vite build
bun run lint       # eslint
bun test           # run all tests (Bun, not vitest)
bun test lib/__tests__/store.items.test.ts  # run a single test file
```

Tests use `bun:test` — never run them with `npx vitest`. TypeScript checking: `npx tsc --noEmit`.

## Architecture

### Tech stack
React + Vite, Zustand (state), Tailwind + shadcn/ui (`components/ui/`), Bun for tests.

### State (`lib/store.ts`)
Single Zustand store (`drawerStore` singleton, `createDrawerStore` factory for tests). All mutations call `push()` first to snapshot undo history. State persisted to `localStorage` via `partialize` (excludes selection and undo stacks). `onRehydrateStorage` runs migrations on load.

**`Snapshot` type** captures the full undoable state: `drawers`, `items`, `categories`, `config`, `pendingItems`, selection sets. When adding a new field that should be undoable, add it to `Snapshot`, `snap()`, and all four of `undo`/`redo`/`jumpToHistory`/`jumpToFuture`.

### Data model (`lib/types.ts`)
- **`Item`** — physical object with mm dimensions (`width/height/depth`), a `rotation` (6 orientations mapping physical axes to grid axes), `footprintMode` (Auto = calculated from dims; Manual = explicit `footprintW/H`), and a `drawerId` (null = unassigned).
- **`PendingItem`** — tracked item not yet measured (no dimensions). Promoted to a real `Item` via `measurePendingItem` in the store.
- **`Drawer`** — has mm dimensions + pre-computed `gridCols/gridRows`. `gridless: true` = free mm positioning instead of Gridfinity grid.
- **`CURRENT_VERSION = 5`** — bump and add a migration file in `lib/migrations/` whenever the persisted shape changes.

### Gridfinity math (`lib/gridfinity.ts`)
Core domain logic: cell calculation, rotation transforms, footprint resolution, overlap detection, color assignment. No React. Heavily tested — most test files cover this layer.

### Canvas system (`components/canvas/`)
`ItemCanvas` is a generic drag/resize/draw canvas that delegates all coordinate math to a **`CoordAdapter`**. Two implementations:
- **`GridAdapter`** — Gridfinity grid, works in cell units.
- **`DrawerFreeAdapter`** (wraps `FreeAdapter`) — gridless mm positioning with snap guides.

`DrawerGrid` (`components/drawer-planner/drawer-grid.tsx`) picks the right adapter based on `drawer.gridless` and passes it to `ItemCanvas`. When adding canvas behavior, implement it in the `CoordAdapter` interface first.

### Sidebar (`components/drawer-planner/drawer-tree/`)
Two sidebar versions (controlled by `config.sidebarVersion`):
- **v1**: Tabs (Drawers / Categories) + search box.
- **v2**: `DrawerScopedTab` — single drawer selector + category groups.

`DrawerTree` (index.tsx) orchestrates both versions: owns drag state, category form, delete confirmation, and the shared `itemProps()` builder that wires all item actions.

### Project management (`lib/projects-store.ts`)
Separate Zustand store for project metadata list. Individual project data stored in `localStorage` under `gdp-project-{id}` keys (not in the projects store itself). `drawerStore.loadProject()` / `exportData()` / `importData()` handle serialization.

### History labels (`lib/history.ts`)
`labelAction(before, after)` diffs two snapshots to produce a human-readable undo/redo label. Extend it when adding new undoable entities.

## Code Style

### if statements

Always use braces and put the body on its own line. Never write single-line ifs.

```ts
// bad
if (!x) return

// good
if (!x) {
  return
}
```

**Exception:** a run of short, visually aligned push/append statements is fine inline:

```ts
if (def.ctrl)  keys.push('Ctrl')
if (def.shift) keys.push('Shift')
if (def.alt)   keys.push('Alt')
```

## useEffect

**Do not use `useEffect` to synchronize one piece of state with another.** Writing `setFoo(derivedFrom(bar))` inside an effect is the anti-pattern.

- Pure derivation → `useMemo`
- Reset state when a value changes → call `setState` during render, guarded by a ref tracking the previous value (React's "storing information from previous renders" pattern):

```ts
const lastKeyRef = useRef(key)
if (lastKeyRef.current !== key) {
  lastKeyRef.current = key
  setFoo(initialValue) // triggers one extra render, no infinite loop
}
```

- Initial state from computation → `useState(() => compute())`

Legitimate effects: external subscriptions (event listeners, WebSockets), DOM mutations, network I/O.

An `// eslint-disable-line react-hooks/exhaustive-deps` is almost always a sign of a broken model — fix the model instead of suppressing the lint rule.

## Testing

Use the Arrange / Act / Assert pattern. Mark each phase with a comment:

```ts
test('description', () => {
  // Arrange
  const item = makeItem({ width: 84, depth: 42 })

  // Act
  const result = calculateItemGridDimensions(item, DEFAULT_CONFIG)

  // Assert
  expect(result.gridWidth).toBe(2)
})
```

When `beforeEach` provides the shared store/fixture, only add `// Arrange` in the test body for test-specific setup. If the test body starts directly with the action, begin with `// Act`.

Tests use `createDrawerStore(noopStorage)` (not the singleton) to get isolated instances. Import from `bun:test`, never from `vitest`.
