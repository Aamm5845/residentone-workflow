import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { phaseNotificationService } from '@/lib/notifications/phase-notification-service'
import { 
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { stageId } = data

    if (!stageId) {
      return NextResponse.json({
        error: 'Stage ID is required'
      }, { status: 400 })
    }

    // Verify the stage exists and get its information
    const stage = await prisma.stage.findFirst({
      where: {
        id: stageId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        room: {
          include: {
            project: {
              include: {
                client: true
              }
            }
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({
        error: 'Stage not found or access denied'
      }, { status: 404 })
    }

    if (!stage.assignedUser) {
      return NextResponse.json({
        error: 'Cannot send email: Stage has no assigned user'
      }, { status: 400 })
    }

    // Find the previous stage that was completed to trigger this notification
    const allStages = await prisma.stage.findMany({
      where: {
        roomId: stage.roomId
      },
      include: {
        completedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    // Define phase sequence to find previous stage
    const phaseSequence = ['DESIGN_CONCEPT', 'THREE_D', 'CLIENT_APPROVAL', 'DRAWINGS', 'FFE']
    const currentIndex = phaseSequence.indexOf(stage.type)
    let previousStage = null

    if (currentIndex > 0) {
      const previousPhaseType = phaseSequence[currentIndex - 1]
      previousStage = allStages.find(s => s.type === previousPhaseType && s.status === 'COMPLETED')
    }

    // For CLIENT_APPROVAL special case, find the most recently completed stage
    if (stage.type === 'DRAWINGS' || stage.type === 'FFE') {
      const clientApprovalStage = allStages.find(s => s.type === 'CLIENT_APPROVAL' && s.status === 'COMPLETED')
      if (clientApprovalStage) {
        previousStage = clientApprovalStage
      }
    }

    if (!previousStage) {
      return NextResponse.json({
        error: 'Cannot determine previous completed stage for context'
      }, { status: 400 })
    }

    // Generate email data manually since we're bypassing the full notification service
    const phaseDisplayName = getPhaseDisplayName(stage.type)
    const previousPhaseDisplayName = getPhaseDisplayName(previousStage.type)
    const roomDisplayName = stage.room.name || stage.room.type.replace('_', ' ')
    const projectName = stage.room.project.name

    const emailSubject = `🚀 ${phaseDisplayName} Phase Ready to Start - ${projectName}`
    const emailPreview = `${previousPhaseDisplayName} for ${roomDisplayName} has been completed. You can now start the ${phaseDisplayName} phase.`

    // Use the service to send the phase ready email directly
    try {
      // We'll simulate the email sending by calling the service's private method indirectly
      // Create a mock result object to pass to the service
      const mockResult = {
        success: true,
        notificationsSent: 0,
        emailsSent: 0,
        errors: [],
        details: {
          inAppNotifications: [],
          emailNotifications: []
        }
      }

      // Create the notification service and call the email method
      await (phaseNotificationService as any).sendPhaseReadyEmail(
        stage.assignedUser,
        stage,
        previousStage,
        stage.room,
        stage.room.project,
        mockResult
      )

      // Log the manual email sending
      await logActivity({
        session,
        action: ActivityActions.NOTIFICATION_CREATED,
        entity: EntityTypes.STAGE,
        entityId: stageId,
        details: {
          action: 'manual_phase_email_sent',
          stageType: stage.type,
          assigneeId: stage.assignedUser.id,
          assigneeName: stage.assignedUser.name,
          assigneeEmail: stage.assignedUser.email,
          projectName: stage.room.project.name,
          roomName: roomDisplayName,
          emailSubject,
          triggeredBy: 'user_prompt'
        },
        ipAddress
      })

      return NextResponse.json({
        success: true,
        message: `Phase ready email sent to ${stage.assignedUser.name} (${stage.assignedUser.email})`,
        emailInfo: {
          recipient: {
            name: stage.assignedUser.name,
            email: stage.assignedUser.email
          },
          subject: emailSubject,
          preview: emailPreview,
          phase: phaseDisplayName,
          project: projectName
        }
      })

    } catch (emailError) {
      console.error('Error sending phase ready email:', emailError)
      
      return NextResponse.json({
        error: 'Failed to send email',
        details: 'Email service error occurred. Please check email configuration.',
        emailInfo: {
          recipient: {
            name: stage.assignedUser.name,
            email: stage.assignedUser.email
          },
          subject: emailSubject,
          preview: emailPreview
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in phase email endpoint:', error)
    return NextResponse.json({
      error: 'Failed to send phase email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Helper function to get phase display names
function getPhaseDisplayName(phaseType: string): string {
  const phaseNames: Record<string, string> = {
    'DESIGN_CONCEPT': 'Design Concept',
    'THREE_D': '3D Rendering',
    'CLIENT_APPROVAL': 'Client Approval',
    'DRAWINGS': 'Drawings',
    'FFE': 'FFE'
  }
  return phaseNames[phaseType] || phaseType
}
