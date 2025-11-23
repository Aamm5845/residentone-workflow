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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = await params

    // Fetch single project with all details
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
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
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    
    // Auto-update project status based on phase progress
    await autoUpdateProjectStatus(projectId)
    
    // Refetch project to get updated status
    const updatedProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        orgId: session.user.orgId
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
      }
    })
    
    if (!updatedProject) {
      return NextResponse.json({ error: 'Project not found after update' }, { status: 404 })
    }

    // Process project to calculate phase statistics
    const phases: Record<string, PhaseStats> = {
      DESIGN_CONCEPT: { completed: 0, inProgress: 0, pending: 0, notApplicable: 0, total: 0, percentage: 0, rooms: [], tasks: [] },
      THREE_D: { completed: 0, inProgress: 0, pending: 0, notApplicable: 0, total: 0, percentage: 0, rooms: [], tasks: [] },
      DRAWINGS: { completed: 0, inProgress: 0, pending: 0, notApplicable: 0, total: 0, percentage: 0, rooms: [], tasks: [] },
      FFE: { completed: 0, inProgress: 0, pending: 0, notApplicable: 0, total: 0, percentage: 0, rooms: [], tasks: [] }
    }

    let totalStages = 0
    let completedStages = 0
    let inProgressStages = 0

    // Aggregate stage statistics
    updatedProject.rooms.forEach(room => {
      room.stages.forEach(stage => {
        // Skip CLIENT_APPROVAL completely
        if (stage.type === 'CLIENT_APPROVAL') return
        
        const phaseKey = stage.type as keyof typeof phases
        if (phases[phaseKey]) {
          phases[phaseKey].total++
          totalStages++
          
          let roomStatus = 'pending'

          // Special handling for FFE - use v2 workspace
          if (stage.type === 'FFE') {
            // Get all FFE items from v2 workspace
            const allFfeItems: any[] = []
            if (room.ffeInstance?.sections) {
              room.ffeInstance.sections.forEach((section: any) => {
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
            // For non-FFE phases
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
            room.ffeInstance.sections.forEach((section: any) => {
              if (section.items) {
                section.items.forEach((item: any) => {
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
        const applicableTotal = phase.total - phase.notApplicable
        phase.percentage = applicableTotal > 0 
          ? Math.round((phase.completed / applicableTotal) * 100)
          : 0
      }
    })

    // Calculate overall completion
    const applicableStages = totalStages - Object.values(phases).reduce((sum, p) => sum + p.notApplicable, 0)
    const overallCompletion = applicableStages > 0
      ? Math.round((completedStages / applicableStages) * 100)
      : 0

    const projectReport = {
      id: updatedProject.id,
      name: updatedProject.name,
      clientName: updatedProject.client.name,
      status: updatedProject.status,
      overallCompletion,
      phases,
      roomCount: updatedProject.rooms.length,
      updatedAt: updatedProject.updatedAt.toISOString()
    }

    return NextResponse.json({ project: projectReport })

  } catch (error) {
    console.error('[Project Report API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project report' },
      { status: 500 }
    )
  }
}
