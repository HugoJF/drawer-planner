import type { ShortcutOptions } from '@/hooks/use-keyboard-shortcut'

export interface ShortcutDef extends ShortcutOptions {
  description: string | null  // null = hidden from cheatsheet
}

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Delete: 'Del', Backspace: '⌫', Escape: 'Esc',
}

export function formatShortcutKeys(def: ShortcutDef): string[] {
  const keys: string[] = []
  if (def.ctrl)  keys.push('Ctrl')
  if (def.shift) keys.push('Shift')
  if (def.alt)   keys.push('Alt')
  keys.push(KEY_LABELS[def.key] ?? (def.key.length === 1 ? def.key.toUpperCase() : def.key))
  return keys
}

// Single source of truth for key bindings and the shortcuts cheatsheet.
// Call sites:  useKeyboardShortcut(SHORTCUTS.undo, callback)
//              useKeyboardShortcut({ ...SHORTCUTS.selectAll, enabled: !isFormOpen }, callback)
// Dialog:      Object.values(SHORTCUTS).filter(s => s.description !== null)
// Adding a shortcut: add an entry here, then register it with useKeyboardShortcut in the relevant file.
export const SHORTCUTS = {
  undo:      { key: 'z', ctrl: true,              description: 'Undo' },
  redo:      { key: 'y', ctrl: true,              description: 'Redo' },
  redoAlt:   { key: 'z', ctrl: true, shift: true, description: null },
  search:    { key: 'f', ctrl: true,              description: 'Search items' },
  selectAll: { key: 'a', ctrl: true,              description: 'Select all in drawer' },
  delete:    { key: 'Delete',                     description: 'Delete selected item(s)' },
  backspace: { key: 'Backspace',                  description: null },
  copy:      { key: 'c', ctrl: true,              description: 'Copy selected item(s)' },
  paste:     { key: 'v', ctrl: true,              description: 'Paste item(s)' },
  duplicate: { key: 'd',                          description: 'Duplicate selected item' },
  edit:      { key: 'e',                          description: 'Edit selected item' },
  rotate:    { key: 'r',                          description: 'Rotate selected item' },
  moveUp:    { key: 'ArrowUp',                    description: 'Move selected item(s) one grid cell' },
  moveDown:  { key: 'ArrowDown',                  description: 'Move selected item(s) one grid cell' },
  moveLeft:  { key: 'ArrowLeft',                  description: 'Move selected item(s) one grid cell' },
  moveRight: { key: 'ArrowRight',                 description: 'Move selected item(s) one grid cell' },
  shortcuts: { key: '?',            shift: true,  description: 'Show this cheatsheet' },
} satisfies Record<string, ShortcutDef>
