import React from 'react'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ArrowLeft, Upload, Image, FileText, Link as LinkIcon, MessageSquare, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDate, formatRoomType } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DesignBoard from '@/components/rooms/design-board'

interface Props {
  params: { id: string; roomId: string }
}

export default async function RoomWorkspace({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user?.orgId) {
    redirect('/auth/signin')
  }

  // Await params in Next.js 15
  const { id, roomId } = await params

  // Fetch project and room data
  let project: any = null
  let room: any = null
  
  try {
    const projectData = await prisma.project.findFirst({
      where: { 
        id: id,
        orgId: session.user.orgId
      },
      include: {
        client: true,
        rooms: {
          include: {
            stages: {
              include: {
                assignedUser: true
              }
            },
            assets: true,
            ffeItems: true
          }
        }
      }
    })
    
    project = projectData
    room = projectData?.rooms.find((r: any) => r.id === roomId)
    
  } catch (error) {
    console.warn('Database unavailable, using fallback')
    // Use fallback data
    const { fallbackProjects } = await import('@/lib/fallback-data')
    project = fallbackProjects.find((p: any) => p.id === id) || fallbackProjects[0]
    room = project?.rooms.find((r: any) => r.id === roomId) || project?.rooms[0]
  }

  if (!project || !room) {
    redirect(`/projects/${id}`)
  }

  const getPhaseIcon = (phaseType: string) => {
    switch (phaseType) {
      case 'DESIGN': return '🎨'
      case 'THREE_D': return '🎥'
      case 'DRAWINGS': return '📐'
      case 'FFE': return '🛋️'
      default: return '⏳'
    }
  }

  const getRoomProgress = () => {
    const completedStages = room.stages.filter((stage: any) => stage.status === 'COMPLETED').length
    return room.stages.length > 0 ? Math.round((completedStages / room.stages.length) * 100) : 0
  }

  const getCurrentPhase = () => {
    const inProgressStage = room.stages.find((stage: any) => stage.status === 'IN_PROGRESS')
    if (inProgressStage) return inProgressStage.type
    
    const nextStage = room.stages.find((stage: any) => stage.status === 'NOT_STARTED')
    if (nextStage) return nextStage.type
    
    return 'DESIGN' // Default to design phase
  }

  const roomProgress = getRoomProgress()
  const currentPhase = getCurrentPhase()

  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href={`/projects/${id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Project
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {room.name || formatRoomType(room.type)}
                  </h1>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    <span>{project.name}</span>
                    <span>•</span>
                    <span>{project.client.name}</span>
                    <span>•</span>
                    <span>{roomProgress}% Complete</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Room Settings
                </Button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${roomProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Progress Tracker (Trello-style) */}
        <div className="px-6 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Workflow Progress</h3>
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
          
          <div className="flex space-x-4 overflow-x-auto pb-4">
            {['DESIGN', 'THREE_D', 'DRAWINGS', 'FFE'].map((phase, index) => {
              const phaseStage = room.stages.find((s: any) => s.type === phase)
              const isActive = phaseStage?.status === 'IN_PROGRESS'
              const isCompleted = phaseStage?.status === 'COMPLETED'
              const isNext = !isCompleted && !isActive && room.stages.findIndex((s: any) => s.status === 'IN_PROGRESS') < 0 && index === 0
              
              return (
                <div key={phase} className="flex-shrink-0 w-64">
                  <div className={`rounded-lg border-2 transition-all duration-200 ${
                    isActive ? 'border-blue-400 bg-blue-50' :
                    isCompleted ? 'border-green-400 bg-green-50' :
                    isNext ? 'border-purple-400 bg-purple-50' :
                    'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="px-4 py-3 border-b border-current/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getPhaseIcon(phase)}</span>
                          <h4 className="font-medium text-gray-900">
                            {phase === 'THREE_D' ? '3D' : phase.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                          </h4>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${
                          isCompleted ? 'bg-green-500' :
                          isActive ? 'bg-blue-500' :
                          isNext ? 'bg-purple-500' :
                          'bg-gray-300'
                        }`} />
                      </div>
                    </div>
                    <div className="p-4 min-h-[120px]">
                      {isCompleted && (
                        <div className="flex items-center space-x-2 text-green-600 text-sm">
                          <span>✅</span>
                          <span>Phase Complete</span>
                        </div>
                      )}
                      {isActive && (
                        <div className="flex items-center space-x-2 text-blue-600 text-sm">
                          <span>🔄</span>
                          <span>In Progress</span>
                        </div>
                      )}
                      {isNext && (
                        <div className="flex items-center space-x-2 text-purple-600 text-sm">
                          <span>⏳</span>
                          <span>Ready to Start</span>
                        </div>
                      )}
                      {!isCompleted && !isActive && !isNext && (
                        <div className="text-gray-500 text-sm">
                          <span>Pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Content - Phase Tabs */}
        <div className="px-6 py-8">
          <Tabs defaultValue={currentPhase?.toLowerCase() || 'design'} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="design" className="flex items-center space-x-2">
                <span>🎨</span>
                <span>Design</span>
              </TabsTrigger>
              <TabsTrigger value="three_d" className="flex items-center space-x-2">
                <span>🎥</span>
                <span>3D Rendering</span>
              </TabsTrigger>
              <TabsTrigger value="drawings" className="flex items-center space-x-2">
                <span>📐</span>
                <span>Drafting</span>
              </TabsTrigger>
              <TabsTrigger value="ffe" className="flex items-center space-x-2">
                <span>🛋️</span>
                <span>FFE</span>
              </TabsTrigger>
            </TabsList>

            {/* Design Phase Content */}
            <TabsContent value="design" className="space-y-8 mt-8">
              <DesignPhaseContent roomId={roomId} projectId={id} />
            </TabsContent>

            {/* 3D Rendering Phase Content */}
            <TabsContent value="three_d" className="space-y-8 mt-8">
              <RenderingPhaseContent roomId={roomId} />
            </TabsContent>

            {/* Drafting Phase Content */}
            <TabsContent value="drawings" className="space-y-8 mt-8">
              <DraftingPhaseContent roomId={roomId} />
            </TabsContent>

            {/* FFE Phase Content */}
            <TabsContent value="ffe" className="space-y-8 mt-8">
              <FFEPhaseContent roomId={roomId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  )
}

// Design Phase Component with Pinterest-style boards
function DesignPhaseContent({ roomId, projectId }: { roomId: string; projectId: string }) {
  const designSections = [
    { id: 'floor', name: 'Floor', icon: '🏠' },
    { id: 'walls', name: 'Walls', icon: '🎨' },
    { id: 'mouldings', name: 'Mouldings', icon: '🏛️' },
    { id: 'lighting', name: 'Lighting', icon: '💡' },
    { id: 'decor', name: 'Decor', icon: '🎭' }
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">Design Boards</h3>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Section
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {designSections.map((section) => (
          <DesignBoard key={section.id} section={section} roomId={roomId} projectId={projectId} />
        ))}
      </div>
    </div>
  )
}

// Components are now imported from separate files

// 3D Rendering Phase Component
function RenderingPhaseContent({ roomId }: { roomId: string }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">3D Renderings</h3>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload Renders
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <UploadZone title="Initial Renders" description="Upload first draft renderings" />
        <UploadZone title="Final Renders" description="Client-approved final renders" />
      </div>
    </div>
  )
}

// Drafting Phase Component
function DraftingPhaseContent({ roomId }: { roomId: string }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">Construction Drawings</h3>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload Drawings
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <UploadZone title="Floor Plans" description="Detailed floor plan drawings" />
        <UploadZone title="Elevations" description="Wall elevation drawings" />
        <UploadZone title="Sections" description="Cross-section drawings" />
        <UploadZone title="Details" description="Construction detail drawings" />
      </div>
    </div>
  )
}

// FFE Phase Component
function FFEPhaseContent({ roomId }: { roomId: string }) {
  const ffeCategories = [
    { name: 'Beds', icon: '🛏️', items: [] },
    { name: 'Sofas', icon: '🛋️', items: [] },
    { name: 'Rugs', icon: '🟫', items: [] },
    { name: 'Lighting', icon: '💡', items: [] },
    { name: 'Accessories', icon: '🎨', items: [] }
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">Furniture, Fixtures & Equipment</h3>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {ffeCategories.map((category) => (
          <FFECategory key={category.name} category={category} />
        ))}
      </div>
    </div>
  )
}

// FFE Category Component
function FFECategory({ category }: { category: any }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-xl">{category.icon}</span>
            <h4 className="font-semibold text-gray-900">{category.name}</h4>
          </div>
          <Button variant="ghost" size="sm">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="p-6">
        {category.items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-2xl mb-2 block">{category.icon}</span>
            <p className="text-sm">No items added yet</p>
            <Button variant="outline" size="sm" className="mt-2">
              Add {category.name}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {category.items.map((item: any) => (
              <div key={item.id} className="p-3 border border-gray-200 rounded-lg">
                {/* Item details would go here */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Upload Zone Component
function UploadZone({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-purple-300 transition-colors cursor-pointer">
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600">Drop files here or click to upload</p>
        <p className="text-xs text-gray-500 mt-1">PNG, JPG, PDF up to 10MB</p>
      </div>
    </div>
  )
}