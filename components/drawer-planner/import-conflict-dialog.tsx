'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { ExportData, ProjectMeta } from '@/lib/types'

interface ImportConflictDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing: ProjectMeta
  imported: ExportData
  onReplace: () => void
  onImportAsNew: () => void
}

function MetaCol({ label, name, date, drawers, items }: {
  label: string
  name: string
  date: string
  drawers: number
  items: number
}) {
  return (
    <div className="flex-1 rounded-md border p-3 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium text-sm truncate">{name}</p>
      <p className="text-xs text-muted-foreground">{date}</p>
      <p className="text-xs text-muted-foreground">{drawers} drawer{drawers !== 1 ? 's' : ''}, {items} item{items !== 1 ? 's' : ''}</p>
    </div>
  )
}

export function ImportConflictDialog({
  open,
  onOpenChange,
  existing,
  imported,
  onReplace,
  onImportAsNew,
}: ImportConflictDialogProps) {
  const importedDate = imported.exportDate
    ? new Date(imported.exportDate).toLocaleString()
    : 'Unknown'
  const existingDate = existing.updatedAt
    ? new Date(existing.updatedAt).toLocaleString()
    : 'Unknown'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Project already exists</DialogTitle>
          <DialogDescription>
            This file matches an existing project. Choose how to handle the import.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          <MetaCol
            label="Existing"
            name={existing.name}
            date={`Modified ${existingDate}`}
            drawers={existing.drawerCount}
            items={existing.itemCount}
          />
          <MetaCol
            label="Imported"
            name={imported.name ?? 'Unnamed'}
            date={`Exported ${importedDate}`}
            drawers={imported.drawerCount ?? imported.drawers.length}
            items={imported.itemCount ?? imported.items.length}
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onImportAsNew}>
            Import as new project
          </Button>
          <Button variant="destructive" onClick={onReplace}>
            Replace existing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
