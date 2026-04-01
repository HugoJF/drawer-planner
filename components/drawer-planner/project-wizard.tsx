'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Grid3X3, Upload } from 'lucide-react'
import { useProjectsStore } from '@/lib/projects-store'
import type { ExportData, ProjectData } from '@/lib/types'

export function ProjectWizard() {
  const createProject = useProjectsStore((s) => s.createProject)
  const [name, setName] = useState('My Project')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCreate = () => {
    const trimmed = name.trim() || 'My Project'
    createProject(trimmed)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as ExportData
        if (!data.drawers || !data.items) {
          alert('Invalid file format')
          return
        }
        const projectData: ProjectData = {
          config: data.config,
          drawers: data.drawers,
          items: data.items,
          categories: data.categories ?? [],
        }
        createProject(data.name || file.name.replace('.json', ''), projectData)
      } catch {
        alert('Failed to import: invalid file format')
      }
    }
    reader.readAsText(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-8 pb-8 flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <Grid3X3 className="h-10 w-10 text-primary" />
            <h1 className="text-2xl font-semibold">Gridfinity Drawer Planner</h1>
            <p className="text-sm text-muted-foreground">
              Plan your Gridfinity drawer layouts with ease.
            </p>
          </div>

          <div className="w-full space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">Project name</Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="My Project"
                autoFocus
              />
            </div>
            <Button className="w-full" onClick={handleCreate}>
              Create Project
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>or</span>
            <button
              className="text-primary underline underline-offset-2 hover:no-underline flex items-center gap-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Import existing project
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
