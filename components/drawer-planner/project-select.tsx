'use client'

import React, { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjectsStore } from '@/lib/projects-store'
import type { ProjectMeta } from '@/lib/types'

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = ms / 60000
  const h = m / 60
  const d = h / 24
  if (d >= 1) return `${Math.floor(d)}d ago`
  if (h >= 1) return `${Math.floor(h)}h ago`
  if (m >= 1) return `${Math.floor(m)}m ago`
  return 'just now'
}

function ProjectRow({ project, active, onSelect }: {
  project: ProjectMeta
  active: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem
      className={cn(
        'flex items-start gap-2.5 px-3 py-2.5 cursor-pointer rounded-md',
        active && 'bg-accent'
      )}
      onSelect={onSelect}
    >
      <Check className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', active ? 'text-primary' : 'text-transparent')} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-none truncate', active && 'font-medium')}>
          {project.name}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {project.drawerCount} drawer{project.drawerCount !== 1 ? 's' : ''}
          {' · '}
          {project.itemCount} item{project.itemCount !== 1 ? 's' : ''}
          {' · '}
          {relativeTime(project.updatedAt)}
        </p>
      </div>
    </DropdownMenuItem>
  )
}

export function ProjectSelect() {
  const projects = useProjectsStore((s) => s.projects)
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const switchProject = useProjectsStore((s) => s.switchProject)
  const createProject = useProjectsStore((s) => s.createProject)
  const renameProject = useProjectsStore((s) => s.renameProject)
  const deleteProject = useProjectsStore((s) => s.deleteProject)

  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const activeProject = projects.find((p) => p.id === activeProjectId)

  const handleCreateProject = () => {
    const name = newProjectName.trim() || 'New Project'
    createProject(name)
    setNewProjectOpen(false)
  }

  const handleRenameConfirm = () => {
    if (activeProjectId && renameName.trim()) {
      renameProject(activeProjectId, renameName.trim())
    }
    setRenameOpen(false)
  }

  const handleDeleteConfirm = () => {
    if (activeProjectId) deleteProject(activeProjectId)
    setDeleteOpen(false)
  }

  if (!activeProjectId) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1.5 font-semibold text-sm focus-visible:ring-0"
          >
            {activeProject?.name ?? 'Select project'}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64 p-1.5">
          <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 py-1">
            Projects
          </DropdownMenuLabel>

          <div className="space-y-0.5">
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                active={p.id === activeProjectId}
                onSelect={() => { if (p.id !== activeProjectId) switchProject(p.id) }}
              />
            ))}
          </div>

          <DropdownMenuSeparator className="my-1.5" />

          <DropdownMenuItem
            className="px-3 py-2 gap-2 text-sm cursor-pointer"
            onSelect={() => {
              setRenameName(activeProject?.name ?? '')
              setRenameOpen(true)
            }}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            Rename &ldquo;{activeProject?.name}&rdquo;
          </DropdownMenuItem>

          <DropdownMenuItem
            className="px-3 py-2 gap-2 text-sm cursor-pointer text-destructive focus:text-destructive"
            disabled={projects.length <= 1}
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete project
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1.5" />

          <DropdownMenuItem
            className="px-3 py-2 gap-2 text-sm cursor-pointer"
            onSelect={() => {
              setNewProjectName('')
              setNewProjectOpen(true)
            }}
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            New project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* New project dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-proj-name">Name</Label>
            <Input
              id="new-proj-name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              placeholder="New Project"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename-proj">Name</Label>
            <Input
              id="rename-proj"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRenameConfirm}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{activeProject?.name}&rdquo;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all drawers and items in this project. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
