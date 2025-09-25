import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ArrowLeft, Plus, Settings, MoreVertical, Users, Calendar, MapPin, Sofa, Bed, UtensilsCrossed, Bath, Briefcase, Gamepad2, DoorOpen, Home, Navigation } from 'lucide-react'
import { getStageIcon } from '@/constants/workflow'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatDate, formatRoomType } from '@/lib/utils'
import ProjectSaveSuccess from '@/components/projects/project-save-success'
import RoomGridClient from '@/components/projects/room-grid-client'

interface Props {
  params: { id: string }
}

export default async function ProjectDetail({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Await params in Next.js 15
  const { id } = await params

  // Fetch project with rooms and stages
  let project: any = null
  
  try {
    project = await prisma.project.findFirst({
      where: { 
        id: id
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
                    type: true
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
    console.error('Error fetching project:', error)
    redirect('/projects')
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
    return getStageIcon(phaseType)
  }

  const getRoomProgress = (room: any) => {
    // Map actual database stage types to our 5-phase display system
    // Database has: DESIGN, DESIGN_CONCEPT, THREE_D, CLIENT_APPROVAL, DRAWINGS, FFE
    // We want to show: DESIGN_CONCEPT (combines DESIGN+DESIGN_CONCEPT), THREE_D, CLIENT_APPROVAL, DRAWINGS, FFE
    const stageTypeMap: Record<string, string> = {
      'DESIGN': 'DESIGN_CONCEPT',
      'DESIGN_CONCEPT': 'DESIGN_CONCEPT', 
      'THREE_D': 'THREE_D',
      'CLIENT_APPROVAL': 'CLIENT_APPROVAL', 
      'DRAWINGS': 'DRAWINGS',
      'FFE': 'FFE'
    }
    
    const phaseIds = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
    
    // Count only COMPLETED phases for progress (matching room phase board logic)
    let completedPhases = 0
    let totalApplicablePhases = 0
    
    phaseIds.forEach(phaseId => {
      let matchingStage = null
      
      if (phaseId === 'DESIGN_CONCEPT') {
        const designStage = room.stages.find((stage: any) => stage.type === 'DESIGN')
        const designConceptStage = room.stages.find((stage: any) => stage.type === 'DESIGN_CONCEPT')
        matchingStage = designConceptStage || designStage
      } else {
        matchingStage = room.stages.find((stage: any) => stage.type === phaseId)
      }
      
      // Skip phases marked as not applicable
      if (matchingStage?.status === 'NOT_APPLICABLE') {
        return
      }
      
      totalApplicablePhases++
      
      if (phaseId === 'DESIGN_CONCEPT') {
        // For DESIGN_CONCEPT phase, check if either DESIGN or DESIGN_CONCEPT is completed
        const designStage = room.stages.find((stage: any) => stage.type === 'DESIGN')
        const designConceptStage = room.stages.find((stage: any) => stage.type === 'DESIGN_CONCEPT')
        
        if (designConceptStage?.status === 'COMPLETED' || designStage?.status === 'COMPLETED') {
          completedPhases++
        }
      } else {
        if (matchingStage?.status === 'COMPLETED') {
          completedPhases++
        }
      }
    })
    
    return totalApplicablePhases > 0 ? Math.round((completedPhases / totalApplicablePhases) * 100) : 0
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
    // Use the same 5-phase mapping as the progress calculation
    const stageTypeMap: Record<string, string> = {
      'DESIGN': 'DESIGN_CONCEPT',
      'DESIGN_CONCEPT': 'DESIGN_CONCEPT', 
      'THREE_D': 'THREE_D',
      'CLIENT_APPROVAL': 'CLIENT_APPROVAL',
      'DRAWINGS': 'DRAWINGS',
      'FFE': 'FFE'
    }
    
    const phaseIds = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
    const phaseNames: Record<string, string> = {
      'DESIGN_CONCEPT': 'Design Concept',
      'THREE_D': '3D Rendering',
      'CLIENT_APPROVAL': 'Client Approval',
      'DRAWINGS': 'Drawings',
      'FFE': 'FFE'
    }
    
    // Find the first IN_PROGRESS phase
    for (const phaseId of phaseIds) {
      if (phaseId === 'DESIGN_CONCEPT') {
        const designStage = room.stages.find((stage: any) => stage.type === 'DESIGN')
        const designConceptStage = room.stages.find((stage: any) => stage.type === 'DESIGN_CONCEPT')
        
        if (designConceptStage?.status === 'IN_PROGRESS' || designStage?.status === 'IN_PROGRESS') {
          return {
            name: phaseNames[phaseId],
            icon: getPhaseIcon('DESIGN_CONCEPT'),
            type: 'DESIGN_CONCEPT'
          }
        }
      } else {
        const matchingStage = room.stages.find((stage: any) => stage.type === phaseId)
        
        if (matchingStage?.status === 'IN_PROGRESS') {
          return {
            name: phaseNames[phaseId],
            icon: getPhaseIcon(matchingStage.type),
            type: matchingStage.type
          }
        }
      }
    }
    
    // Find the next NOT_STARTED phase
    for (const phaseId of phaseIds) {
      if (phaseId === 'DESIGN_CONCEPT') {
        const designStage = room.stages.find((stage: any) => stage.type === 'DESIGN')
        const designConceptStage = room.stages.find((stage: any) => stage.type === 'DESIGN_CONCEPT')
        
        const isDesignStarted = designStage?.status !== 'NOT_STARTED'
        const isDesignConceptStarted = designConceptStage?.status !== 'NOT_STARTED'
        const isDesignCompleted = designStage?.status === 'COMPLETED'
        const isDesignConceptCompleted = designConceptStage?.status === 'COMPLETED'
        
        if (!isDesignStarted && !isDesignConceptStarted) {
          return {
            name: `Up Next: ${phaseNames[phaseId]}`,
            icon: getPhaseIcon('DESIGN_CONCEPT'),
            type: 'DESIGN_CONCEPT'
          }
        }
      } else {
        const matchingStage = room.stages.find((stage: any) => stage.type === phaseId)
        
        if (!matchingStage || matchingStage.status === 'NOT_STARTED') {
          return {
            name: `Up Next: ${phaseNames[phaseId]}`,
            icon: getPhaseIcon(phaseId),
            type: phaseId
          }
        }
      }
    }
    
    // All phases are complete
    return {
      name: 'Complete',
      icon: '✅',
      type: 'COMPLETE'
    }
  }

  return (
    <DashboardLayout session={session}>
      <ProjectSaveSuccess />
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
                <Button variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50" asChild>
                  <Link href={`/projects/${project.id}/settings`}>
                    <Settings className="w-4 h-4 mr-2" />
                    Project Settings
                  </Link>
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
          </div>
          
          {/* Room Cards Grid */}
          <RoomGridClient 
            initialRooms={project.rooms}
            projectId={project.id}
            roomCards={project.rooms.map((room: any) => {
              const roomProgress = getRoomProgress(room)
              const currentPhase = getCurrentPhase(room)
              const roomIconData = getRoomIcon(room.type)
              const IconComponent = roomIconData.icon
              
              // Determine room status based on phases
              const stageTypeMap: Record<string, string> = {
                'DESIGN': 'DESIGN_CONCEPT',
                'DESIGN_CONCEPT': 'DESIGN_CONCEPT', 
                'THREE_D': 'THREE_D',
                'CLIENT_APPROVAL': 'CLIENT_APPROVAL',
                'DRAWINGS': 'DRAWINGS',
                'FFE': 'FFE'
              }
              
              const phaseIds = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
              
              let completedCount = 0
              let totalApplicablePhases = 0
              let hasInProgress = false
              
              phaseIds.forEach(phaseId => {
                let matchingStage = null
                
                if (phaseId === 'DESIGN_CONCEPT') {
                  const designStage = room.stages.find((stage: any) => stage.type === 'DESIGN')
                  const designConceptStage = room.stages.find((stage: any) => stage.type === 'DESIGN_CONCEPT')
                  matchingStage = designConceptStage || designStage
                } else {
                  matchingStage = room.stages.find((stage: any) => stage.type === phaseId)
                }
                
                // Skip phases marked as not applicable
                if (matchingStage?.status === 'NOT_APPLICABLE') {
                  return
                }
                
                totalApplicablePhases++
                
                if (phaseId === 'DESIGN_CONCEPT') {
                  const designStage = room.stages.find((stage: any) => stage.type === 'DESIGN')
                  const designConceptStage = room.stages.find((stage: any) => stage.type === 'DESIGN_CONCEPT')
                  
                  if (designConceptStage?.status === 'COMPLETED' || designStage?.status === 'COMPLETED') {
                    completedCount++
                  } else if (designConceptStage?.status === 'IN_PROGRESS' || designStage?.status === 'IN_PROGRESS') {
                    hasInProgress = true
                  }
                } else {
                  if (matchingStage?.status === 'COMPLETED') {
                    completedCount++
                  } else if (matchingStage?.status === 'IN_PROGRESS') {
                    hasInProgress = true
                  }
                }
              })
              
              const isCompleted = totalApplicablePhases > 0 && completedCount === totalApplicablePhases
              const isInProgress = hasInProgress || completedCount > 0
              
              // Determine room card styling
              const getRoomCardStyle = () => {
                if (isCompleted) {
                  return "bg-gradient-to-br from-green-50 to-green-100 border-green-300 hover:border-green-400"
                } else if (isInProgress) {
                  return "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-300 hover:border-blue-400"
                } else {
                  return "bg-white border-gray-200 hover:border-purple-200"
                }
              }
              
              return (
                <Link
                  key={room.id}
                  href={`/projects/${project.id}/rooms/${room.id}`}
                  className="group block"
                >
                  <div className={`rounded-xl border p-6 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02] ${getRoomCardStyle()}`}>
                    {/* Room Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 ${roomIconData.color} rounded-lg flex items-center justify-center shadow-sm`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className={`font-semibold transition-colors ${
                            isCompleted ? 'text-green-800 group-hover:text-green-900' :
                            isInProgress ? 'text-blue-800 group-hover:text-blue-900' :
                            'text-gray-900 group-hover:text-purple-600'
                          }`}>
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
                          className={`h-2 rounded-full transition-all duration-500 ${
                            isCompleted ? 'bg-gradient-to-r from-green-500 to-green-600' :
                            isInProgress ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                            'bg-gradient-to-r from-gray-400 to-gray-500'
                          }`}
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
                        {(() => {
                          const stageTypeMap: Record<string, string> = {
                            'DESIGN': 'DESIGN_CONCEPT',
                            'DESIGN_CONCEPT': 'DESIGN_CONCEPT',
                            'THREE_D': 'THREE_D',
                            'CLIENT_APPROVAL': 'CLIENT_APPROVAL',
                            'DRAWINGS': 'DRAWINGS',
                            'FFE': 'FFE'
                          }
                          
                          const phaseIds = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
                          
                          return phaseIds.map((phaseId, index) => {
                            // For DESIGN_CONCEPT phase, check if either DESIGN or DESIGN_CONCEPT is completed/in_progress
                            let matchingStage = null
                            if (phaseId === 'DESIGN_CONCEPT') {
                              // Find the most advanced of DESIGN or DESIGN_CONCEPT stages
                              const designStage = room.stages.find((stage: any) => stage.type === 'DESIGN')
                              const designConceptStage = room.stages.find((stage: any) => stage.type === 'DESIGN_CONCEPT')
                              
                              // Prefer DESIGN_CONCEPT if it exists, otherwise use DESIGN
                              matchingStage = designConceptStage || designStage
                            } else {
                              matchingStage = room.stages.find((stage: any) => stage.type === phaseId)
                            }
                            
                            // Get the correct icon for each phase
                            const phaseIcons: Record<string, string> = {
                              'DESIGN_CONCEPT': '🎨',
                              'THREE_D': '🎥',
                              'CLIENT_APPROVAL': '👥',
                              'DRAWINGS': '📜',
                              'FFE': '🛋️'
                            }
                            
                            return (
                              <div key={phaseId} className="text-center">
                                <div className="text-xs mb-2">{phaseIcons[phaseId]}</div>
                                <div className="flex justify-center">
                                  <div 
                                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                                      matchingStage?.status === 'COMPLETED' ? 'bg-green-500' :
                                      matchingStage?.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                                      matchingStage?.status === 'NOT_APPLICABLE' ? 'bg-slate-400' :
                                      'bg-gray-300'
                                    }`}
                                  />
                                </div>
                              </div>
                            )
                          })
                        })()}
                      </div>
                      
                      {/* Stage Summary */}
                      <div className="flex justify-between text-xs text-gray-600">
                        {(() => {
                          const phaseIds = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
                          
                          let completed = 0
                          let active = 0
                          let pending = 0
                          let notApplicable = 0
                          
                          phaseIds.forEach(phaseId => {
                            let matchingStage = null
                            
                            if (phaseId === 'DESIGN_CONCEPT') {
                              // For DESIGN_CONCEPT phase, check both DESIGN and DESIGN_CONCEPT stages
                              const designStage = room.stages.find((stage: any) => stage.type === 'DESIGN')
                              const designConceptStage = room.stages.find((stage: any) => stage.type === 'DESIGN_CONCEPT')
                              
                              // Use the most advanced status between the two
                              if (designConceptStage?.status === 'COMPLETED' || designStage?.status === 'COMPLETED') {
                                matchingStage = { status: 'COMPLETED' }
                              } else if (designConceptStage?.status === 'IN_PROGRESS' || designStage?.status === 'IN_PROGRESS') {
                                matchingStage = { status: 'IN_PROGRESS' }
                              } else {
                                matchingStage = { status: 'NOT_STARTED' }
                              }
                            } else {
                              matchingStage = room.stages.find((stage: any) => stage.type === phaseId)
                            }
                            
                            if (matchingStage?.status === 'NOT_APPLICABLE') {
                              notApplicable++
                            } else if (matchingStage?.status === 'COMPLETED') {
                              completed++
                            } else if (matchingStage?.status === 'IN_PROGRESS') {
                              active++
                            } else {
                              pending++
                            }
                          })
                          
                          return (
                            <>
                              <span>{completed} completed</span>
                              <span>{active} active</span>
                              <span>{pending} pending</span>
                              <span>{notApplicable} n/a</span>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
