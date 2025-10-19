import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { teamNotificationService } from '@/lib/services/team-notification-service'
import { isValidAuthSession } from '@/lib/attribution'

interface RouteParams {
  params: {
    id: string
  }
}

export async function POST(
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

    // Parse request body
    const body = await request.json()
    const { recipientIds, customMessage, includeActor } = body

    // Validate request body
    if (!recipientIds || !Array.isArray(recipientIds)) {
      return NextResponse.json({
        error: 'recipientIds is required and must be an array'
      }, { status: 400 })
    }

    if (recipientIds.length === 0) {
      return NextResponse.json({
        error: 'At least one recipient is required'
      }, { status: 400 })
    }

    // Filter out actor if not explicitly included
    let finalRecipientIds = recipientIds
    if (!includeActor) {
      finalRecipientIds = recipientIds.filter(id => id !== session.user.id)
    }

    if (finalRecipientIds.length === 0) {
      return NextResponse.json({
        sent: [],
        skipped: [],
        message: 'No recipients selected (actor excluded)'
      }, { status: 200 })
    }

    // Send notifications using the service
    const result = await teamNotificationService.sendPhaseCompletionNotifications({
      stageId,
      recipientIds: finalRecipientIds,
      actorUserId: session.user.id,
      customMessage
    })

    // Format response
    const sent = result.results
      .filter(r => r.status === 'sent')
      .map(r => ({
        userId: r.userId,
        messageId: r.messageId
      }))

    const skipped = result.results
      .filter(r => r.status === 'skipped')
      .map(r => ({
        userId: r.userId,
        reason: r.reason
      }))

    const failed = result.results
      .filter(r => r.status === 'error')
      .map(r => ({
        userId: r.userId,
        reason: r.reason
      }))

    if (result.success || result.sentCount > 0) {
      return NextResponse.json({
        success: true,
        sent,
        skipped,
        failed,
        summary: {
          sentCount: result.sentCount,
          skippedCount: result.skippedCount,
          failedCount: failed.length
        }
      }, { status: 200 })
    } else {
      return NextResponse.json({
        success: false,
        sent,
        skipped,
        failed,
        errors: result.errors,
        summary: {
          sentCount: result.sentCount,
          skippedCount: result.skippedCount,
          failedCount: failed.length
        }
      }, { status: 207 }) // Multi-status for partial failures
    }

  } catch (error) {
    console.error('Error sending team notifications:', error)
    return NextResponse.json({
      error: 'Failed to send notifications',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}