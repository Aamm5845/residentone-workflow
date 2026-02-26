import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { ArrowLeft, ArrowUpRight, Plus, Settings, MoreVertical, Users, Calendar, MapPin, Sofa, Bed, UtensilsCrossed, Bath, Briefcase, Gamepad2, DoorOpen, Home, Navigation, FileText, BookOpen, ClipboardList, ShoppingCart, FolderOpen, DollarSign, CheckSquare } from 'lucide-react'
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
        orgId: true,
        hasFloorplanApproval: true,
        hasSpecBook: true,
        hasProjectUpdates: true,
        hasBillingProcurement: true,
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

  // Auto-fix orgId if it doesn't match the current user's org
  if (session.user.orgId && project.orgId !== session.user.orgId) {
    try {
      await prisma.project.update({
        where: { id: project.id },
        data: { orgId: session.user.orgId }
      })
    } catch {}
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

  const features = [
    { key: 'floorplan', label: 'Floorplan', description: 'Manage floorplan drawings and client approvals', href: `/projects/${project.id}/floorplan`, icon: FileText, visible: project.hasFloorplanApproval, color: '#14b8a6' },
    { key: 'specs', label: 'All Specs', description: 'View and manage all product specs', href: `/projects/${project.id}/specs/all`, icon: BookOpen, visible: project.hasSpecBook, color: '#a657f0' },
    { key: 'procurement', label: 'Procurement', description: 'Quotes, orders, and deliveries', href: `/projects/${project.id}/procurement`, icon: ShoppingCart, visible: project.hasBillingProcurement, color: '#f6762e' },
    { key: 'files', label: 'Project Files', description: 'Documents, plans, and reference files', href: `/projects/${project.id}/floorplan/sources`, icon: FolderOpen, visible: true, color: '#0ea5e9' },
    { key: 'tasks', label: 'Tasks', description: 'Manage and assign team tasks', href: `/projects/${project.id}/tasks`, icon: CheckSquare, visible: true, color: '#e94d97' },
    { key: 'updates', label: 'Project Updates', description: 'Manage onsite visits and revisions', href: `/projects/${project.id}/project-updates`, icon: ClipboardList, visible: true, color: '#6366ea' },
    { key: 'billing', label: 'Billing', description: 'Proposals & Invoices', href: `/projects/${project.id}/billing`, icon: DollarSign, visible: canSeeBilling && project.hasBillingProcurement, color: '#22c55e' },
  ]
  const visibleFeatures = features.filter(f => f.visible)

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

        {/* Project Features Section */}
        <div className="border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center gap-4 mb-5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Project Features</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleFeatures.map((feature) => {
                const Icon = feature.icon
                return (
                  <Link key={feature.key} href={feature.href} className="group block">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${feature.color}15` }}
                        >
                          <Icon className="w-[18px] h-[18px]" style={{ color: feature.color }} />
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-gray-200 group-hover:text-gray-400 transition-colors duration-200" />
                      </div>
                      <h3 className="font-medium text-gray-900 text-[13px] leading-tight">{feature.label}</h3>
                      <p className="text-[11px] text-gray-400 mt-1 leading-snug line-clamp-2">{feature.description}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        {/* Modern Rooms Section */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Rooms</span>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[12px] text-gray-400">{project.rooms.length} room{project.rooms.length !== 1 ? 's' : ''}</span>
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
                  <div className={`rounded-xl border p-5 hover:shadow-lg transition-all duration-200 group-hover:scale-[1.01] ${getRoomCardStyle()}`}>
                    {/* Room Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className={`w-11 h-11 ${roomIconData.color} rounded-xl flex items-center justify-center shadow-sm`}>
                          <IconComponent className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className={`text-[15px] font-semibold transition-colors leading-tight ${
                            isCompleted ? 'text-green-800 group-hover:text-green-900' :
                            isInProgress ? 'text-blue-800 group-hover:text-blue-900' :
                            'text-gray-900 group-hover:text-purple-600'
                          }`}>
                            {room.name || formatRoomType(room.type)}
                          </h3>
                          <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{currentPhase.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[18px] font-bold text-gray-900 leading-none">{roomProgress}%</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 font-medium">Complete</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="w-full bg-gray-200/60 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            isCompleted ? 'bg-gradient-to-r from-green-500 to-green-600' :
                            isInProgress ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                            'bg-gradient-to-r from-gray-400 to-gray-500'
                          }`}
                          style={{ width: `${roomProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Stages Overview */}
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                        Stages
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
                      <div className="flex justify-between text-[11px] text-gray-400 font-medium pt-1">
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
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-[14px] font-semibold text-gray-800">{section.name}</h3>
                        <span className="text-[11px] text-gray-400 font-medium">{sectionRooms.length} room{sectionRooms.length !== 1 ? 's' : ''}</span>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sectionRooms.map(renderRoomCard)}
                      </div>
                    </div>
                  )
                })}
                
                {/* Render unassigned rooms */}
                {unassignedRooms.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-[14px] font-semibold text-gray-800">
                        {roomSections.length > 0 ? 'Unassigned Rooms' : 'All Rooms'}
                      </h3>
                      <span className="text-[11px] text-gray-400 font-medium">{unassignedRooms.length} room{unassignedRooms.length !== 1 ? 's' : ''}</span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
