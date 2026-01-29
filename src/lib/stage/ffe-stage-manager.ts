import { prisma } from '@/lib/prisma'
import { getRoomFFEConfig } from '@/lib/constants/room-ffe-config'
import { validateFFECompletion } from '@/lib/ffe/completion-validator'

export interface FFEStageStatus {
  stageId: string
  roomId: string
  roomType: string
  isComplete: boolean
  isReadyForCompletion: boolean
  completionPercentage: number
  itemsTotal: number
  itemsCompleted: number
  requiredItemsTotal: number
  requiredItemsCompleted: number
  estimatedBudget: number
  committedBudget: number
  longestLeadTime: number
  lastUpdated: Date
}

/**
 * Gets comprehensive FFE stage status for a room
 */
export async function getFFEStageStatus(stageId: string): Promise<FFEStageStatus | null> {
  try {
    // Get stage and room information
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        room: {
          select: {
            id: true,
            type: true,
            name: true
          }
        }
      }
    })

    if (!stage || stage.type !== 'FFE') {
      return null
    }

    // Get FFE item statuses for this room (only need updatedAt for lastUpdated calculation)
    const ffeItemStatuses = await prisma.fFEItemStatus.findMany({
      where: { roomId: stage.roomId },
      select: {
        updatedAt: true
      }
    })

    // Validate completion
    const validation = await validateFFECompletion(stage.roomId)
    
    // Get room configuration for additional info
    const roomConfig = getRoomFFEConfig(stage.room.type)
    
    const lastUpdated = ffeItemStatuses.length > 0 
      ? new Date(Math.max(...ffeItemStatuses.map(s => s.updatedAt.getTime())))
      : new Date()

    return {
      stageId,
      roomId: stage.roomId,
      roomType: stage.room.type,
      isComplete: validation.isComplete,
      isReadyForCompletion: validation.isComplete,
      completionPercentage: validation.completionPercentage,
      itemsTotal: validation.totalItems,
      itemsCompleted: validation.confirmedItems + validation.notNeededItems,
      requiredItemsTotal: validation.totalItems - validation.notNeededItems,
      requiredItemsCompleted: validation.confirmedItems,
      estimatedBudget: 0,
      committedBudget: 0,
      longestLeadTime: 0,
      lastUpdated
    }

  } catch (error) {
    console.error('Error getting FFE stage status:', error)
    return null
  }
}

/**
 * Attempts to complete an FFE stage with validation
 */
export async function completeFFEStage(
  stageId: string, 
  userId: string,
  forceComplete = false
): Promise<{
  success: boolean
  stage?: any
  validation?: any
  errors?: string[]
  warnings?: string[]
}> {
  try {
    // Get stage information
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        room: {
          select: {
            id: true,
            type: true,
            name: true,
            projectId: true
          }
        }
      }
    })

    if (!stage || stage.type !== 'FFE') {
      return {
        success: false,
        errors: ['Stage not found or is not an FFE stage']
      }
    }

    if (stage.status === 'COMPLETED') {
      return {
        success: false,
        errors: ['Stage is already completed']
      }
    }

    // Validate FFE completion
    const validation = await validateFFECompletion(stage.roomId)

    // Check if completion is allowed
    if (!forceComplete && !validation.isComplete) {
      // If force complete is allowed, return warnings. Otherwise return as errors.
      if (validation.canForceComplete) {
        return {
          success: false,
          validation: {
            isComplete: validation.isComplete,
            isReadyForCompletion: validation.isComplete,
            completionPercentage: validation.completionPercentage,
            requiredItems: { total: validation.totalItems, completed: validation.confirmedItems },
            optionalItems: { total: 0, completed: 0 },
            estimatedBudget: { total: 0, committed: 0 },
            timeline: { longestLeadTime: 0 }
          },
          errors: [],
          warnings: validation.issues
        }
      }

      return {
        success: false,
        validation: {
          isComplete: validation.isComplete,
          isReadyForCompletion: validation.isComplete,
          completionPercentage: validation.completionPercentage,
          requiredItems: { total: validation.totalItems, completed: validation.confirmedItems },
          optionalItems: { total: 0, completed: 0 },
          estimatedBudget: { total: 0, committed: 0 },
          timeline: { longestLeadTime: 0 }
        },
        errors: validation.issues,
        warnings: []
      }
    }

    // Proceed with completion
    const completedStage = await prisma.stage.update({
      where: { id: stageId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedById: userId,
        updatedById: userId,
        updatedAt: new Date()
      },
      include: {
        room: {
          select: {
            id: true,
            type: true,
            name: true,
            projectId: true
          }
        }
      }
    })

    // Update room progress
    await updateRoomProgress(stage.roomId)

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'STAGE_COMPLETED',
        description: `FFE stage completed for ${stage.room.name || stage.room.type}${forceComplete ? ' (force completed)' : ''}`,
        metadata: {
          stageId,
          roomId: stage.roomId,
          roomType: stage.room.type,
          forceComplete,
          completionPercentage: ffeStatus.completionPercentage,
          itemsCompleted: ffeStatus.itemsCompleted,
          requiredItemsCompleted: ffeStatus.requiredItemsCompleted,
          issues: validation.issues.length,
          estimatedBudget: ffeStatus.estimatedBudget,
          committedBudget: ffeStatus.committedBudget
        },
        userId,
        projectId: stage.room.projectId
      }
    })

    // Check if this completes the entire room
    await checkRoomCompletion(stage.roomId, userId)

    return {
      success: true,
      stage: completedStage,
      validation,
      warnings: forceComplete ? ['Stage was force completed with incomplete items'] : []
    }

  } catch (error) {
    console.error('Error completing FFE stage:', error)
    return {
      success: false,
      errors: ['Internal error completing FFE stage']
    }
  }
}

/**
 * Resets an FFE stage and clears completion status
 */
export async function resetFFEStage(
  stageId: string,
  userId: string,
  clearItems = false
): Promise<{ success: boolean; stage?: any; errors?: string[] }> {
  try {
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        room: {
          select: {
            id: true,
            type: true,
            name: true,
            projectId: true
          }
        }
      }
    })

    if (!stage || stage.type !== 'FFE') {
      return {
        success: false,
        errors: ['Stage not found or is not an FFE stage']
      }
    }

    // Reset stage status
    const updatedStage = await prisma.stage.update({
      where: { id: stageId },
      data: {
        status: 'NOT_STARTED',
        completedAt: null,
        completedById: null,
        updatedById: userId,
        updatedAt: new Date()
      }
    })

    // Optionally clear FFE item statuses
    if (clearItems) {
      await prisma.fFEItemStatus.deleteMany({
        where: { roomId: stage.roomId }
      })
    }

    // Update room progress
    await updateRoomProgress(stage.roomId)

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'STAGE_RESET',
        description: `FFE stage reset for ${stage.room.name || stage.room.type}${clearItems ? ' (items cleared)' : ''}`,
        metadata: {
          stageId,
          roomId: stage.roomId,
          roomType: stage.room.type,
          clearItems
        },
        userId,
        projectId: stage.room.projectId
      }
    })

    return {
      success: true,
      stage: updatedStage
    }

  } catch (error) {
    console.error('Error resetting FFE stage:', error)
    return {
      success: false,
      errors: ['Internal error resetting FFE stage']
    }
  }
}

/**
 * Updates room progress based on all stage completions
 */
async function updateRoomProgress(roomId: string): Promise<void> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        stages: {
          select: {
            type: true,
            status: true
          }
        }
      }
    })

    if (!room) return

    // Calculate progress based on workflow stages
    const workflowStages = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
    const applicableStages = room.stages.filter(stage => 
      workflowStages.includes(stage.type) && stage.status !== 'NOT_APPLICABLE'
    )
    
    if (applicableStages.length === 0) return

    const completedStages = applicableStages.filter(stage => 
      stage.status === 'COMPLETED'
    ).length

    const progressPercentage = Math.round((completedStages / applicableStages.length) * 100)
    
    // Determine room status
    let roomStatus = 'NOT_STARTED'
    if (progressPercentage === 100) {
      roomStatus = 'COMPLETED'
    } else if (progressPercentage > 0) {
      roomStatus = 'IN_PROGRESS'
    }

    // Update room
    await prisma.room.update({
      where: { id: roomId },
      data: {
        progressFFE: progressPercentage,
        status: roomStatus as any
      }
    })

  } catch (error) {
    console.error('Error updating room progress:', error)
  }
}

/**
 * Checks if room completion triggers any project-level updates
 */
async function checkRoomCompletion(roomId: string, userId: string): Promise<void> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        stages: {
          select: {
            type: true,
            status: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            rooms: {
              select: {
                id: true,
                status: true,
                stages: {
                  select: {
                    type: true,
                    status: true
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!room) return

    // Check if this room is now complete
    const workflowStages = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
    const roomApplicableStages = room.stages.filter(stage => 
      workflowStages.includes(stage.type) && stage.status !== 'NOT_APPLICABLE'
    )
    
    const roomCompletedStages = roomApplicableStages.filter(stage => 
      stage.status === 'COMPLETED'
    )

    const isRoomComplete = roomApplicableStages.length > 0 && 
                          roomCompletedStages.length === roomApplicableStages.length

    if (isRoomComplete) {
      // Log room completion
      await prisma.activityLog.create({
        data: {
          type: 'ROOM_COMPLETED',
          description: `Room "${room.name || room.type}" completed all phases`,
          metadata: {
            roomId,
            completedStages: roomCompletedStages.length,
            totalStages: roomApplicableStages.length
          },
          userId,
          projectId: room.projectId
        }
      })

      // Check if this completes the entire project
      const allRoomsComplete = room.project.rooms.every(projectRoom => {
        const projRoomApplicableStages = projectRoom.stages.filter(stage => 
          workflowStages.includes(stage.type) && stage.status !== 'NOT_APPLICABLE'
        )
        const projRoomCompletedStages = projRoomApplicableStages.filter(stage => 
          stage.status === 'COMPLETED'
        )
        return projRoomApplicableStages.length > 0 && 
               projRoomCompletedStages.length === projRoomApplicableStages.length
      })

      if (allRoomsComplete) {
        // Log project completion
        await prisma.activityLog.create({
          data: {
            type: 'PROJECT_COMPLETED',
            description: `Project "${room.project.name}" completed all rooms and phases`,
            metadata: {
              projectId: room.projectId,
              totalRooms: room.project.rooms.length
            },
            userId,
            projectId: room.projectId
          }
        })
      }
    }

  } catch (error) {
    console.error('Error checking room completion:', error)
  }
}

/**
 * Gets FFE stage statistics across multiple rooms or projects
 */
export async function getFFEStageStats(filters: {
  projectId?: string
  roomIds?: string[]
  orgId: string
}): Promise<{
  totalStages: number
  completedStages: number
  inProgressStages: number
  notStartedStages: number
  totalBudget: number
  committedBudget: number
  averageCompletion: number
  stagesWithIssues: number
}> {
  try {
    const whereClause: any = {
      type: 'FFE',
      room: {
        project: {
          orgId: filters.orgId
        }
      }
    }

    if (filters.projectId) {
      whereClause.room.projectId = filters.projectId
    }

    if (filters.roomIds && filters.roomIds.length > 0) {
      whereClause.roomId = { in: filters.roomIds }
    }

    const ffeStages = await prisma.stage.findMany({
      where: whereClause,
      include: {
        room: {
          select: {
            id: true,
            type: true,
            name: true
          }
        }
      }
    })

    let totalBudget = 0
    let committedBudget = 0
    let totalCompletion = 0
    let stagesWithIssues = 0

    // Get detailed status for each stage
    const stageStatuses = await Promise.all(
      ffeStages.map(stage => getFFEStageStatus(stage.id))
    )

    const validStatuses = stageStatuses.filter(Boolean) as FFEStageStatus[]

    validStatuses.forEach(status => {
      totalBudget += status.estimatedBudget
      committedBudget += status.committedBudget
      totalCompletion += status.completionPercentage
      
      // Check for issues (stages that are started but not progressing well)
      if (status.completionPercentage > 0 && status.completionPercentage < 50 && 
          status.lastUpdated < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
        stagesWithIssues++
      }
    })

    const completedCount = ffeStages.filter(s => s.status === 'COMPLETED').length
    const inProgressCount = ffeStages.filter(s => s.status === 'IN_PROGRESS').length
    const notStartedCount = ffeStages.filter(s => s.status === 'NOT_STARTED').length

    return {
      totalStages: ffeStages.length,
      completedStages: completedCount,
      inProgressStages: inProgressCount,
      notStartedStages: notStartedCount,
      totalBudget,
      committedBudget,
      averageCompletion: validStatuses.length > 0 ? Math.round(totalCompletion / validStatuses.length) : 0,
      stagesWithIssues
    }

  } catch (error) {
    console.error('Error getting FFE stage stats:', error)
    return {
      totalStages: 0,
      completedStages: 0,
      inProgressStages: 0,
      notStartedStages: 0,
      totalBudget: 0,
      committedBudget: 0,
      averageCompletion: 0,
      stagesWithIssues: 0
    }
  }
}
