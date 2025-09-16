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
                assignedUser: true
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
    const completedStages = room.stages.filter((stage: any) => stage.status === 'COMPLETED').length
    return room.stages.length > 0 ? Math.round((completedStages / room.stages.length) * 100) : 0
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
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href="/projects">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Projects
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{project.client.name}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-4 h-4" />
                      <span>{project.rooms.length} rooms</span>
                    </div>
                    {project.dueDate && (
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Due {formatDate(project.dueDate)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{overallProgress}%</div>
                  <div className="text-sm text-gray-500">Complete</div>
                </div>
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Room
                </Button>
              </div>
            </div>
            
            {/* Overall Progress Bar */}
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rooms Dashboard */}
        <div className="px-6 py-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Project Rooms</h2>
            <p className="text-gray-600">Click on any room to access the detailed workspace</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {project.rooms.map((room: any) => {
              const roomProgress = getRoomProgress(room)
              const currentPhase = getCurrentPhase(room)
              
              return (
                <Link
                  key={room.id}
                  href={`/projects/${project.id}/rooms/${room.id}`}
                  className="group"
                >
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:border-purple-200 transition-all duration-300 group-hover:scale-[1.02]">
                    {/* Room Thumbnail */}
                    <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        {(() => {
                          const roomIconData = getRoomIcon(room.type)
                          const IconComponent = roomIconData.icon
                          return (
                            <div className={`w-16 h-16 ${roomIconData.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                              <IconComponent className="w-8 h-8 text-white" />
                            </div>
                          )
                        })()}
                      </div>
                      
                      {/* Current Phase Badge */}
                      <div className="absolute top-3 right-3">
                        <div className="bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 border border-gray-200">
                          <div className="flex items-center space-x-1">
                            <span className="text-sm">{currentPhase.icon}</span>
                            <span className="text-xs font-medium text-gray-700 hidden sm:inline">
                              {currentPhase.name.length > 15 ? currentPhase.name.substring(0, 12) + '...' : currentPhase.name}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Progress Ring */}
                      <div className="absolute bottom-3 left-3">
                        <div className="relative">
                          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                            <path
                              d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                              fill="none"
                              stroke="#e5e7eb"
                              strokeWidth="2"
                            />
                            <path
                              d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                              fill="none"
                              stroke="url(#gradient)"
                              strokeWidth="2"
                              strokeDasharray={`${roomProgress}, 100`}
                              className="transition-all duration-500"
                            />
                            <defs>
                              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#8b5cf6" />
                                <stop offset="100%" stopColor="#ec4899" />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-700">{roomProgress}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Room Info */}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                          {room.name || formatRoomType(room.type)}
                        </h3>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {/* Progress Summary */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">
                            {room.stages.filter((s: any) => s.status === 'COMPLETED').length}/{room.stages.length} phases complete
                          </span>
                        </div>
                        
                        {/* Stage Pills */}
                        <div className="flex flex-wrap gap-1">
                          {room.stages.slice(0, 4).map((stage: any, index: number) => (
                            <div
                              key={stage.id}
                              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                stage.status === 'COMPLETED' 
                                  ? 'bg-green-500' 
                                  : stage.status === 'IN_PROGRESS'
                                  ? 'bg-blue-500'
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
            
            {/* Add New Room Card */}
            <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-200 hover:border-purple-300 transition-colors">
              <div className="aspect-square flex items-center justify-center">
                <div className="text-center">
                  <Plus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">Add New Room</p>
                  <p className="text-xs text-gray-500 mt-1">Start designing another space</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
