import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ArrowLeft, Plus, Settings, MoreVertical, Users, Calendar, MapPin, Sofa, Bed, UtensilsCrossed, Bath, Briefcase, Gamepad2, DoorOpen, Home, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDate, formatRoomType } from '@/lib/utils'

interface Props {
  params: { id: string }
}

export default async function ProjectDetail({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user?.orgId) {
    redirect('/auth/signin')
  }

  // Await params in Next.js 15
  const { id } = await params

  // Fetch project with rooms and stages
  let project: any = null
  
  try {
    project = await prisma.project.findFirst({
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
                assignedUser: true,
                designSections: {
                  select: {
                    id: true,
                    type: true,
                    completed: true
                  }
                }
              }
            },
            assets: true,
            ffeItems: true
          }
        }
      }
    })
  } catch (error) {
    console.warn('Database unavailable, using fallback')
    // Use fallback project data
    const { fallbackProjects } = await import('@/lib/fallback-data')
    project = fallbackProjects.find((p: any) => p.id === id) || fallbackProjects[0]
  }

  if (!project) {
    redirect('/projects')
  }

  // Calculate overall project progress
  const totalStages = project.rooms.reduce((total: number, room: any) => {
    return total + room.stages.length
  }, 0)
  const completedStages = project.rooms.reduce((total: number, room: any) => {
    return total + room.stages.filter((stage: any) => stage.status === 'COMPLETED').length
  }, 0)
  const overallProgress = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0

  const getPhaseIcon = (phaseType: string) => {
    switch (phaseType) {
      case 'DESIGN': return '🎨'
      case 'THREE_D': return '🎥'
      case 'CLIENT_APPROVAL': return '👥'
      case 'DRAWINGS': return '📐'
      case 'FFE': return '🛋️'
      default: return '⏳'
    }
  }

  const getRoomProgress = (room: any) => {
    let totalProgress = 0
    let progressCount = 0
    
    room.stages.forEach((stage: any) => {
      if (stage.status === 'COMPLETED') {
        totalProgress += 100
        progressCount += 1
      } else if (stage.status === 'IN_PROGRESS' && stage.type === 'DESIGN' && stage.designSections) {
        // For design stage, calculate progress based on completed sections
        const completedSections = stage.designSections.filter((section: any) => section.completed).length
        const sectionProgress = stage.designSections.length > 0 ? (completedSections / stage.designSections.length) * 100 : 0
        totalProgress += sectionProgress
        progressCount += 1
      } else if (stage.status === 'IN_PROGRESS') {
        // For other stages in progress, assume 50% completion
        totalProgress += 50
        progressCount += 1
      } else {
        // Not started stages contribute 0
        progressCount += 1
      }
    })
    
    return progressCount > 0 ? Math.round(totalProgress / progressCount) : 0
  }

  const getRoomIcon = (roomType: string) => {
    // Import the room mapping from new project form to maintain consistency
    const roomMappings = {
      'LIVING_ROOM': { icon: Sofa, color: 'bg-green-500' },
      'MASTER_BEDROOM': { icon: Bed, color: 'bg-blue-600' },
      'BEDROOM': { icon: Bed, color: 'bg-blue-500' },
      'KITCHEN': { icon: UtensilsCrossed, color: 'bg-red-500' },
      'DINING_ROOM': { icon: UtensilsCrossed, color: 'bg-orange-500' },
      'MASTER_BATHROOM': { icon: Bath, color: 'bg-cyan-600' },
      'BATHROOM': { icon: Bath, color: 'bg-cyan-500' },
      'POWDER_ROOM': { icon: Bath, color: 'bg-cyan-300' },
      'OFFICE': { icon: Briefcase, color: 'bg-purple-500' },
      'STUDY_ROOM': { icon: Briefcase, color: 'bg-purple-400' },
      'FAMILY_ROOM': { icon: Sofa, color: 'bg-green-400' },
      'GUEST_BEDROOM': { icon: Bed, color: 'bg-indigo-400' },
      'GIRLS_ROOM': { icon: Bed, color: 'bg-pink-400' },
      'BOYS_ROOM': { icon: Bed, color: 'bg-blue-400' },
      'PLAYROOM': { icon: Gamepad2, color: 'bg-pink-500' },
      'LAUNDRY_ROOM': { icon: Settings, color: 'bg-indigo-500' },
      'ENTRANCE': { icon: DoorOpen, color: 'bg-gray-600' },
      'FOYER': { icon: Home, color: 'bg-gray-500' },
      'STAIRCASE': { icon: Navigation, color: 'bg-gray-400' },
      'GIRLS_BATHROOM': { icon: Bath, color: 'bg-pink-300' },
      'BOYS_BATHROOM': { icon: Bath, color: 'bg-blue-300' },
      'GUEST_BATHROOM': { icon: Bath, color: 'bg-cyan-400' },
      'FAMILY_BATHROOM': { icon: Bath, color: 'bg-cyan-500' },
      'SUKKAH': { icon: Home, color: 'bg-green-700' },
    }
    
    return roomMappings[roomType] || { icon: Home, color: 'bg-gray-500' }
  }

  const getCurrentPhase = (room: any) => {
    const inProgressStage = room.stages.find((stage: any) => stage.status === 'IN_PROGRESS')
    if (inProgressStage) {
      return {
        name: inProgressStage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
        icon: getPhaseIcon(inProgressStage.type),
        type: inProgressStage.type
      }
    }
    
    const nextStage = room.stages.find((stage: any) => stage.status === 'NOT_STARTED')
    if (nextStage) {
      return {
        name: `Up Next: ${nextStage.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}`,
        icon: getPhaseIcon(nextStage.type),
        type: nextStage.type
      }
    }
    
    return {
      name: 'Complete',
      icon: '✅',
      type: 'COMPLETE'
    }
  }

  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen bg-gray-50">
        {/* Modern Header */}
        <div className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href="/projects">
                  <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Projects
                  </Button>
                </Link>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50">
                  <Settings className="w-4 h-4 mr-2" />
                  Project Settings
                </Button>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Room
                </Button>
              </div>
            </div>
            
            {/* Project Title & Info */}
            <div className="mt-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-3">{project.name}</h1>
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4" />
                  <span className="font-medium">{project.client.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>{project.rooms.length} rooms</span>
                </div>
                {project.dueDate && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Due {formatDate(project.dueDate)}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-medium">{overallProgress}% Complete</span>
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-purple-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modern Rooms Section */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Rooms</h2>
              <p className="text-gray-600 mt-1">Manage and track progress for all project rooms</p>
            </div>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add New Room
            </Button>
          </div>
          
          {/* Room Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {project.rooms.map((room: any) => {
              const roomProgress = getRoomProgress(room)
              const currentPhase = getCurrentPhase(room)
              const roomIconData = getRoomIcon(room.type)
              const IconComponent = roomIconData.icon
              
              return (
                <Link
                  key={room.id}
                  href={`/projects/${project.id}/rooms/${room.id}`}
                  className="group block"
                >
                  <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-purple-200 transition-all duration-200 group-hover:scale-[1.02]">
                    {/* Room Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 ${roomIconData.color} rounded-lg flex items-center justify-center shadow-sm`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                            {room.name || formatRoomType(room.type)}
                          </h3>
                          <div className="flex items-center space-x-1 mt-1">
                            <span className="text-xs text-gray-500">{currentPhase.icon}</span>
                            <span className="text-xs text-gray-500">{currentPhase.name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{roomProgress}%</div>
                        <div className="text-xs text-gray-500">Complete</div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${roomProgress}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Stages Overview */}
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                        Workflow Stages
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {room.stages.map((stage: any, index: number) => {
                          const stageProgress = stage.status === 'COMPLETED' ? 100 : 
                                             stage.status === 'IN_PROGRESS' && stage.type === 'DESIGN' && stage.designSections ?
                                             stage.designSections.filter((s: any) => s.completed).length / stage.designSections.length * 100 :
                                             stage.status === 'IN_PROGRESS' ? 50 : 0
                          
                          return (
                            <div key={stage.id} className="text-center">
                              <div className="text-xs mb-1">{getPhaseIcon(stage.type)}</div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 rounded-full transition-all duration-300 ${
                                    stage.status === 'COMPLETED' ? 'bg-green-500' :
                                    stage.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                                    'bg-gray-300'
                                  }`}
                                  style={{ width: `${stageProgress}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      
                      {/* Stage Summary */}
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>{room.stages.filter((s: any) => s.status === 'COMPLETED').length} completed</span>
                        <span>{room.stages.filter((s: any) => s.status === 'IN_PROGRESS').length} active</span>
                        <span>{room.stages.filter((s: any) => s.status === 'NOT_STARTED').length} pending</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
            
            {/* Add New Room Card */}
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 p-6 hover:border-purple-400 transition-colors cursor-pointer group">
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
                  <Plus className="w-6 h-6 text-gray-400 group-hover:text-purple-600" />
                </div>
                <h3 className="font-medium text-gray-900 group-hover:text-purple-600 transition-colors">Add New Room</h3>
                <p className="text-sm text-gray-500 mt-1">Create a new room for this project</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
