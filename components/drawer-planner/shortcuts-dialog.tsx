'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const SHORTCUTS = [
  { keys: ['Ctrl', 'Z'], description: 'Undo' },
  { keys: ['Ctrl', 'Y'], description: 'Redo' },
  { keys: ['Ctrl', 'F'], description: 'Search items' },
  { keys: ['Ctrl', 'A'], description: 'Select all items in drawer' },
  { keys: ['Delete'], description: 'Delete selected item(s)' },
  { keys: ['E'], description: 'Edit selected item' },
  { keys: ['R'], description: 'Rotate selected item' },
  { keys: ['↑ ↓ ← →'], description: 'Move selected item(s) one grid cell' },
  { keys: ['Escape'], description: 'Clear search / deselect' },
  { keys: ['?'], description: 'Show this cheatsheet' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUTS.map(({ keys, description }) => (
              <tr key={description} className="border-b border-border last:border-0">
                <td className="py-2 pr-4">
                  <div className="flex gap-1 flex-wrap">
                    {keys.map(k => (
                      <kbd
                        key={k}
                        className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs border border-border"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </td>
                <td className="py-2 text-muted-foreground">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}
