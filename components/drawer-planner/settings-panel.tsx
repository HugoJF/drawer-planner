'use client'

import React, { useRef, useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings2, Download, Upload } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useDrawerStore } from '@/lib/store'
import { useProjectsStore, saveProjectData } from '@/lib/projects-store'
import { DEFAULT_CONFIG, CURRENT_VERSION, type DimensionUnit, type ExportData, type ProjectData } from '@/lib/types'
import { ImportConflictDialog } from './import-conflict-dialog'

export function SettingsPanel() {
  const config = useDrawerStore(s => s.config)
  const updateConfig = useDrawerStore(s => s.updateConfig)
  const exportData = useDrawerStore(s => s.exportData)

  const projects = useProjectsStore(s => s.projects)
  const activeProjectId = useProjectsStore(s => s.activeProjectId)
  const createProject = useProjectsStore(s => s.createProject)
  const switchProject = useProjectsStore(s => s.switchProject)
  const upsertProjectMeta = useProjectsStore(s => s.upsertProjectMeta)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<ExportData | null>(null)

  const activeProject = projects.find(p => p.id === activeProjectId)

  const handleReset = () => {
    updateConfig(DEFAULT_CONFIG)
  }

  const handleExport = () => {
    const base = exportData()
    const enriched: ExportData = {
      ...base,
      version: CURRENT_VERSION,
      projectId: activeProjectId ?? undefined,
      name: activeProject?.name,
      drawerCount: base.drawers.length,
      itemCount: base.items.length,
    }
    const blob = new Blob([JSON.stringify(enriched, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName = (activeProject?.name ?? 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase()
    a.download = `${safeName}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const applyImport = (data: ExportData, targetId: string) => {
    const projectData: ProjectData = {
      config: { ...DEFAULT_CONFIG, ...data.config },
      drawers: data.drawers,
      items: data.items,
      categories: data.categories ?? [],
    }
    saveProjectData(targetId, projectData)
    const existing = projects.find(p => p.id === targetId)
    if (existing) {
      upsertProjectMeta({
        ...existing,
        drawerCount: data.drawers.length,
        itemCount: data.items.length,
        updatedAt: new Date().toISOString(),
      })
    }
    switchProject(targetId)
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
          alert('Failed to import: invalid file format')
          return
        }

        // Check for conflict: does this project ID already exist?
        if (data.projectId) {
          const conflict = projects.find(p => p.id === data.projectId)
          if (conflict) {
            setPendingImport(data)
            setConflictOpen(true)
            return
          }
        }

        // No conflict — create a new project with this data
        const projectData: ProjectData = {
          config: { ...DEFAULT_CONFIG, ...data.config },
          drawers: data.drawers,
          items: data.items,
          categories: data.categories ?? [],
        }
        createProject(data.name || file.name.replace('.json', ''), projectData)
      } catch (error) {
        console.error('Failed to parse import file:', error)
        alert('Failed to import: invalid file format')
      }
    }
    reader.readAsText(file)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleConflictReplace = () => {
    if (!pendingImport?.projectId) {
      return
    }
    applyImport(pendingImport, pendingImport.projectId)
    setConflictOpen(false)
    setPendingImport(null)
  }

  const handleConflictAsNew = () => {
    if (!pendingImport) {
      return
    }
    const projectData: ProjectData = {
      config: { ...DEFAULT_CONFIG, ...pendingImport.config },
      drawers: pendingImport.drawers,
      items: pendingImport.items,
      categories: pendingImport.categories ?? [],
    }
    createProject(pendingImport.name ? `${pendingImport.name} (imported)` : 'Imported project', projectData)
    setConflictOpen(false)
    setPendingImport(null)
  }

  const conflictExisting = pendingImport?.projectId
    ? projects.find(p => p.id === pendingImport.projectId)
    : null

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[26rem] max-h-[80vh] overflow-y-auto" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Settings</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs"
              >
                Reset to defaults
              </Button>
            </div>

            {/* Display Unit */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label className="text-xs">Display Unit</Label>
                <p className="text-[10px] text-muted-foreground">For dimensions</p>
              </div>
              <Select
                value={config.displayUnit}
                onValueChange={(v) => updateConfig({ displayUnit: v as DimensionUnit })}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mm">mm</SelectItem>
                  <SelectItem value="cm">cm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground">
              Gridfinity Parameters
            </p>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="cellSize" className="text-xs">Cell Size</Label>
                  <p className="text-[10px] text-muted-foreground">Standard: 42mm</p>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    id="cellSize"
                    type="number"
                    step="0.1"
                    min="1"
                    value={config.cellSize}
                    onChange={(e) => updateConfig({ cellSize: parseFloat(e.target.value) || 42 })}
                    className="w-20 text-right"
                  />
                  <span className="text-xs text-muted-foreground">mm</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="heightUnit" className="text-xs">Height Unit</Label>
                  <p className="text-[10px] text-muted-foreground">Standard: 7mm (1U)</p>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    id="heightUnit"
                    type="number"
                    step="0.1"
                    min="1"
                    value={config.heightUnit}
                    onChange={(e) => updateConfig({ heightUnit: parseFloat(e.target.value) || 7 })}
                    className="w-20 text-right"
                  />
                  <span className="text-xs text-muted-foreground">mm</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="tolerance" className="text-xs">Tolerance</Label>
                  <p className="text-[10px] text-muted-foreground">Gap from drawer edge</p>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    id="tolerance"
                    type="number"
                    step="0.1"
                    min="0"
                    value={config.tolerance}
                    onChange={(e) => updateConfig({ tolerance: parseFloat(e.target.value) || 0.5 })}
                    className="w-20 text-right"
                  />
                  <span className="text-xs text-muted-foreground">mm</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label htmlFor="wallThickness" className="text-xs">Wall Thickness</Label>
                  <p className="text-[10px] text-muted-foreground">Gridfinity bin walls</p>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    id="wallThickness"
                    type="number"
                    step="0.1"
                    min="0"
                    value={config.wallThickness}
                    onChange={(e) => updateConfig({ wallThickness: parseFloat(e.target.value) || 1.2 })}
                    className="w-20 text-right"
                  />
                  <span className="text-xs text-muted-foreground">mm</span>
                </div>
              </div>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground">Grid</p>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Item color</Label>
                  <p className="text-[10px] text-muted-foreground">Category color, height heatmap, or density heatmap</p>
                </div>
                <Select
                  value={config.gridColorMode ?? 'category'}
                  onValueChange={v => updateConfig({ gridColorMode: v as 'category' | 'height' | 'density' })}
                >
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="height">Height</SelectItem>
                    <SelectItem value="density">Density</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground">Sidebar</p>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Sidebar layout</Label>
                  <p className="text-[10px] text-muted-foreground">Classic tree or drawer-scoped view</p>
                </div>
                <Select
                  value={config.sidebarVersion ?? 'v1'}
                  onValueChange={v => updateConfig({ sidebarVersion: v as 'v1' | 'v2' })}
                >
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="v1">Classic</SelectItem>
                    <SelectItem value="v2">Drawer-scoped</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Drawer item count</Label>
                  <p className="text-[10px] text-muted-foreground">Show count next to drawer name</p>
                </div>
                <Switch checked={config.showDrawerCount ?? true} onCheckedChange={v => updateConfig({ showDrawerCount: v })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Category item count</Label>
                  <p className="text-[10px] text-muted-foreground">Show count next to category name</p>
                </div>
                <Switch checked={config.showCategoryCount ?? true} onCheckedChange={v => updateConfig({ showCategoryCount: v })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Item size display</Label>
                  <p className="text-[10px] text-muted-foreground">Area (20U) or dimensions (5×4)</p>
                </div>
                <Select
                  value={config.itemSizeDisplay ?? 'area'}
                  onValueChange={v => updateConfig({ itemSizeDisplay: v as 'area' | 'dimensions' })}
                >
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="area">Area (20U)</SelectItem>
                    <SelectItem value="dimensions">Dims (5×4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Category expansion</Label>
                  <p className="text-[10px] text-muted-foreground">Which categories open by default</p>
                </div>
                <Select
                  value={config.categoryExpansion ?? 'none'}
                  onValueChange={v => updateConfig({ categoryExpansion: v as 'none' | 'all' | 'categorized' })}
                >
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="categorized">Categorized</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(config.categoryExpansion ?? 'none') !== 'none' && (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <Label className="text-xs">Expansion behavior</Label>
                    <p className="text-[10px] text-muted-foreground">Just open: user can collapse; Always open: locked</p>
                  </div>
                  <Select
                    value={config.categoryExpansionMode ?? 'always-open'}
                    onValueChange={v => updateConfig({ categoryExpansionMode: v as 'just-open' | 'always-open' })}
                  >
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="just-open">Just open</SelectItem>
                      <SelectItem value="always-open">Always open</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-xs">Stats panel</Label>
                  <p className="text-[10px] text-muted-foreground">Show drawer stats at bottom of sidebar</p>
                </div>
                <Switch checked={config.showSidebarStats ?? true} onCheckedChange={v => updateConfig({ showSidebarStats: v })} />
              </div>
            </div>

            <Separator />

            {/* Import/Export */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Data</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={handleExport}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </div>
            </div>

            <div className="rounded-md bg-secondary/50 p-2 text-xs text-muted-foreground">
              Changes apply immediately and recalculate all drawer grids.
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {conflictExisting && pendingImport && (
        <ImportConflictDialog
          open={conflictOpen}
          onOpenChange={setConflictOpen}
          existing={conflictExisting}
          imported={pendingImport}
          onReplace={handleConflictReplace}
          onImportAsNew={handleConflictAsNew}
        />
      )}
    </>
  )
}
