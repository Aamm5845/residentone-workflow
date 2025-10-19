import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { teamNotificationService } from '@/lib/services/team-notification-service'
import { isValidAuthSession } from '@/lib/attribution'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: stageId } = await params

    if (!stageId) {
      return NextResponse.json({
        error: 'Stage ID is required'
      }, { status: 400 })
    }

    // Get next phase assignees using the notification service
    const result = await teamNotificationService.getNextPhaseAssignees(stageId, session.user.id)

    if (result.recipients.length === 0 && result.nextPhases.length === 0) {
      return NextResponse.json({
        stageId,
        nextPhases: [],
        recipients: [],
        actorIncluded: false,
        message: 'No next phases or assignees found'
      })
    }

    return NextResponse.json({
      stageId,
      nextPhases: result.nextPhases.map(phase => ({
        id: phase.id,
        name: phase.name,
        type: phase.type
      })),
      recipients: result.recipients.map(recipient => ({
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        alreadySent: recipient.alreadySent
      })),
      actorIncluded: result.actorIncluded
    })

  } catch (error) {
    console.error('Error getting next phase assignees:', error)
    return NextResponse.json({
      error: 'Failed to get next phase assignees',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}