import { prisma } from '@/lib/prisma'
import { 
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  type AuthSession
} from '@/lib/attribution'

/**
 * Phase Transition Utility
 * Handles automatic workflow transitions between phases when certain triggers occur
 */

export interface PhaseTransitionResult {
  success: boolean
  transitionsTriggered: Array<{
    stageId: string
    stageType: string
    fromStatus: string
    toStatus: string
    reason: string
  }>
  errors: string[]
}

/**
 * Automatically starts the next phase when previous phase is completed
 */
export async function triggerPhaseTransitions(
  roomId: string,
  triggeringStageType: string,
  triggeringAction: string,
  session: AuthSession,
  ipAddress?: string
): Promise<PhaseTransitionResult> {
  const result: PhaseTransitionResult = {
    success: true,
    transitionsTriggered: [],
    errors: []
  }

  try {
    // Define phase transition rules
    const transitionRules = {
      // When 3D rendering is pushed to client, auto-start client approval
      'THREE_D_PUSH_TO_CLIENT': {
        targetStageType: 'CLIENT_APPROVAL',
        reason: '3D renderings pushed to client approval'
      },
      // When design concept is completed, allow 3D rendering to start
      'DESIGN_CONCEPT_COMPLETED': {
        targetStageType: 'THREE_D', 
        reason: 'Design concept phase completed'
      },
      // When client approval is completed, allow drawings to start
      'CLIENT_APPROVAL_COMPLETED': {
        targetStageType: 'DRAWINGS',
        reason: 'Client approval phase completed'
      },
      // When drawings are completed, allow FFE to start  
      'DRAWINGS_COMPLETED': {
        targetStageType: 'FFE',
        reason: 'Drawings phase completed'
      },
      // When client requests revision, reopen 3D rendering stage
      'CLIENT_APPROVAL_REVISION_REQUESTED': {
        targetStageType: 'THREE_D',
        reason: 'Client requested revisions - reopening 3D rendering for updates'
      }
    }

    // Create transition key
    const transitionKey = `${triggeringStageType}_${triggeringAction.toUpperCase()}`
    const rule = transitionRules[transitionKey as keyof typeof transitionRules]

    if (!rule) {
      // No transition rule for this action
      return result
    }

    // Find the target stage
    const targetStage = await prisma.stage.findFirst({
      where: {
        roomId: roomId,
        type: rule.targetStageType
      }
    })

    if (!targetStage) {
      result.errors.push(`Target stage ${rule.targetStageType} not found for room`)
      result.success = false
      return result
    }

    // Handle different transition scenarios
    let fromStatus = targetStage.status
    let toStatus = 'IN_PROGRESS'
    let updateData: any = {
      status: 'IN_PROGRESS'
    }

    // For revision requests, reopen completed stages
    if (transitionKey === 'CLIENT_APPROVAL_REVISION_REQUESTED') {
      if (targetStage.status === 'COMPLETED') {
        // Reopen completed stage for revisions
        updateData = {
          status: 'IN_PROGRESS',
          completedAt: null,
          completedById: null
        }
      } else if (targetStage.status === 'IN_PROGRESS') {
        // Already in progress, no need to transition
        return result
      }
    } else {
      // For other transitions, only trigger if target stage is NOT_STARTED
      if (targetStage.status !== 'NOT_STARTED') {
        // Stage is already started or completed, no need to transition
        return result
      }
      updateData.startedAt = new Date()
    }

    // Execute the transition
    const updatedStage = await prisma.stage.update({
      where: { id: targetStage.id },
      data: withUpdateAttribution(session, updateData)
    })

    // Record the transition
    result.transitionsTriggered.push({
      stageId: targetStage.id,
      stageType: rule.targetStageType,
      fromStatus,
      toStatus,
      reason: rule.reason
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.STAGE_STARTED,
      entity: EntityTypes.STAGE,
      entityId: targetStage.id,
      details: {
        action: 'auto_start',
        stageName: `${rule.targetStageType}`,
        previousStatus: 'NOT_STARTED',
        newStatus: 'IN_PROGRESS',
        trigger: transitionKey,
        reason: rule.reason,
        autoTriggered: true
      },
      ipAddress
    })

  } catch (error) {
    console.error('Error in phase transition:', error)
    result.errors.push(`Phase transition failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    result.success = false
  }

  return result
}

/**
 * Handles automatic phase transitions for specific workflow events
 */
export async function handleWorkflowTransition(
  event: WorkflowEvent,
  session: AuthSession,
  ipAddress?: string
): Promise<PhaseTransitionResult> {
  
  switch (event.type) {
    case 'RENDERING_PUSHED_TO_CLIENT':
      return await triggerPhaseTransitions(
        event.roomId,
        'THREE_D',
        'PUSH_TO_CLIENT',
        session,
        ipAddress
      )
    
    case 'STAGE_COMPLETED':
      return await triggerPhaseTransitions(
        event.roomId,
        event.stageType,
        'COMPLETED',
        session,
        ipAddress
      )
    
    case 'CLIENT_APPROVED':
      return await triggerPhaseTransitions(
        event.roomId,
        'CLIENT_APPROVAL',
        'COMPLETED',
        session,
        ipAddress
      )
    
    case 'CLIENT_REVISION_REQUESTED':
      return await triggerPhaseTransitions(
        event.roomId,
        'CLIENT_APPROVAL',
        'REVISION_REQUESTED',
        session,
        ipAddress
      )
    
    default:
      return {
        success: true,
        transitionsTriggered: [],
        errors: []
      }
  }
}

export interface WorkflowEvent {
  type: 'RENDERING_PUSHED_TO_CLIENT' | 'STAGE_COMPLETED' | 'CLIENT_APPROVED' | 'CLIENT_REVISION_REQUESTED'
  roomId: string
  stageType: string
  stageId?: string
  details?: any
}

/**
 * Gets the expected phase status based on current workflow state
 */
export async function getPhaseStatus(roomId: string, phaseType: string): Promise<'PENDING' | 'IN_PROGRESS' | 'COMPLETE'> {
  // Map phase types to stage types
  const stageTypeMap: Record<string, string> = {
    'DESIGN_CONCEPT': 'DESIGN',
    'RENDERING': 'THREE_D', 
    'CLIENT_APPROVAL': 'CLIENT_APPROVAL',
    'DRAWINGS': 'DRAWINGS',
    'FFE': 'FFE'
  }

  const stageType = stageTypeMap[phaseType] || phaseType

  const stage = await prisma.stage.findFirst({
    where: {
      roomId,
      type: stageType
    }
  })

  if (!stage) return 'PENDING'

  switch (stage.status) {
    case 'COMPLETED':
      return 'COMPLETE'
    case 'IN_PROGRESS':
      return 'IN_PROGRESS' 
    default:
      return 'PENDING'
  }
}

/**
 * Refreshes room phase data to ensure UI synchronization
 */
export async function refreshRoomPhases(roomId: string) {
  return await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      stages: {
        include: {
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              image: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  })
}
