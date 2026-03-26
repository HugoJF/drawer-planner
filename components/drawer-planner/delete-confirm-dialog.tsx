'use client'

import { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface DeleteConfirmDialogProps {
  open: boolean
  type: 'drawer' | 'item'
  name: string
  onConfirm: (deleteContents: boolean) => void
  onCancel: () => void
}

export function DeleteConfirmDialog({
  open,
  type,
  name,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const [deleteContents, setDeleteContents] = useState(false)

  useEffect(() => {
    if (open) setDeleteContents(false)
  }, [open])

  const description =
    type === 'drawer'
      ? `"${name}" will be removed${deleteContents ? ' along with all its items' : ' and its items will become unassigned'}.`
      : `"${name}" will be permanently deleted.`

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{type === 'drawer' ? 'Delete drawer?' : 'Delete item?'}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {type === 'drawer' && (
          <div className="flex items-center gap-2 py-1">
            <Checkbox
              id="delete-contents"
              checked={deleteContents}
              onCheckedChange={(v) => setDeleteContents(!!v)}
            />
            <Label htmlFor="delete-contents" className="cursor-pointer">
              Also delete all items in this drawer
            </Label>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={() => onConfirm(deleteContents)}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
