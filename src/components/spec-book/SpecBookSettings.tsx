'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, FileText, Plus, X, AlertCircle, Loader2, Cog, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { PROJECT_LEVEL_SECTIONS } from './constants'
import { DropboxFileBrowser } from './DropboxFileBrowser'
import { 
  EffectiveCadPreferences, 
  CadLayout, 
  DEFAULT_CAD_PREFERENCES, 
  VALID_PAPER_SIZES, 
  VALID_PLOT_AREAS,
  DPI_RANGE,
  SCALE_DENOMINATOR_RANGE,
  PAPER_SIZE_INFO
} from '@/types/cad-preferences'
import { CTB_FILE_EXTENSIONS } from '@/lib/dropbox-utils'

interface Project {
  id: string
  name: string
  address?: string
  streetAddress?: string
  city?: string
  postalCode?: string
  client: {
    id: string
    name: string
    email: string
  }
  rooms: Array<{
    id: string
    name: string
    type: string
  }>
}

interface Session {
  user: {
    id: string
    name?: string
    orgId: string
  }
}

interface LinkedFile {
  id: string
  dropboxPath: string
  fileName: string
  fileSize?: number
  lastModified?: Date
}

interface SectionData {
  sectionId?: string
  files: LinkedFile[]
}

interface SpecBookSettingsProps {
  project: Project
  session: Session
}

export function SpecBookSettings({ project, session }: SpecBookSettingsProps) {
  const [sectionsByType, setSectionsByType] = useState<Record<string, SectionData>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTypeForDialog, setActiveTypeForDialog] = useState<string | null>(null)
  const [unlinkingFile, setUnlinkingFile] = useState<string | null>(null)
  
  // CAD options dialog state
  const [cadOptionsFileId, setCadOptionsFileId] = useState<string | null>(null)
  const [cadPreferences, setCadPreferences] = useState<EffectiveCadPreferences | null>(null)
  const [availableLayouts, setAvailableLayouts] = useState<CadLayout[]>([])
  const [layoutsLoading, setLayoutsLoading] = useState(false)
  const [selectedCtbFile, setSelectedCtbFile] = useState<any>(null)
  const [cadOptionsLoading, setCadOptionsLoading] = useState(false)
  const [showCtbSelector, setShowCtbSelector] = useState(false)
  const [useAsProjectDefault, setUseAsProjectDefault] = useState(false)

  // Initialize sections data structure
  useEffect(() => {
    const initialSections: Record<string, SectionData> = {}
    PROJECT_LEVEL_SECTIONS.forEach(section => {
      initialSections[section.type] = { files: [] }
    })
    setSectionsByType(initialSections)
  }, [])

  // Fetch linked files on mount
  useEffect(() => {
    fetchLinkedFiles()
  }, [project.id])

  const fetchLinkedFiles = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/spec-books/linked-files?projectId=${project.id}`)
      const result = await response.json()
      
      if (result.success) {
        // Normalize sections data by type
        const normalized: Record<string, SectionData> = {}
        
        // Initialize all project level sections
        PROJECT_LEVEL_SECTIONS.forEach(section => {
          normalized[section.type] = { files: [] }
        })
        
        // Populate with actual data
        result.sections?.forEach((section: any) => {
          normalized[section.type] = {
            sectionId: section.id,
            files: section.files.map((file: any) => ({
              id: file.id,
              dropboxPath: file.dropboxPath,
              fileName: file.fileName,
              fileSize: file.fileSize,
              lastModified: file.lastModified ? new Date(file.lastModified) : undefined
            }))
          }
        })
        
        setSectionsByType(normalized)
      } else {
        setError(result.error || 'Failed to fetch linked files')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch linked files')
    } finally {
      setLoading(false)
    }
  }

  const handleLinked = useCallback((payload: {
    section: { id: string; name: string; type: string }
    linkedFiles: Array<{
      id: string
      fileName: string
      dropboxPath: string
      fileSize?: number
      lastModified?: Date
    }>
  }) => {
    // Update the specific section with newly linked files
    setSectionsByType(prev => ({
      ...prev,
      [payload.section.type]: {
        sectionId: payload.section.id,
        files: [
          ...(prev[payload.section.type]?.files || []),
          ...payload.linkedFiles
        ]
      }
    }))
    
    // Close dialog
    setActiveTypeForDialog(null)
  }, [])

  const handleUnlinkFile = async (sectionType: string, file: LinkedFile) => {
    const sectionData = sectionsByType[sectionType]
    if (!sectionData?.sectionId) return
    
    setUnlinkingFile(file.id)
    
    try {
      const response = await fetch('/api/spec-books/link-files', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: project.id,
          sectionId: sectionData.sectionId,
          dropboxPath: file.dropboxPath
        })
      })
      
      const result = await response.json()
      
      if (result.success && result.unlinkedCount > 0) {
        // Only update UI if database operation actually succeeded
        setSectionsByType(prev => ({
          ...prev,
          [sectionType]: {
            ...prev[sectionType],
            files: prev[sectionType].files.filter(f => f.id !== file.id)
          }
        }))
      } else if (result.success && result.unlinkedCount === 0) {
        alert('File was not found or already unlinked')
        // Refresh the data to show current state
        fetchLinkedFiles()
      } else {
        alert(`Error unlinking file: ${result.error}`)
      }
    } catch (error) {
      console.error('Error unlinking file:', error)
      alert('Error unlinking file. Please try again.')
    } finally {
      setUnlinkingFile(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Byte'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const truncateFileName = (fileName: string, maxLength: number = 25) => {
    if (fileName.length <= maxLength) return fileName
    const extension = fileName.split('.').pop()
    const name = fileName.substring(0, fileName.lastIndexOf('.'))
    const truncated = name.substring(0, maxLength - extension!.length - 4) + '...'
    return truncated + '.' + extension
  }

  // CAD Options Dialog Functions
  const openCadOptions = async (fileId: string, dropboxPath: string) => {
    console.log('[CAD Options] Opening dialog for file:', { fileId, dropboxPath })
    setCadOptionsFileId(fileId)
    setCadOptionsLoading(true)
    
    try {
      // Load current preferences
      console.log('[CAD Options] Loading preferences for fileId:', fileId)
      const prefsResponse = await fetch(`/api/cad/preferences?fileId=${fileId}`)
      
      if (!prefsResponse.ok) {
        const errorText = await prefsResponse.text()
        console.error('[CAD Options] Preferences API error:', prefsResponse.status, errorText)
        throw new Error(`Failed to load preferences: ${prefsResponse.status} ${errorText}`)
      }
      
      const preferences = await prefsResponse.json()
      console.log('[CAD Options] Loaded preferences:', preferences)
      setCadPreferences(preferences)
      
      // Set CTB file if one is selected
      if (preferences.ctbDropboxPath) {
        setSelectedCtbFile({
          dropboxPath: preferences.ctbDropboxPath,
          fileName: preferences.ctbDropboxPath.split('/').pop()
        })
        console.log('[CAD Options] Set CTB file:', preferences.ctbDropboxPath)
      } else {
        setSelectedCtbFile(null)
      }
      
      // Discover layouts
      console.log('[CAD Options] Discovering layouts for:', dropboxPath)
      setLayoutsLoading(true)
      try {
        const layoutsResponse = await fetch(`/api/cad/layouts?dropboxPath=${encodeURIComponent(dropboxPath)}`)
        const layoutsResult = await layoutsResponse.json()
        console.log('[CAD Options] Layouts response:', layoutsResult)
        
        if (layoutsResult.success && layoutsResult.layouts?.length > 0) {
          setAvailableLayouts(layoutsResult.layouts)
          console.log('[CAD Options] Set available layouts:', layoutsResult.layouts)
        } else {
          // Use fallback layouts
          const fallbackLayouts = [
            { name: 'Model', isModelSpace: true, displayName: 'Model Space' },
            { name: 'Layout1', isModelSpace: false, displayName: 'Layout1' }
          ]
          setAvailableLayouts(fallbackLayouts)
          console.log('[CAD Options] Using fallback layouts:', fallbackLayouts)
        }
      } catch (layoutError) {
        console.error('[CAD Options] Layout discovery failed:', layoutError)
        const fallbackLayouts = [
          { name: 'Model', isModelSpace: true, displayName: 'Model Space' },
          { name: 'Layout1', isModelSpace: false, displayName: 'Layout1' }
        ]
        setAvailableLayouts(fallbackLayouts)
        console.log('[CAD Options] Using fallback layouts after error:', fallbackLayouts)
      } finally {
        setLayoutsLoading(false)
      }
      
      console.log('[CAD Options] Successfully opened dialog')
      
    } catch (error) {
      console.error('[CAD Options] Error loading CAD options:', error)
      alert(`Failed to load CAD options: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setCadOptionsFileId(null)
    } finally {
      setCadOptionsLoading(false)
    }
  }
  
  const saveCadPreferences = async () => {
    if (!cadOptionsFileId || !cadPreferences) return
    
    setCadOptionsLoading(true)
    
    try {
      // Save per-file preferences
      const response = await fetch('/api/cad/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedFileId: cadOptionsFileId,
          projectId: project.id,
          layoutName: cadPreferences.layoutName,
          ctbDropboxPath: selectedCtbFile?.dropboxPath || null,
          ctbFileId: selectedCtbFile?.id || null,
          plotArea: cadPreferences.plotArea,
          window: cadPreferences.window,
          centerPlot: cadPreferences.centerPlot,
          scaleMode: cadPreferences.scaleMode,
          scaleDenominator: cadPreferences.scaleDenominator,
          keepAspectRatio: cadPreferences.keepAspectRatio,
          margins: cadPreferences.margins,
          paperSize: cadPreferences.paperSize,
          orientation: cadPreferences.orientation,
          dpi: cadPreferences.dpi
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save preferences')
      }
      
      // Save as project default if requested
      if (useAsProjectDefault) {
        await fetch('/api/cad/project-defaults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            layoutName: cadPreferences.layoutName,
            ctbDropboxPath: selectedCtbFile?.dropboxPath || null,
            ctbFileId: selectedCtbFile?.id || null,
            plotArea: cadPreferences.plotArea,
            window: cadPreferences.window,
            centerPlot: cadPreferences.centerPlot,
            scaleMode: cadPreferences.scaleMode,
            scaleDenominator: cadPreferences.scaleDenominator,
            keepAspectRatio: cadPreferences.keepAspectRatio,
            margins: cadPreferences.margins,
            paperSize: cadPreferences.paperSize,
            orientation: cadPreferences.orientation,
            dpi: cadPreferences.dpi
          })
        })
      }
      
      alert('CAD preferences saved successfully!')
      setCadOptionsFileId(null)
      
    } catch (error) {
      console.error('Error saving CAD preferences:', error)
      alert('Failed to save CAD preferences')
    } finally {
      setCadOptionsLoading(false)
    }
  }
  
  const refreshLayouts = async () => {
    if (!cadOptionsFileId) return
    
    const file = Object.values(sectionsByType)
      .flatMap(section => section.files)
      .find(f => f.id === cadOptionsFileId)
      
    if (!file) return
    
    setLayoutsLoading(true)
    
    try {
      // Clear cache first
      await fetch(`/api/cad/layouts?dropboxPath=${encodeURIComponent(file.dropboxPath)}`, {
        method: 'DELETE'
      })
      
      // Re-discover layouts
      const layoutsResponse = await fetch(`/api/cad/layouts?dropboxPath=${encodeURIComponent(file.dropboxPath)}`)
      const layoutsResult = await layoutsResponse.json()
      
      if (layoutsResult.success) {
        setAvailableLayouts(layoutsResult.layouts)
      }
    } catch (error) {
      console.error('Error refreshing layouts:', error)
      alert('Failed to refresh layouts')
    } finally {
      setLayoutsLoading(false)
    }
  }

  const activeSection = activeTypeForDialog ? 
    PROJECT_LEVEL_SECTIONS.find(s => s.type === activeTypeForDialog) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-gray-500 rounded-lg flex items-center justify-center shadow-sm">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CAD File Settings</h2>
          <p className="text-gray-600">Manage CAD file associations for each plan type</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* CAD File Associations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>CAD File Associations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {PROJECT_LEVEL_SECTIONS.map((section) => (
                <div key={section.type} className="animate-pulse">
                  <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 rounded w-32 mb-2"></div>
                      <div className="h-3 bg-gray-100 rounded w-48"></div>
                    </div>
                    <div className="w-24 h-4 bg-gray-100 rounded"></div>
                    <div className="w-20 h-8 bg-gray-100 rounded ml-4"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {PROJECT_LEVEL_SECTIONS.map((section) => {
                const sectionData = sectionsByType[section.type] || { files: [] }
                const fileCount = sectionData.files.length

                return (
                  <div key={section.type} className="flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0">
                    {/* Plan Type Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-medium text-gray-900">{section.name}</h3>
                        {fileCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {fileCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{section.description}</p>
                    </div>

                    {/* Linked Files */}
                    <div className="flex-1 mx-4 min-w-0">
                      {fileCount > 0 ? (
                        <ScrollArea className="h-16">
                          <div className="flex flex-wrap gap-1">
                            {sectionData.files.map((file) => (
                              <div
                                key={file.id}
                                className="inline-flex items-center bg-blue-50 text-blue-700 text-xs rounded-full pl-2 pr-1 py-1 group hover:bg-blue-100"
                                title={`${file.fileName}${file.fileSize ? ' • ' + formatFileSize(file.fileSize) : ''}`}
                              >
                                <span className="max-w-[120px] truncate">
                                  {truncateFileName(file.fileName)}
                                </span>
                                <div className="flex items-center space-x-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 hover:bg-gray-200"
                                    onClick={() => openCadOptions(file.id, file.dropboxPath)}
                                    title="Edit CAD Options"
                                  >
                                    <Cog className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 hover:bg-blue-200 group-hover:visible"
                                    onClick={() => handleUnlinkFile(section.type, file)}
                                    disabled={unlinkingFile === file.id}
                                  >
                                    {unlinkingFile === file.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <X className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-500">
                          No files linked
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTypeForDialog(section.type)}
                        className="text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Browse Files
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dropbox File Browser Dialog */}
      <Dialog 
        open={activeTypeForDialog !== null} 
        onOpenChange={(open) => !open && setActiveTypeForDialog(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Link CAD Files - {activeSection?.name}
            </DialogTitle>
          </DialogHeader>
          
          {activeSection && (
            <div className="space-y-4">
              {/* We'll embed the DropboxFileBrowser content directly here */}
              <p className="text-sm text-gray-600">Select CAD files from your Dropbox to link to {activeSection.name}</p>
              <DropboxFileBrowser
                roomId={null}
                projectId={project.id}
                sectionType={activeSection.type}
                sectionName={activeSection.name}
                onLinked={handleLinked}
                variant="settings"
                allowMultiple={true}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CAD Options Dialog */}
      <Dialog 
        open={cadOptionsFileId !== null} 
        onOpenChange={(open) => !open && setCadOptionsFileId(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CAD File Options</DialogTitle>
          </DialogHeader>
          
          {cadPreferences && (
            <div className="space-y-6">
              {/* Layout Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Layout</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="layout-select" className="min-w-[100px]">Layout:</Label>
                    <Select
                      value={cadPreferences.layoutName || ''}
                      onValueChange={(value) => 
                        setCadPreferences(prev => prev ? {...prev, layoutName: value || null} : null)
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select layout" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Default (Auto-detect)</SelectItem>
                        {availableLayouts.map((layout) => (
                          <SelectItem key={layout.name} value={layout.name}>
                            {layout.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={refreshLayouts}
                      disabled={layoutsLoading}
                    >
                      {layoutsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                  </div>
                  {layoutsLoading && <p className="text-sm text-gray-500">Discovering layouts...</p>}
                </div>
              </div>

              <Separator />

              {/* Plot Style CTB Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Plot Style (CTB)</h3>
                <div className="space-y-3">
                  {selectedCtbFile ? (
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="flex items-center space-x-1">
                        <span>{selectedCtbFile.fileName}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 ml-1"
                          onClick={() => setSelectedCtbFile(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowCtbSelector(true)}
                    >
                      Select CTB File
                    </Button>
                  )}
                  <p className="text-sm text-gray-500">
                    CTB files control line weights and colors. If no CTB is selected, default line weights will be used.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Scaling and Positioning Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Scaling & Positioning</h3>
                <div className="space-y-4">
                  {/* Scale Mode */}
                  <div>
                    <Label className="text-sm font-medium">Scale Mode</Label>
                    <RadioGroup
                      value={cadPreferences.scaleMode}
                      onValueChange={(value) => 
                        setCadPreferences(prev => prev ? {...prev, scaleMode: value as any} : null)
                      }
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fit" id="scale-fit" />
                        <Label htmlFor="scale-fit">Fit to page</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="custom" id="scale-custom" />
                        <Label htmlFor="scale-custom">Custom scale (1:n)</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Custom Scale Input */}
                  {cadPreferences.scaleMode === 'custom' && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="scale-denominator" className="text-sm">Scale denominator (n in 1:n)</Label>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">1:</span>
                        <Input
                          id="scale-denominator"
                          type="number"
                          min={SCALE_DENOMINATOR_RANGE.min}
                          max={SCALE_DENOMINATOR_RANGE.max}
                          value={cadPreferences.scaleDenominator || ''}
                          onChange={(e) => 
                            setCadPreferences(prev => 
                              prev ? {...prev, scaleDenominator: e.target.value ? parseInt(e.target.value) : null} : null
                            )
                          }
                          className="w-24"
                          placeholder="100"
                        />
                        <span className="text-sm text-gray-500">(e.g., 50, 100, 200)</span>
                      </div>
                    </div>
                  )}

                  {/* Plot Area */}
                  <div>
                    <Label htmlFor="plot-area" className="text-sm font-medium">Plot Area</Label>
                    <Select
                      value={cadPreferences.plotArea}
                      onValueChange={(value) => 
                        setCadPreferences(prev => prev ? {...prev, plotArea: value as any} : null)
                      }
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="extents">Drawing Extents</SelectItem>
                        <SelectItem value="display">Current Display</SelectItem>
                        <SelectItem value="limits">Drawing Limits</SelectItem>
                        <SelectItem value="window">Custom Window</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Window Coordinates */}
                  {cadPreferences.plotArea === 'window' && (
                    <div className="ml-4 space-y-2">
                      <Label className="text-sm font-medium">Window Coordinates</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-gray-500">X1 (left)</Label>
                          <Input
                            type="number"
                            step="any"
                            value={cadPreferences.window?.x1 || ''}
                            onChange={(e) => 
                              setCadPreferences(prev => 
                                prev ? {
                                  ...prev, 
                                  window: {
                                    ...prev.window,
                                    x1: parseFloat(e.target.value) || 0,
                                    y1: prev.window?.y1 || 0,
                                    x2: prev.window?.x2 || 0,
                                    y2: prev.window?.y2 || 0
                                  }
                                } : null
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Y1 (bottom)</Label>
                          <Input
                            type="number"
                            step="any"
                            value={cadPreferences.window?.y1 || ''}
                            onChange={(e) => 
                              setCadPreferences(prev => 
                                prev ? {
                                  ...prev, 
                                  window: {
                                    ...prev.window,
                                    x1: prev.window?.x1 || 0,
                                    y1: parseFloat(e.target.value) || 0,
                                    x2: prev.window?.x2 || 0,
                                    y2: prev.window?.y2 || 0
                                  }
                                } : null
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">X2 (right)</Label>
                          <Input
                            type="number"
                            step="any"
                            value={cadPreferences.window?.x2 || ''}
                            onChange={(e) => 
                              setCadPreferences(prev => 
                                prev ? {
                                  ...prev, 
                                  window: {
                                    ...prev.window,
                                    x1: prev.window?.x1 || 0,
                                    y1: prev.window?.y1 || 0,
                                    x2: parseFloat(e.target.value) || 0,
                                    y2: prev.window?.y2 || 0
                                  }
                                } : null
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">Y2 (top)</Label>
                          <Input
                            type="number"
                            step="any"
                            value={cadPreferences.window?.y2 || ''}
                            onChange={(e) => 
                              setCadPreferences(prev => 
                                prev ? {
                                  ...prev, 
                                  window: {
                                    ...prev.window,
                                    x1: prev.window?.x1 || 0,
                                    y1: prev.window?.y1 || 0,
                                    x2: prev.window?.x2 || 0,
                                    y2: parseFloat(e.target.value) || 0
                                  }
                                } : null
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Checkboxes */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="center-plot"
                        checked={cadPreferences.centerPlot}
                        onCheckedChange={(checked) => 
                          setCadPreferences(prev => prev ? {...prev, centerPlot: !!checked} : null)
                        }
                      />
                      <Label htmlFor="center-plot">Center drawing on page</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="keep-aspect"
                        checked={cadPreferences.keepAspectRatio}
                        onCheckedChange={(checked) => 
                          setCadPreferences(prev => prev ? {...prev, keepAspectRatio: !!checked} : null)
                        }
                      />
                      <Label htmlFor="keep-aspect">Keep aspect ratio</Label>
                    </div>
                  </div>

                  {/* Margins */}
                  <div>
                    <Label className="text-sm font-medium">Margins (mm)</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <Label className="text-xs text-gray-500">Top</Label>
                        <Input
                          type="number"
                          min="0"
                          value={cadPreferences.margins?.top || ''}
                          onChange={(e) => 
                            setCadPreferences(prev => 
                              prev ? {
                                ...prev, 
                                margins: {
                                  ...prev.margins,
                                  top: parseFloat(e.target.value) || 0,
                                  right: prev.margins?.right || 10,
                                  bottom: prev.margins?.bottom || 10,
                                  left: prev.margins?.left || 10
                                }
                              } : null
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Right</Label>
                        <Input
                          type="number"
                          min="0"
                          value={cadPreferences.margins?.right || ''}
                          onChange={(e) => 
                            setCadPreferences(prev => 
                              prev ? {
                                ...prev, 
                                margins: {
                                  ...prev.margins,
                                  top: prev.margins?.top || 10,
                                  right: parseFloat(e.target.value) || 0,
                                  bottom: prev.margins?.bottom || 10,
                                  left: prev.margins?.left || 10
                                }
                              } : null
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Bottom</Label>
                        <Input
                          type="number"
                          min="0"
                          value={cadPreferences.margins?.bottom || ''}
                          onChange={(e) => 
                            setCadPreferences(prev => 
                              prev ? {
                                ...prev, 
                                margins: {
                                  ...prev.margins,
                                  top: prev.margins?.top || 10,
                                  right: prev.margins?.right || 10,
                                  bottom: parseFloat(e.target.value) || 0,
                                  left: prev.margins?.left || 10
                                }
                              } : null
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Left</Label>
                        <Input
                          type="number"
                          min="0"
                          value={cadPreferences.margins?.left || ''}
                          onChange={(e) => 
                            setCadPreferences(prev => 
                              prev ? {
                                ...prev, 
                                margins: {
                                  ...prev.margins,
                                  top: prev.margins?.top || 10,
                                  right: prev.margins?.right || 10,
                                  bottom: prev.margins?.bottom || 10,
                                  left: parseFloat(e.target.value) || 0
                                }
                              } : null
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Paper Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Paper Settings</h3>
                <div className="space-y-4">
                  {/* Paper Size */}
                  <div>
                    <Label htmlFor="paper-size" className="text-sm font-medium">Paper Size</Label>
                    <Select
                      value={cadPreferences.paperSize || 'Auto'}
                      onValueChange={(value) => 
                        setCadPreferences(prev => prev ? {...prev, paperSize: value as any} : null)
                      }
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VALID_PAPER_SIZES.map(size => {
                          const info = PAPER_SIZE_INFO[size]
                          return (
                            <SelectItem key={size} value={size}>
                              {size} {info.width > 0 ? `(${info.width}×${info.height} ${info.unit})` : ''}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Orientation */}
                  <div>
                    <Label className="text-sm font-medium">Orientation</Label>
                    <RadioGroup
                      value={cadPreferences.orientation || 'auto'}
                      onValueChange={(value) => 
                        setCadPreferences(prev => 
                          prev ? {...prev, orientation: value === 'auto' ? null : value as any} : null
                        )
                      }
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="auto" id="orientation-auto" />
                        <Label htmlFor="orientation-auto">Auto-detect</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="portrait" id="orientation-portrait" />
                        <Label htmlFor="orientation-portrait">Portrait</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="landscape" id="orientation-landscape" />
                        <Label htmlFor="orientation-landscape">Landscape</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* DPI */}
                  <div>
                    <Label htmlFor="dpi" className="text-sm font-medium">DPI (Print Quality)</Label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Input
                        id="dpi"
                        type="number"
                        min={DPI_RANGE.min}
                        max={DPI_RANGE.max}
                        value={cadPreferences.dpi || ''}
                        onChange={(e) => 
                          setCadPreferences(prev => 
                            prev ? {...prev, dpi: e.target.value ? parseInt(e.target.value) : null} : null
                          )
                        }
                        className="w-24"
                        placeholder="300"
                      />
                      <span className="text-sm text-gray-500">({DPI_RANGE.min}-{DPI_RANGE.max})</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Save Section */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="use-as-default"
                    checked={useAsProjectDefault}
                    onCheckedChange={setUseAsProjectDefault}
                  />
                  <Label htmlFor="use-as-default" className="text-sm">
                    Use as project default for new files
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setCadOptionsFileId(null)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={saveCadPreferences}
                    disabled={cadOptionsLoading}
                  >
                    {cadOptionsLoading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                    ) : (
                      'Save Preferences'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CTB File Selector Dialog */}
      <Dialog open={showCtbSelector} onOpenChange={setShowCtbSelector}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Select CTB Plot Style File</DialogTitle>
          </DialogHeader>
          <DropboxFileBrowser
            roomId={null}
            projectId={project.id}
            allowedExtensions={CTB_FILE_EXTENSIONS}
            mode="select"
            variant="ctb-selector"
            allowMultiple={false}
            maxSelections={1}
            onFileSelected={(file) => {
              setSelectedCtbFile({
                id: file.id,
                dropboxPath: file.path,
                fileName: file.name,
                fileSize: file.size,
                revision: file.revision
              })
              setShowCtbSelector(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
