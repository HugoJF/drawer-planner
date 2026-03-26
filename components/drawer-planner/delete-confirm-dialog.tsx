'use client'

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

interface DeleteConfirmDialogProps {
  open: boolean
  type: 'drawer' | 'item'
  name: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmDialog({
  open,
  type,
  name,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const title = type === 'drawer' ? 'Delete drawer?' : 'Delete item?'
  const description =
    type === 'drawer'
      ? `"${name}" will be removed and its items will become unassigned. This cannot be undone.`
      : `"${name}" will be permanently deleted. This cannot be undone.`

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
