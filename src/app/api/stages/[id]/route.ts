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
import { phaseNotificationService } from '@/lib/notifications/phase-notification-service'

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
    
    // Validate required parameters
    if (!action) {
      return NextResponse.json({ 
        error: 'Missing action parameter',
        details: 'Action is required for stage operations'
      }, { status: 400 })
    }
    
    // Validate action type
    const validActions = ['start', 'complete', 'pause', 'reopen', 'assign', 'mark_not_applicable', 'mark_applicable', 'reset', 'close']
    if (!validActions.includes(action)) {
      return NextResponse.json({ 
        error: 'Invalid action',
        details: `Action must be one of: ${validActions.join(', ')}`
      }, { status: 400 })
    }
    
    // Verify stage access with enhanced error handling
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id
      },
      include: {
        room: {
          select: { 
            id: true,
            name: true,
            type: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ 
        error: 'Stage not found',
        details: `No stage found with ID: ${resolvedParams.id}`
      }, { status: 404 })
    }
    
    // Update stage based on action
    let updateData: any = {}
    let activityAction: string = ActivityActions.STAGE_STATUS_CHANGED
    let nextPhaseInfo: any[] = []
    
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
        // Preserve assignedTo when marking as not applicable
        startedAt: null,
        completedAt: null,
        completedById: null
      })
      activityAction = 'STAGE_MARKED_NOT_APPLICABLE'
    } else if (action === 'mark_applicable') {
      // Action to reverse not applicable status - preserve assignedTo
      updateData = withUpdateAttribution(session, {
        status: 'NOT_STARTED'
        // Keep assignedTo as is - don't clear it
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
    } else if (action === 'close') {
      // Close an IN_PROGRESS phase back to NOT_STARTED (preserves work but closes phase)
      updateData = withUpdateAttribution(session, {
        status: 'NOT_STARTED',
        startedAt: null
        // Preserve assignedTo, completedAt, and completedById if they exist
      })
      activityAction = 'STAGE_CLOSED'
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
    
    // Handle automatic phase transitions and notifications when stages are completed
    if (action === 'complete' && updatedStage.room) {
      console.log('=== STARTING WORKFLOW TRANSITIONS ===')
      console.log('Stage completed:', stage.type, 'in room:', updatedStage.room.id)
      
      try {
        const workflowEvent: WorkflowEvent = {
          type: 'STAGE_COMPLETED',
          roomId: updatedStage.room.id,
          stageType: stage.type,
          stageId: resolvedParams.id
        }
        
        console.log('Workflow event:', workflowEvent)
        const transitionResult = await handleWorkflowTransition(workflowEvent, session, ipAddress)
        console.log('Workflow transition result:', transitionResult)
        
        if (transitionResult.transitionsTriggered.length > 0) {
          console.log(`✅ Phase transitions triggered:`, transitionResult.transitionsTriggered)
        } else {
          console.log('⚠️ No phase transitions were triggered')
        }
        
        if (transitionResult.errors.length > 0) {
          console.error('❌ Phase transition errors:', transitionResult.errors)
        }
      } catch (transitionError) {
        console.error('❌ Error handling phase transitions:', transitionError)
        console.error('Transition error stack:', transitionError instanceof Error ? transitionError.stack : 'No stack')
        // Don't fail the main operation if transitions fail
      }
      
      console.log('=== WORKFLOW TRANSITIONS COMPLETE ===')
      
      // Send notifications for phase completion (with email prompt)
      console.log('=== STARTING NOTIFICATION PROCESSING ===')
      try {
        console.log('Starting phase completion notification processing...')
        console.log('Stage ID:', resolvedParams.id, 'User ID:', session.user.id)
        
        const notificationResult = await phaseNotificationService.handlePhaseCompletion(
          resolvedParams.id,
          session.user.id,
          session,
          { autoEmail: false } // Don't send emails automatically, let UI prompt user
        )
        
        console.log('Notification service result:', notificationResult)
        
        if (notificationResult && notificationResult.success) {
          console.log(`✅ Phase completion notifications processed:`, {
            notifications: notificationResult.notificationsSent,
            emails: notificationResult.emailsSent,
            nextPhases: notificationResult.nextPhaseInfo?.length || 0,
            details: notificationResult.details
          })
          
          // Extract next phase information for UI prompt
          nextPhaseInfo = notificationResult.nextPhaseInfo || []
          console.log('Next phase info extracted:', nextPhaseInfo)
        } else {
          console.error('❌ Phase notification errors:', notificationResult?.errors || 'Unknown error')
        }
      } catch (notificationError) {
        console.error('❌ Error processing phase completion notifications:', notificationError)
        console.error('Notification error stack:', notificationError instanceof Error ? notificationError.stack : 'No stack')
        // Don't fail the main operation if notifications fail - just log the error
      }
      
      console.log('=== NOTIFICATION PROCESSING COMPLETE ===')
    }
    
    // Include next phase info for completion actions
    const responseData: any = { ...updatedStage }
    if (action === 'complete' && nextPhaseInfo && nextPhaseInfo.length > 0) {
      responseData.nextPhaseInfo = nextPhaseInfo
    }
    
    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error updating stage:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'Unknown error')
    
    // Provide more specific error messages based on error type
    let errorMessage = 'Internal server error'
    let errorDetails = 'An unexpected error occurred'
    
    if (error instanceof Error) {
      errorDetails = error.message
      
      // Handle specific error types
      if (error.message.includes('Prisma') || error.message.includes('database')) {
        errorMessage = 'Database error'
        errorDetails = 'Failed to update stage in database'
      } else if (error.message.includes('validation') || error.message.includes('constraint')) {
        errorMessage = 'Validation error'
      } else if (error.message.includes('unauthorized') || error.message.includes('permission')) {
        errorMessage = 'Permission error'
        errorDetails = 'You do not have permission to perform this action'
      }
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      details: errorDetails,
      timestamp: new Date().toISOString()
    }, { status: 500 })
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
    
    console.log(`Fetching stage with ID: ${resolvedParams.id}`)
    
    if (!isValidAuthSession(session)) {
      console.log('Unauthorized access attempt')
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
      console.log(`Stage not found: ${resolvedParams.id}`)
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Add defensive programming - ensure arrays are always arrays
    const safeStage = {
      ...stage,
      designSections: stage.designSections || [],
      room: stage.room ? {
        ...stage.room,
        stages: stage.room.stages || [],
        ffeItems: stage.room.ffeItems || [],
        project: stage.room.project || { name: 'Unknown Project', id: '' }
      } : null
    }

    console.log(`Successfully fetched stage: ${stage.id}, type: ${stage.type}, status: ${stage.status}`)
    return NextResponse.json(safeStage)
  } catch (error) {
    console.error('Error fetching stage:', error)
    console.error('Stack trace:', error.stack)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}
