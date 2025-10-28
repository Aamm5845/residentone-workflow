'use client'

import { useState, useCallback } from 'react'
import { ArrowLeft, BookOpen, Settings, FileText, Download, Plus, Folder, File, Loader2, AlertCircle, GripVertical } from 'lucide-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { DropboxFileBrowser } from './DropboxFileBrowser'
import { PlanPdfUpload } from './PlanPdfUpload'
import { RenderingUpload } from './RenderingUpload'
import { SpecBookHistory } from './SpecBookHistory'
import { SpecBookSettings } from './SpecBookSettings'
import { PROJECT_LEVEL_SECTIONS } from './constants'

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
  specBooks: Array<{
    id: string
    name: string
    sections: Array<{
      id: string
      type: string
      name: string
      roomId?: string
      isIncluded: boolean
      renderingUrl?: string
      dropboxFiles: Array<{
        id: string
        dropboxPath: string
        fileName: string
        cadToPdfCacheUrl?: string
      }>
      room?: {
        id: string
        name: string
        type: string
      }
    }>
  }>
}

interface Session {
  user: {
    id: string
    name?: string
    orgId: string
  }
}

interface SpecBookBuilderProps {
  project: Project
  session: Session
}

interface CoverPageData {
  clientName: string
  projectName: string
  address: string
  companyLogo: string
  description: string
  specBookType: string
  includedSections: string[]
}

// Sortable Room Item Component
function SortableRoomItem({ room, isSelected, onToggle, children }: {
  room: { id: string; name: string; type: string }
  isSelected: boolean
  onToggle: (checked: boolean) => void
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: room.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3 flex-1">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="w-5 h-5 text-gray-400" />
          </div>
          <Checkbox
            id={room.id}
            checked={isSelected}
            onCheckedChange={onToggle}
          />
          <Label 
            htmlFor={room.id}
            className="font-medium cursor-pointer flex-1"
          >
            {room.name || room.type.replace('_', ' ')}
          </Label>
        </div>
      </div>
      {isSelected && (
        <div className="mt-3 space-y-3 ml-8">
          {children}
        </div>
      )}
    </div>
  )
}

export function SpecBookBuilder({ project, session }: SpecBookBuilderProps) {
  const [activeTab, setActiveTab] = useState('builder')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Initialize with default selections
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>(() => {
    const defaultSections: Record<string, boolean> = {}
    PROJECT_LEVEL_SECTIONS.forEach(section => {
      defaultSections[section.type] = true
    })
    return defaultSections
  })
  const [selectedRooms, setSelectedRooms] = useState<Record<string, boolean>>(() => {
    const defaultRooms: Record<string, boolean> = {}
    project.rooms.forEach(room => {
      defaultRooms[room.id] = true
    })
    return defaultRooms
  })
  
  // State for room ordering
  const [roomOrder, setRoomOrder] = useState<string[]>(() => project.rooms.map(r => r.id))
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  const [coverPageData, setCoverPageData] = useState<CoverPageData>({
    clientName: project.client.name,
    projectName: project.name,
    address: [
      project.streetAddress,
      project.city,
      project.postalCode
    ].filter(Boolean).join(', ') || project.address || '',
    companyLogo: '',
    description: '',
    specBookType: 'Full Project',
    includedSections: []
  })

  const currentSpecBook = project.specBooks[0]

  const handleSectionToggle = useCallback((sectionType: string, checked: boolean) => {
    setSelectedSections(prev => ({
      ...prev,
      [sectionType]: checked
    }))
  }, [])

  const handleRoomToggle = useCallback((roomId: string, checked: boolean) => {
    setSelectedRooms(prev => ({
      ...prev,
      [roomId]: checked
    }))
  }, [])
  
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      setRoomOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [])


  const handleGeneratePDF = async () => {
    setIsGenerating(true)
    setError(null)
    setGenerationProgress(0)

    try {
      // Prepare data for generation
      const selectedSectionTypes = Object.keys(selectedSections).filter(key => selectedSections[key])
      // Use ordered room list
      const selectedRoomIds = roomOrder.filter(roomId => selectedRooms[roomId])
      
      setGenerationProgress(20)
      
      const response = await fetch('/api/spec-books/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: project.id,
          coverPageData,
          selectedSections: selectedSectionTypes,
          selectedRooms: selectedRoomIds
        })
      })
      
      setGenerationProgress(90)
      
      const result = await response.json()
      
      if (result.success) {
        setGenerationProgress(100)
        
        // Download the generated PDF
        if (result.generation.pdfUrl) {
          window.open(result.generation.pdfUrl, '_blank')
        }
        
        // Show success message
        alert(`Spec book generated successfully! Version ${result.generation.version} with ${result.generation.pageCount} pages.`)
        
      } else {
        throw new Error(result.error || 'Failed to generate spec book')
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate spec book')
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }

  // Get rooms in order
  const orderedRooms = roomOrder.map(id => project.rooms.find(r => r.id === id)).filter(Boolean) as typeof project.rooms
  const selectedRoomsList = orderedRooms.filter(room => selectedRooms[room.id])
  const selectedSectionsList = PROJECT_LEVEL_SECTIONS.filter(section => selectedSections[section.type])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href={`/projects/${project.id}`}>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Project
                </Button>
              </Link>
            </div>
          </div>
          
          {/* Page Title */}
          <div className="mt-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Spec Book Builder</h1>
                <p className="text-gray-600 mt-1">{project.name} • {project.client.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-8">
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="builder">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Configuration */}
              <div className="lg:col-span-2 space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Cover Page */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <FileText className="w-5 h-5" />
                      <span>Cover Page</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="clientName">Client Name</Label>
                        <Input
                          id="clientName"
                          value={coverPageData.clientName}
                          onChange={(e) => setCoverPageData(prev => ({ 
                            ...prev, 
                            clientName: e.target.value 
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="projectName">Project Name</Label>
                        <Input
                          id="projectName"
                          value={coverPageData.projectName}
                          onChange={(e) => setCoverPageData(prev => ({ 
                            ...prev, 
                            projectName: e.target.value 
                          }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          value={coverPageData.address}
                          onChange={(e) => setCoverPageData(prev => ({ 
                            ...prev, 
                            address: e.target.value 
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="specBookType">Spec Book Type</Label>
                        <Input
                          id="specBookType"
                          placeholder="e.g., Electrical, Full Project, Lighting Only"
                          value={coverPageData.specBookType}
                          onChange={(e) => setCoverPageData(prev => ({ 
                            ...prev, 
                            specBookType: e.target.value 
                          }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Brief description of what's included in this spec book..."
                        value={coverPageData.description}
                        onChange={(e) => setCoverPageData(prev => ({ 
                          ...prev, 
                          description: e.target.value 
                        }))}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Project-Level Sections */}
                <Card>
                  <CardHeader>
                    <CardTitle>Project-Level Plans</CardTitle>
                    <p className="text-sm text-gray-600">
                      Select which overall project plans to include
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {PROJECT_LEVEL_SECTIONS.map((section) => (
                        <div key={section.type} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id={section.type}
                              checked={selectedSections[section.type] || false}
                              onCheckedChange={(checked) => 
                                handleSectionToggle(section.type, checked as boolean)
                              }
                            />
                            <div className="flex-1">
                              <Label 
                                htmlFor={section.type}
                                className="font-medium cursor-pointer"
                              >
                                {section.name}
                              </Label>
                              <p className="text-sm text-gray-500 mt-1">
                                {section.description}
                              </p>
                            </div>
                          </div>
                          
                          {selectedSections[section.type] && (
                            <div className="mt-3 space-y-3">
                              <PlanPdfUpload
                                projectId={project.id}
                                sectionType={section.type}
                                sectionName={section.name}
                              />
                              <DropboxFileBrowser 
                                roomId={null}
                                projectId={project.id}
                                sectionType={section.type}
                                sectionName={section.name}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Room Sections */}
                <Card>
                  <CardHeader>
                    <CardTitle>Room-Specific Content</CardTitle>
                    <p className="text-sm text-gray-600">
                      Drag to reorder • Select which rooms to include with renderings and drawings
                    </p>
                  </CardHeader>
                  <CardContent>
                    <DndContext 
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext 
                        items={roomOrder}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-4">
                          {orderedRooms.map((room) => (
                            <SortableRoomItem
                              key={room.id}
                              room={room}
                              isSelected={selectedRooms[room.id] || false}
                              onToggle={(checked) => handleRoomToggle(room.id, checked as boolean)}
                            >
                              <RenderingUpload roomId={room.id} />
                              <DropboxFileBrowser 
                                roomId={room.id}
                                projectId={project.id}
                              />
                            </SortableRoomItem>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Generation Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Generation Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Project Plans:</span>
                        <span>{selectedSectionsList.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Rooms:</span>
                        <span>{selectedRoomsList.length}</span>
                      </div>
                    </div>

                    {isGenerating && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Generating...</span>
                          <span>{generationProgress}%</span>
                        </div>
                        <Progress value={generationProgress} />
                      </div>
                    )}

                    <Button
                      onClick={handleGeneratePDF}
                      disabled={isGenerating || (selectedSectionsList.length === 0 && selectedRoomsList.length === 0)}
                      className="w-full"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Generate Spec Book
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Preview */}
                {(selectedSectionsList.length > 0 || selectedRoomsList.length > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm">
                        <div className="font-medium mb-2">Contents:</div>
                        {selectedSectionsList.map((section, index) => (
                          <div key={section.type} className="text-gray-600 pl-2">
                            {index + 1}. {section.name}
                          </div>
                        ))}
                        {selectedRoomsList.map((room, index) => (
                          <div key={room.id} className="text-gray-600 pl-2">
                            {selectedSectionsList.length + index + 1}. {room.name || room.type.replace('_', ' ')}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <SpecBookSettings project={project} session={session} />
          </TabsContent>

          <TabsContent value="history">
            <SpecBookHistory projectId={project.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}