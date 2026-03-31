# Gridfinity Drawer Planner

A visual planner for organizing [Gridfinity](https://www.youtube.com/watch?v=ra_9zU-mnl8) bins inside physical drawers. Measure your drawer, add your items, and see exactly how everything fits before you print a single bin.

<!-- screenshots here -->

## Features

- **Visual grid editor** — drag items to reposition, resize with handles, draw-to-create new items directly on the grid
- **Multi-selection** — Ctrl+click to toggle selection; drag all selected unlocked items together as a group with ghost overlays
- **Bulk operations** — delete, lock/unlock, or move multiple items at once via context menu or keyboard
- **Categories** — assign items to named, colored categories via form or context menu; color is derived from the category, not the item
- **Sidebar tabs** — Drawers tab (Drawer → Category → Item) and Categories tab (cross-drawer Category → Item view with edit/delete); categories have their own context menu in both tabs
- **Rotation modes** — place items upright, on their side, or rotated 90°, each affecting grid footprint differently
- **Overlap & oversize warnings** — instant visual feedback when items collide or are too tall for the drawer
- **Lock items** — prevent accidental moves or edits on placed items
- **Search** — filter items by name (Ctrl+F); matches highlight in the grid, non-matches dim
- **Undo / redo** — 50-step history with Ctrl+Z / Ctrl+Y; history panel with click-to-jump
- **Import & export** — save your layout to JSON and load it back anytime
- **mm / cm** — switch display units without losing data (all stored internally in mm)
- **Stats panel** — grid utilization, volume percentage, dead room (unused height), and height warnings per drawer
- **Configurable sidebar** — toggle drawer/category item counts; choose between area (20U) or dimension (5×4) item size display; control category default expansion (none, categorized, all)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+F` | Search items |
| `Ctrl+A` | Select all items in drawer |
| `Delete` / `Backspace` | Delete selected item(s) |
| `D` | Duplicate selected item |
| `E` | Edit selected item |
| `R` | Cycle rotation of selected item |
| `↑ ↓ ← →` | Move selected item(s) one grid cell |
| `Escape` | Clear search / deselect |
| `?` | Show keyboard shortcuts cheatsheet |

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build
```

Requires [Bun](https://bun.sh) (or Node.js 18+, swap `bun` for `npm`).

## How It Works

1. **Add a drawer** — enter its internal width, depth, and height in your preferred unit
2. **Add items** — enter each item's physical dimensions; the planner calculates how many Gridfinity cells it occupies
3. **Arrange** — drag items on the grid, resize them, rotate them; warnings appear automatically when something doesn't fit
4. **Export** — save your layout as JSON to share or back up

The grid cell size and tolerance are configurable in Settings (default: 42 mm cell, 0.5 mm tolerance — standard Gridfinity spec).

## Tech Stack

- [Next.js](https://nextjs.org) (App Router) + [React](https://react.dev)
- [Zustand](https://zustand-demo.pmnd.rs) for state management (with localStorage persistence and undo history)
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Radix UI](https://www.radix-ui.com) primitives

## Contributing

Issues and PRs are welcome. Run tests with:

```bash
bun test
```

## License

MIT
