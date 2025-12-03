import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { autoUpdateProjectStatus } from '@/lib/utils/project-status-updater'

export const dynamic = 'force-dynamic'

interface TaskDetail {
  id: string
  roomId: string
  roomName: string
  roomType: string
  stageName: string
  stageType: string
  status: string
  updatedAt: string
  ffeItems?: {
    id: string
    name: string
    status: string
    vendor?: string | null
    cost?: number
    notes?: string | null
  }[]
}

interface PhaseStats {
  completed: number
  inProgress: number
  pending: number
  notApplicable: number
  total: number
  percentage: number
  rooms: {
    roomId: string
    roomName: string
    roomType: string
    status: string
  }[]
  tasks: TaskDetail[]
}

interface ProjectReport {
  id: string
  name: string
  clientName: string
  status: string
  overallCompletion: number
  phases: Record<string, PhaseStats>
  roomCount: number
  updatedAt: string
  coverImage: string | null
}

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    // Fetch all projects with rooms, stages, and FFE v2 workspace
    const projects = await prisma.project.findMany({
      where: {
        orgId: session.user.orgId,
        ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter as any } : {})
      },
      include: {
        client: true,
        rooms: {
          include: {
            stages: true,
            ffeInstance: {
              include: {
                sections: {
                  include: {
                    items: {
                      where: {
                        visibility: 'VISIBLE'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Auto-update project statuses based on phase progress (fixes existing drafts)
    await Promise.all(
      projects.map(project => autoUpdateProjectStatus(project.id))
    )
    
    // Refetch projects to get updated statuses
    const updatedProjects = await prisma.project.findMany({
      where: {
        orgId: session.user.orgId,
        ...(statusFilter && statusFilter !== 'all' ? { status: statusFilter as any } : {})
      },
      include: {
        client: true,
        rooms: {
          include: {
            stages: true,
            ffeInstance: {
              include: {
                sections: {
                  include: {
                    items: {
                      where: {
                        visibility: 'VISIBLE'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })
    
    // Process each project to calculate phase statistics
    const projectReports: ProjectReport[] = updatedProjects.map(project => {
      const phases = {
        DESIGN_CONCEPT: { completed: 0, inProgress: 0, pending: 0, notApplicable: 0, total: 0, percentage: 0, rooms: [] as any[], tasks: [] as TaskDetail[] },
        THREE_D: { completed: 0, inProgress: 0, pending: 0, notApplicable: 0, total: 0, percentage: 0, rooms: [] as any[], tasks: [] as TaskDetail[] },
        DRAWINGS: { completed: 0, inProgress: 0, pending: 0, notApplicable: 0, total: 0, percentage: 0, rooms: [] as any[], tasks: [] as TaskDetail[] },
        FFE: { completed: 0, inProgress: 0, pending: 0, notApplicable: 0, total: 0, percentage: 0, rooms: [] as any[], tasks: [] as TaskDetail[] }
      }

      let totalStages = 0
      let completedStages = 0
      let inProgressStages = 0

      // Aggregate stage statistics
      project.rooms.forEach(room => {
        room.stages.forEach(stage => {
          // Skip CLIENT_APPROVAL completely
          if (stage.type === 'CLIENT_APPROVAL') return
          
          const phaseKey = stage.type as keyof typeof phases
          if (phases[phaseKey]) {
            phases[phaseKey].total++
            totalStages++
            
            let roomStatus = 'pending'

            // Special handling for FFE - use v2 workspace items
            if (stage.type === 'FFE') {
              // Get all FFE items from v2 workspace
              const allFfeItems: any[] = []
              if (room.ffeInstance?.sections) {
                room.ffeInstance.sections.forEach(section => {
                  if (section.items) {
                    allFfeItems.push(...section.items)
                  }
                })
              }
              
              if (allFfeItems.length > 0) {
                // Count items by state (v2 uses 'state' field)
                const completedItems = allFfeItems.filter(item => 
                  item.state === 'ORDERED' || item.state === 'DELIVERED' || item.state === 'COMPLETED'
                ).length
                
                const inProgressItems = allFfeItems.filter(item =>
                  item.state === 'IN_PROGRESS'
                ).length
                
                const totalItems = allFfeItems.length
                
                if (completedItems === totalItems) {
                  phases[phaseKey].completed++
                  completedStages++
                  roomStatus = 'completed'
                } else if (completedItems > 0 || inProgressItems > 0) {
                  phases[phaseKey].inProgress++
                  inProgressStages++
                  roomStatus = 'in_progress'
                } else {
                  phases[phaseKey].pending++
                  roomStatus = 'pending'
                }
              } else if (stage.status === 'NOT_APPLICABLE') {
                phases[phaseKey].notApplicable++
                roomStatus = 'not_applicable'
              } else {
                // No FFE items - use stage status
                switch (stage.status) {
                  case 'COMPLETED':
                    phases[phaseKey].completed++
                    completedStages++
                    roomStatus = 'completed'
                    break
                  case 'IN_PROGRESS':
                    phases[phaseKey].inProgress++
                    inProgressStages++
                    roomStatus = 'in_progress'
                    break
                  default:
                    phases[phaseKey].pending++
                    roomStatus = 'pending'
                }
              }
            } else {
              // For non-FFE phases, use stage status
              switch (stage.status) {
                case 'COMPLETED':
                  phases[phaseKey].completed++
                  completedStages++
                  roomStatus = 'completed'
                  break
                case 'IN_PROGRESS':
                  phases[phaseKey].inProgress++
                  inProgressStages++
                  roomStatus = 'in_progress'
                  break
                case 'NOT_APPLICABLE':
                  phases[phaseKey].notApplicable++
                  roomStatus = 'not_applicable'
                  break
                default:
                  phases[phaseKey].pending++
                  roomStatus = 'pending'
              }
            }
            
            // Add room to phase tracking
            phases[phaseKey].rooms.push({
              roomId: room.id,
              roomName: room.name || room.type,
              roomType: room.type,
              status: roomStatus
            })
            
            // Add task details
            const taskDetail: TaskDetail = {
              id: stage.id,
              roomId: room.id,
              roomName: room.name || room.type,
              roomType: room.type,
              stageName: stage.type,
              stageType: stage.type,
              status: stage.status,
              updatedAt: stage.updatedAt.toISOString()
            }
            
            // Add FFE items if this is an FFE stage (from v2 workspace)
            if (stage.type === 'FFE' && room.ffeInstance?.sections) {
              const ffeItemsList: any[] = []
              room.ffeInstance.sections.forEach(section => {
                if (section.items) {
                  section.items.forEach(item => {
                    ffeItemsList.push({
                      id: item.id,
                      name: item.name,
                      status: item.state, // v2 uses 'state' not 'status'
                      vendor: item.vendor || null,
                      cost: item.cost ? Number(item.cost) : undefined,
                      notes: item.notes
                    })
                  })
                }
              })
              
              if (ffeItemsList.length > 0) {
                taskDetail.ffeItems = ffeItemsList
              }
            }
            
            phases[phaseKey].tasks.push(taskDetail)
          }
        })
      })

      // Calculate percentages for each phase
      Object.keys(phases).forEach(phaseKey => {
        const phase = phases[phaseKey as keyof typeof phases]
        if (phase.total > 0) {
          // Calculate completion percentage (excluding not applicable)
          const applicableTotal = phase.total - phase.notApplicable
          phase.percentage = applicableTotal > 0 
            ? Math.round((phase.completed / applicableTotal) * 100)
            : 0
        }
      })

      // Calculate overall completion percentage
      const applicableStages = totalStages - Object.values(phases).reduce((sum, p) => sum + p.notApplicable, 0)
      const overallCompletion = applicableStages > 0
        ? Math.round((completedStages / applicableStages) * 100)
        : 0

      // Get first cover image if available
      const coverImages = project.coverImages as string[] | null
      const coverImage = coverImages && coverImages.length > 0 ? coverImages[0] : null

      return {
        id: project.id,
        name: project.name,
        clientName: project.client.name,
        status: project.status,
        overallCompletion,
        phases,
        roomCount: project.rooms.length,
        updatedAt: project.updatedAt.toISOString(),
        coverImage
      }
    })

    // Calculate summary statistics
    const summary = {
      totalProjects: projects.length,
      totalRooms: projects.reduce((sum, p) => sum + p.rooms.length, 0),
      totalStages: projects.reduce((sum, p) => {
        return sum + p.rooms.reduce((rSum, r) => rSum + r.stages.length, 0)
      }, 0),
      overallCompletion: projectReports.length > 0
        ? Math.round(projectReports.reduce((sum, p) => sum + p.overallCompletion, 0) / projectReports.length)
        : 0,
      phaseDistribution: {
        pending: 0,
        inProgress: 0,
        completed: 0,
        notApplicable: 0
      }
    }

    // Calculate overall phase distribution
    projectReports.forEach(project => {
      Object.values(project.phases).forEach(phase => {
        summary.phaseDistribution.pending += phase.pending
        summary.phaseDistribution.inProgress += phase.inProgress
        summary.phaseDistribution.completed += phase.completed
        summary.phaseDistribution.notApplicable += phase.notApplicable
      })
    })

    return NextResponse.json({
      projects: projectReports,
      summary
    })

  } catch (error) {
    console.error('[Reports API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reports data' },
      { status: 500 }
    )
  }
}
