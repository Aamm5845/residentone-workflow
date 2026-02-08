import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ArrowLeft, Plus, Settings, MoreVertical, Users, Calendar, MapPin, Sofa, Bed, UtensilsCrossed, Bath, Briefcase, Gamepad2, DoorOpen, Home, Navigation, FileText, BookOpen, ClipboardList, ShoppingCart, FolderOpen, DollarSign } from 'lucide-react'
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

  // Check if user can see billing
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, canSeeBilling: true },
  })
  const canSeeBilling = currentUser?.role === 'OWNER' || currentUser?.canSeeBilling === true

  // Fetch project with rooms and stages
  let project: any = null
  
  try {
    project = await prisma.project.findFirst({
      where: { 
        id: id
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        status: true,
        dueDate: true,
        budget: true,
        createdAt: true,
        updatedAt: true,
        hasFloorplanApproval: true,
        hasSpecBook: true,
        hasProjectUpdates: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        roomSections: {
          select: {
            id: true,
            name: true,
            order: true
          },
          orderBy: {
            order: 'asc'
          }
        },
        rooms: {
          select: {
            id: true,
            type: true,
            name: true,
            status: true,
            createdAt: true,
            sectionId: true,
            order: true,
            stages: {
              select: {
                id: true,
                type: true,
                status: true,
                assignedTo: true,
                dueDate: true,
                assignedUser: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                },
                designSections: {
                  select: {
                    id: true,
                    type: true
                  }
                }
              }
            },
            // Only count assets instead of fetching full data
            _count: {
              select: {
                assets: true,
                ffeItems: true
              }
            }
          },
          orderBy: [
            { sectionId: 'asc' },
            { order: 'asc' }
          ]
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

  // Calculate overall project progress (excluding NOT_APPLICABLE phases)
  // Use the same 5-phase logic as room calculations for consistency
  const phaseIds = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
  
  let totalApplicablePhases = 0
  let completedPhases = 0
  
  project.rooms.forEach((room: any) => {
    phaseIds.forEach(phaseId => {
      let matchingStage = null
      
      if (phaseId === 'DESIGN_CONCEPT') {
        // For DESIGN_CONCEPT, check both DESIGN and DESIGN_CONCEPT stages
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
  })
  
  const overallProgress = totalApplicablePhases > 0 ? Math.round((completedPhases / totalApplicablePhases) * 100) : 0

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
                    Project Information
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
                  className="bg-[#a657f0] h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Project Features Section - Always show since Project Files is always available */}
        {(true || project.hasFloorplanApproval || project.hasSpecBook || project.hasProjectUpdates) && (
          <div className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-6 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Project Features</h2>
                  <p className="text-gray-600 text-sm mt-1">Manage project-level workflows and approvals</p>
                </div>
              </div>
              
              <div className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Floorplan Card */}
                  {project.hasFloorplanApproval && (
                    <Link
                      href={`/projects/${project.id}/floorplan`}
                      className="group block"
                    >
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 hover:border-blue-300 rounded-xl p-6 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                              <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-blue-800 group-hover:text-blue-900 transition-colors">
                                Floorplan
                              </h3>
                              <p className="text-xs text-blue-600 mt-1">
                                Manage floorplan drawings and client approvals
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                  
                  {/* Specs Card - Goes directly to All Specs */}
                  {project.hasSpecBook && (
                    <Link
                      href={`/projects/${project.id}/specs/all`}
                      className="group block"
                    >
                      <div className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 hover:border-green-300 rounded-xl p-6 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center shadow-sm">
                              <BookOpen className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-green-800 group-hover:text-green-900 transition-colors">
                                All Specs
                              </h3>
                              <p className="text-xs text-green-600 mt-1">
                                View and manage all product specs
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {/* Procurement Card */}
                  {project.hasSpecBook && (
                    <Link
                      href={`/projects/${project.id}/procurement`}
                      className="group block"
                    >
                      <div className="bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200 hover:border-amber-300 rounded-xl p-6 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center shadow-sm">
                              <ShoppingCart className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-amber-800 group-hover:text-amber-900 transition-colors">
                                Procurement
                              </h3>
                              <p className="text-xs text-amber-600 mt-1">
                                Quotes, orders, and deliveries
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {/* Project Files Card */}
                  <Link
                    href={`/projects/${project.id}/floorplan/sources`}
                    className="group block"
                  >
                    <div className="bg-gradient-to-br from-cyan-50 to-teal-100 border border-cyan-200 hover:border-cyan-300 rounded-xl p-6 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center shadow-sm">
                            <FolderOpen className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-cyan-800 group-hover:text-cyan-900 transition-colors">
                              Project Files
                            </h3>
                            <p className="text-xs text-cyan-600 mt-1">
                              Documents, plans, and reference files
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Project Updates Card */}
                  {project.hasProjectUpdates && (
                    <Link
                      href={`/projects/${project.id}/project-updates`}
                      className="group block"
                    >
                      <div className="bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200 hover:border-purple-300 rounded-xl p-6 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center shadow-sm">
                              <ClipboardList className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-purple-800 group-hover:text-purple-900 transition-colors">
                                Project Updates
                              </h3>
                              <p className="text-xs text-purple-600 mt-1">
                                Manage onsite visits and revisions
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}

                  {/* Billing Card - Only visible to users with billing permission */}
                  {canSeeBilling && (
                    <Link
                      href={`/projects/${project.id}/billing`}
                      className="group block"
                    >
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200 hover:border-emerald-300 rounded-xl p-6 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.02]">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                              <DollarSign className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-emerald-800 group-hover:text-emerald-900 transition-colors">
                                Billing
                              </h3>
                              <p className="text-xs text-emerald-600 mt-1">
                                Proposals & Invoices
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modern Rooms Section */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Rooms</h2>
              <p className="text-gray-600 mt-1">Manage and track progress for all project rooms</p>
            </div>
          </div>
          
          {/* Room Cards Organized by Sections */}
          {(() => {
            const roomSections = project.roomSections || []
            const allRooms = project.rooms
            
            // Group rooms by section
            const roomsBySection: Record<string, any[]> = {}
            const unassignedRooms: any[] = []
            
            allRooms.forEach((room: any) => {
              if (room.sectionId) {
                if (!roomsBySection[room.sectionId]) {
                  roomsBySection[room.sectionId] = []
                }
                roomsBySection[room.sectionId].push(room)
              } else {
                unassignedRooms.push(room)
              }
            })
            
            // Function to render room card
            const renderRoomCard = (room: any) => {
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
                      <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Workflow Stages
                      </div>
                      <div className="grid grid-cols-5 gap-3">
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
                          
                          // Phase names for labels
                          const phaseLabels: Record<string, string> = {
                            'DESIGN_CONCEPT': 'Design',
                            'THREE_D': '3D',
                            'CLIENT_APPROVAL': 'Approval',
                            'DRAWINGS': 'Drawings',
                            'FFE': 'FFE'
                          }
                          
                          // Phase colors matching the brand
                          const phaseColors: Record<string, { bg: string, border: string, text: string }> = {
                            'DESIGN_CONCEPT': { bg: 'bg-[#a657f0]/20', border: 'border-[#a657f0]', text: 'text-[#a657f0]' },
                            'THREE_D': { bg: 'bg-[#f6762e]/20', border: 'border-[#f6762e]', text: 'text-[#f6762e]' },
                            'CLIENT_APPROVAL': { bg: 'bg-[#14b8a6]/20', border: 'border-[#14b8a6]', text: 'text-[#14b8a6]' },
                            'DRAWINGS': { bg: 'bg-[#6366ea]/20', border: 'border-[#6366ea]', text: 'text-[#6366ea]' },
                            'FFE': { bg: 'bg-[#e94d97]/20', border: 'border-[#e94d97]', text: 'text-[#e94d97]' },
                          }
                          
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
                            
                            // Hide phase completely if it's marked as NOT_APPLICABLE, but keep the grid position
                            if (matchingStage?.status === 'NOT_APPLICABLE') {
                              return (
                                <div key={phaseId} className="flex flex-col items-center">
                                  {/* Empty space to maintain grid layout */}
                                </div>
                              )
                            }
                            
                            const isCompleted = matchingStage?.status === 'COMPLETED'
                            const isInProgress = matchingStage?.status === 'IN_PROGRESS'
                            const isPending = !isCompleted && !isInProgress
                            const colors = phaseColors[phaseId]
                            
                            return (
                              <div key={phaseId} className="flex flex-col items-center space-y-2">
                                {/* Status Indicator - Modern Design */}
                                <div className="relative">
                                  <div 
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                                      isCompleted 
                                        ? 'bg-emerald-100 border-2 border-emerald-300' 
                                        : isInProgress 
                                        ? `${colors.bg} border-2 ${colors.border}` 
                                        : 'bg-gray-100 border-2 border-gray-300'
                                    }`}
                                  >
                                    {isCompleted && (
                                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                    {isInProgress && (
                                      <svg className={`w-5 h-5 ${colors.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    )}
                                  </div>
                                  {/* Connection Line */}
                                  {index < phaseIds.length - 1 && (
                                    <div 
                                      className={`absolute top-5 left-10 w-full h-0.5 transition-all duration-300 ${
                                        isCompleted ? 'bg-emerald-300' : 'bg-gray-300'
                                      }`}
                                      style={{ width: 'calc(100% + 0.75rem)' }}
                                    />
                                  )}
                                </div>
                                
                                {/* Phase Label */}
                                <div className={`text-[10px] font-medium text-center leading-tight ${
                                  isCompleted ? 'text-emerald-700' : 
                                  isInProgress ? colors.text : 
                                  'text-gray-500'
                                }`}>
                                  {phaseLabels[phaseId]}
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
                          
                          // Only show applicable phases in the summary
                          const applicablePhases = completed + active + pending
                          
                          return (
                            <>
                              {completed > 0 && <span>{completed} completed</span>}
                              {active > 0 && <span>{active} active</span>}
                              {pending > 0 && <span>{pending} pending</span>}
                              {applicablePhases === 0 && <span>No applicable phases</span>}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            }
            
            return (
              <div className="space-y-8">
                {/* Render sections */}
                {roomSections.map((section: any) => {
                  const sectionRooms = roomsBySection[section.id] || []
                  
                  if (sectionRooms.length === 0) return null
                  
                  return (
                    <div key={section.id}>
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">{section.name}</h3>
                        <p className="text-sm text-gray-500">{sectionRooms.length} room{sectionRooms.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sectionRooms.map(renderRoomCard)}
                      </div>
                    </div>
                  )
                })}
                
                {/* Render unassigned rooms */}
                {unassignedRooms.length > 0 && (
                  <div>
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {roomSections.length > 0 ? 'Unassigned Rooms' : 'All Rooms'}
                      </h3>
                      <p className="text-sm text-gray-500">{unassignedRooms.length} room{unassignedRooms.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {unassignedRooms.map(renderRoomCard)}
                    </div>
                  </div>
                )}
                
                {/* No rooms message */}
                {allRooms.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Home className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No rooms in this project yet.</p>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </DashboardLayout>
  )
}
