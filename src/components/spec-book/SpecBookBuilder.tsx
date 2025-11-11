'use client'

import { useState, useCallback } from 'react'
import { ArrowLeft, BookOpen, Settings, FileText, Download, Plus, Folder, File, Loader2, AlertCircle, GripVertical, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react'
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import Link from 'next/link'
import { DropboxFileBrowser } from './DropboxFileBrowser'
import { PlanPdfUpload } from './PlanPdfUpload'
import { RenderingSelector } from './RenderingSelector'
import { RoomFilesUpload } from './RoomFilesUpload'
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

// Sortable Room Item Component with Collapsible
function SortableRoomItem({ 
  room, 
  isSelected, 
  onToggle, 
  isOpen,
  onToggleOpen,
  children 
}: {
  room: { id: string; name: string; type: string }
  isSelected: boolean
  onToggle: (checked: boolean) => void
  isOpen: boolean
  onToggleOpen: () => void
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
    <div ref={setNodeRef} style={style} className="border border-gray-200/70 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-gray-50/50">
        <div className="flex items-center space-x-3 flex-1">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none hover:text-gray-700">
            <GripVertical className="w-5 h-5 text-gray-400" />
          </div>
          <Checkbox
            id={room.id}
            checked={isSelected}
            onCheckedChange={onToggle}
          />
          <Label 
            htmlFor={room.id}
            className="font-medium cursor-pointer flex-1 text-gray-900"
          >
            {room.name || room.type.replace('_', ' ')}
          </Label>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleOpen}
          className="h-8 w-8 p-0"
        >
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
      </div>
      {isOpen && isSelected && (
        <div className="p-4 space-y-4 border-t border-gray-100">
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
  
  // State for selected renderings per room
  const [selectedRenderings, setSelectedRenderings] = useState<Record<string, string[]>>({})
  
  // State for room ordering
  const [roomOrder, setRoomOrder] = useState<string[]>(() => project.rooms.map(r => r.id))
  
  // State for collapsible rooms and sections
  const [openRooms, setOpenRooms] = useState<Record<string, boolean>>({})
  const [projectSectionsOpen, setProjectSectionsOpen] = useState(false)
  const [roomSectionsOpen, setRoomSectionsOpen] = useState(false)
  
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
  
  const handleRenderingSelection = useCallback((roomId: string, urls: string[]) => {
    setSelectedRenderings(prev => ({
      ...prev,
      [roomId]: urls
    }))
  }, [])
  
  const toggleRoomOpen = useCallback((roomId: string) => {
    setOpenRooms(prev => ({
      ...prev,
      [roomId]: !prev[roomId]
    }))
  }, [])
  
  const expandAllRooms = useCallback(() => {
    const allOpen: Record<string, boolean> = {}
    project.rooms.forEach(room => {
      allOpen[room.id] = true
    })
    setOpenRooms(allOpen)
  }, [project.rooms])
  
  const collapseAllRooms = useCallback(() => {
    setOpenRooms({})
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
      
      console.log('[SpecBook] Room order being sent to API:', selectedRoomIds)
      console.log('[SpecBook] Room names in order:', selectedRoomIds.map(id => project.rooms.find(r => r.id === id)?.name || 'Unknown'))
      
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
          selectedRooms: selectedRoomIds,
          selectedRenderings // Include selected rendering URLs per room
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Compact Header */}
      <div className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href={`/projects/${project.id}`}>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="h-8 w-px bg-gray-200" />
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Spec Book Builder</h1>
                  <p className="text-xs text-gray-500">{project.name}</p>
                </div>
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{selectedSectionsList.length}</div>
                <div className="text-xs text-gray-500">Plans</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{selectedRoomsList.length}</div>
                <div className="text-xs text-gray-500">Rooms</div>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <Button
                onClick={handleGeneratePDF}
                disabled={isGenerating || (selectedSectionsList.length === 0 && selectedRoomsList.length === 0)}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg shadow-blue-500/20"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating {generationProgress}%
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generate Spec Book
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isGenerating && (
        <div className="fixed top-[73px] left-0 right-0 z-30">
          <Progress value={generationProgress} className="h-1 rounded-none" />
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-white/50 backdrop-blur border border-gray-200/50 p-1.5">
            <TabsTrigger value="builder" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FileText className="w-4 h-4 mr-2" />
              Builder
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <BookOpen className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="builder">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content - Left Side */}
              <div className="lg:col-span-2 space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Step 1: Cover Page */}
                <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200/70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                      1
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Cover Page Details</h2>
                      <p className="text-sm text-gray-600">Set your spec book title and description</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientName" className="text-sm font-medium text-gray-700">Client Name</Label>
                      <Input
                        id="clientName"
                        value={coverPageData.clientName}
                        onChange={(e) => setCoverPageData(prev => ({ 
                          ...prev, 
                          clientName: e.target.value 
                        }))}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="projectName" className="text-sm font-medium text-gray-700">Project Name</Label>
                      <Input
                        id="projectName"
                        value={coverPageData.projectName}
                        onChange={(e) => setCoverPageData(prev => ({ 
                          ...prev, 
                          projectName: e.target.value 
                        }))}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-sm font-medium text-gray-700">Project Address</Label>
                      <Input
                        id="address"
                        value={coverPageData.address}
                        onChange={(e) => setCoverPageData(prev => ({ 
                          ...prev, 
                          address: e.target.value 
                        }))}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specBookType" className="text-sm font-medium text-gray-700">Book Type</Label>
                      <Input
                        id="specBookType"
                        placeholder="e.g., Full Project, Electrical, Lighting"
                        value={coverPageData.specBookType}
                        onChange={(e) => setCoverPageData(prev => ({ 
                          ...prev, 
                          specBookType: e.target.value 
                        }))}
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of what's included..."
                      value={coverPageData.description}
                      onChange={(e) => setCoverPageData(prev => ({ 
                        ...prev, 
                        description: e.target.value 
                      }))}
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[80px]"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Project Plans */}
            <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-200/70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-purple-500/20">
                      2
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Project-Level Plans</h2>
                      <p className="text-sm text-gray-600">Select overall drawings to include</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setProjectSectionsOpen(!projectSectionsOpen)}
                    className="gap-2 text-xs"
                  >
                    {projectSectionsOpen ? 'Collapse' : 'Expand'} All
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <Accordion type="multiple" value={projectSectionsOpen ? PROJECT_LEVEL_SECTIONS.map(s => s.type) : undefined} className="space-y-3">
                  {PROJECT_LEVEL_SECTIONS.map((section) => (
                    <AccordionItem key={section.type} value={section.type} className="border border-gray-200/70 rounded-xl overflow-hidden">
                      <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-gray-50/50">
                        <div className="flex items-center space-x-3 flex-1 text-left">
                          <Checkbox
                            id={section.type}
                            checked={selectedSections[section.type] || false}
                            onCheckedChange={(checked) => 
                              handleSectionToggle(section.type, checked as boolean)
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{section.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{section.description}</div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 bg-gray-50/30">
                        {selectedSections[section.type] && (
                          <div className="space-y-3 pt-2">
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                              <PlanPdfUpload
                                projectId={project.id}
                                sectionType={section.type}
                                sectionName={section.name}
                              />
                            </div>
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                              <DropboxFileBrowser 
                                roomId={null}
                                projectId={project.id}
                                sectionType={section.type}
                                sectionName={section.name}
                              />
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>

            {/* Step 3: Room-Specific Content */}
            <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-200/70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20">
                      3
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Room Content</h2>
                      <p className="text-sm text-gray-600">Add renderings and drawings for each room</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={expandAllRooms}
                      className="gap-2 text-xs"
                    >
                      Expand All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={collapseAllRooms}
                      className="gap-2 text-xs"
                    >
                      Collapse All
                    </Button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={roomOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {orderedRooms.map((room) => (
                        <SortableRoomItem
                          key={room.id}
                          room={room}
                          isSelected={selectedRooms[room.id] || false}
                          onToggle={(checked) => handleRoomToggle(room.id, checked as boolean)}
                          isOpen={openRooms[room.id] || false}
                          onToggleOpen={() => toggleRoomOpen(room.id)}
                        >
                          <RenderingSelector 
                            roomId={room.id} 
                            projectId={project.id}
                            onChange={(urls) => handleRenderingSelection(room.id, urls)}
                          />
                          <div className="rounded-lg border border-gray-200 bg-white p-4 mt-4">
                            <RoomFilesUpload 
                              roomId={room.id}
                            />
                          </div>
                        </SortableRoomItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
              </div>

              {/* Sticky Sidebar - Right Side */}
              <div className="lg:col-span-1">
                <div className="sticky top-24 space-y-4">
                  {/* Quick Stats Card */}
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
                    <h3 className="text-sm font-medium opacity-90 mb-4">Spec Book Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-3xl font-bold">{selectedSectionsList.length}</div>
                        <div className="text-xs opacity-80 mt-1">Project Plans</div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold">{selectedRoomsList.length}</div>
                        <div className="text-xs opacity-80 mt-1">Rooms</div>
                      </div>
                    </div>
                  </div>

                  {/* Preview Contents */}
                  {(selectedSectionsList.length > 0 || selectedRoomsList.length > 0) && (
                    <div className="bg-white rounded-2xl border border-gray-200/70 shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-gray-50 to-slate-50 px-4 py-3 border-b border-gray-200/70">
                        <h3 className="text-sm font-semibold text-gray-900">Table of Contents</h3>
                      </div>
                      <div className="p-4 max-h-[500px] overflow-y-auto">
                        <div className="space-y-3">
                          {selectedSectionsList.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Plans</div>
                              <div className="space-y-1.5">
                                {selectedSectionsList.map((section, index) => (
                                  <div key={section.type} className="flex items-start space-x-2 text-sm">
                                    <div className="w-5 h-5 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                                      {index + 1}
                                    </div>
                                    <span className="text-gray-700 leading-tight">{section.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {selectedRoomsList.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rooms</div>
                              <div className="space-y-1.5">
                                {selectedRoomsList.map((room, index) => (
                                  <div key={room.id} className="flex items-start space-x-2 text-sm">
                                    <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5">
                                      {selectedSectionsList.length + index + 1}
                                    </div>
                                    <span className="text-gray-700 leading-tight">{room.name || room.type.replace('_', ' ')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tips Card */}
                  <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Quick Tip</h4>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          Select the plans and rooms you want, then click Generate to create your professional spec book.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
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
