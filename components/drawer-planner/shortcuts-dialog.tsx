'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SHORTCUTS, formatShortcutKeys } from '@/lib/shortcuts'

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
            {Object.values(SHORTCUTS)
              .filter(s => s.description !== null)
              .map(s => (
                <tr key={formatShortcutKeys(s).join('+')} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4">
                    <div className="flex gap-1 flex-wrap">
                      {formatShortcutKeys(s).map(k => (
                        <kbd
                          key={k}
                          className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs border border-border"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 text-muted-foreground">{s.description}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  )
}
