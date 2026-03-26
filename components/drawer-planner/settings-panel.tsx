'use client'

import React, { useRef } from 'react'
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
import { useDrawerStore } from '@/lib/store'
import { DEFAULT_CONFIG, type DimensionUnit } from '@/lib/types'

export function SettingsPanel() {
  const config = useDrawerStore(s => s.config)
  const updateConfig = useDrawerStore(s => s.updateConfig)
  const exportData = useDrawerStore(s => s.exportData)
  const importData = useDrawerStore(s => s.importData)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleReset = () => {
    updateConfig(DEFAULT_CONFIG)
  }

  const handleExport = () => {
    const data = exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gridfinity-planner-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        importData(data)
      } catch (error) {
        console.error('Failed to parse import file:', error)
        alert('Failed to import: Invalid file format')
      }
    }
    reader.readAsText(file)
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
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
  )
}
