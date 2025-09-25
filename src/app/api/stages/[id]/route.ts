import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { completeFFEStage, resetFFEStage } from '@/lib/stage/ffe-stage-manager'
import type { Session } from 'next-auth'
import { 
  withUpdateAttribution, 
  withCompletionAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'
import { 
  handleWorkflowTransition,
  type WorkflowEvent
} from '@/lib/phase-transitions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { action, assignedTo, dueDate } = data
    
    // Verify stage access
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }
    
    // Update stage based on action
    let updateData: any = {}
    let activityAction: string = ActivityActions.STAGE_STATUS_CHANGED
    
    if (action === 'start') {
      updateData = withUpdateAttribution(session, {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        ...(assignedTo && { assignedTo })
      })
      activityAction = ActivityActions.STAGE_STARTED
    } else if (action === 'complete') {
      // Handle FFE stages with special validation
      if (stage.type === 'FFE') {
        const ffeResult = await completeFFEStage(resolvedParams.id, session.user.id, data.forceComplete || false)
        
        if (!ffeResult.success) {
          return NextResponse.json({ 
            error: 'FFE stage completion failed',
            details: ffeResult.errors,
            warnings: ffeResult.warnings,
            validation: ffeResult.validation
          }, { status: 400 })
        }
        
        // FFE stage was completed successfully, return the result
        return NextResponse.json({
          ...ffeResult.stage,
          ffeValidation: ffeResult.validation,
          warnings: ffeResult.warnings
        })
      } else {
        // Handle non-FFE stages normally
        updateData = withCompletionAttribution(session, {
          status: 'COMPLETED'
        })
        activityAction = ActivityActions.STAGE_COMPLETED
      }
    } else if (action === 'pause') {
      updateData = withUpdateAttribution(session, {
        status: 'ON_HOLD'
      })
    } else if (action === 'reopen') {
      updateData = withUpdateAttribution(session, {
        status: 'IN_PROGRESS',
        completedAt: null,
        startedAt: new Date(),
        completedById: null
      })
      activityAction = ActivityActions.STAGE_REOPENED
    } else if (action === 'assign') {
      updateData = withUpdateAttribution(session, {
        assignedTo
      })
      activityAction = ActivityActions.STAGE_ASSIGNED
    } else if (action === 'mark_not_applicable') {
      updateData = withUpdateAttribution(session, {
        status: 'NOT_APPLICABLE',
        assignedTo: null, // Clear assignment when marking as not applicable
        startedAt: null,
        completedAt: null,
        completedById: null
      })
      activityAction = 'STAGE_MARKED_NOT_APPLICABLE'
    } else if (action === 'mark_applicable') {
      // Action to reverse not applicable status
      updateData = withUpdateAttribution(session, {
        status: 'NOT_STARTED'
      })
      activityAction = 'STAGE_MARKED_APPLICABLE'
    } else if (action === 'reset') {
      // Handle FFE stage reset with special logic
      if (stage.type === 'FFE') {
        const resetResult = await resetFFEStage(resolvedParams.id, session.user.id, data.clearItems || false)
        
        if (!resetResult.success) {
          return NextResponse.json({
            error: 'FFE stage reset failed',
            details: resetResult.errors
          }, { status: 400 })
        }
        
        return NextResponse.json(resetResult.stage)
      } else {
        // Handle non-FFE stage reset normally
        updateData = withUpdateAttribution(session, {
          status: 'NOT_STARTED',
          completedAt: null,
          startedAt: null,
          completedById: null
        })
        activityAction = 'STAGE_RESET'
      }
    }
    
    if (dueDate) {
      updateData.dueDate = new Date(dueDate)
    }
    
    const updatedStage = await prisma.stage.update({
      where: { id: resolvedParams.id },
      data: updateData,
      include: {
        assignedUser: {
          select: { name: true, email: true }
        },
        updatedBy: {
          select: { name: true, email: true }
        },
        completedBy: {
          select: { name: true, email: true }
        },
        room: {
          select: { id: true }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: activityAction,
      entity: EntityTypes.STAGE,
      entityId: resolvedParams.id,
      details: {
        action,
        stageName: `${stage.type} - ${stage.room?.name || stage.room?.type}`,
        previousStatus: stage.status,
        newStatus: updateData.status,
        assignedTo
      },
      ipAddress
    })
    
    // Handle automatic phase transitions when stages are completed
    if (action === 'complete' && updatedStage.room) {
      try {
        const workflowEvent: WorkflowEvent = {
          type: 'STAGE_COMPLETED',
          roomId: updatedStage.room.id,
          stageType: stage.type,
          stageId: resolvedParams.id
        }
        
        const transitionResult = await handleWorkflowTransition(workflowEvent, session, ipAddress)
        
        if (transitionResult.transitionsTriggered.length > 0) {
          console.log(`Phase transitions triggered:`, transitionResult.transitionsTriggered)
        }
        
        if (transitionResult.errors.length > 0) {
          console.error('Phase transition errors:', transitionResult.errors)
        }
      } catch (transitionError) {
        console.error('Error handling phase transitions:', transitionError)
        // Don't fail the main operation if transitions fail
      }
    }
    
    return NextResponse.json(updatedStage)
  } catch (error) {
    console.error('Error updating stage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Get stage details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id
      },
      include: {
        assignedUser: {
          select: { name: true, email: true }
        },
        designSections: {
          include: {
            assets: {
              orderBy: { createdAt: 'desc' }
            },
            comments: {
              include: {
                author: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        room: {
          include: {
            project: {
              select: { name: true, id: true }
            },
            stages: {
              include: {
                assignedUser: {
                  select: { name: true }
                }
              },
              orderBy: { createdAt: 'asc' }
            },
            ffeItems: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    return NextResponse.json(stage)
  } catch (error) {
    console.error('Error fetching stage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
