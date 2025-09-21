import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/cron/follow-up-reminders - Check for 2-day follow-up reminders
// This would be called by a cron job (Vercel Cron, GitHub Actions, etc.)
export async function GET(request: NextRequest) {
  try {
    // Check authorization (in production, use cron secret)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)

    // Find all client approval versions that:
    // 1. Were sent to client more than 2 days ago
    // 2. Haven't been followed up yet
    // 3. Don't have a client decision yet
    const versionsNeedingFollowUp = await prisma.clientApprovalVersion.findMany({
      where: {
        sentToClientAt: {
          lte: twoDaysAgo
        },
        followUpCompletedAt: null,
        clientDecision: 'PENDING',
        status: {
          in: ['SENT_TO_CLIENT', 'CLIENT_REVIEWING']
        }
      },
      include: {
        stage: {
          include: {
            assignedUser: true,
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
        }
      }
    })

    let notificationsCreated = 0

    for (const version of versionsNeedingFollowUp) {
      if (!version.stage.assignedUser) continue

      try {
        // Create notification for the assigned team member
        await prisma.notification.create({
          data: {
            userId: version.stage.assignedUser.id,
            type: 'DUE_DATE_REMINDER',
            title: 'Follow-up Reminder: Client Approval Pending',
            message: `Client hasn't responded to ${version.stage.room.name || version.stage.room.type} renderings sent ${Math.floor((now.getTime() - version.sentToClientAt!.getTime()) / (24 * 60 * 60 * 1000))} days ago. Follow-up recommended.`,
            relatedId: version.stage.id,
            relatedType: 'STAGE'
          }
        })

        // Update version status to indicate follow-up is required
        await prisma.clientApprovalVersion.update({
          where: {
            id: version.id
          },
          data: {
            status: 'FOLLOW_UP_REQUIRED',
            activityLogs: {
              create: {
                type: 'follow_up_reminder',
                message: 'Automated follow-up reminder created',
                metadata: JSON.stringify({
                  daysSinceEmail: Math.floor((now.getTime() - version.sentToClientAt!.getTime()) / (24 * 60 * 60 * 1000))
                })
              }
            }
          }
        })

        notificationsCreated++
      } catch (error) {
        console.error(`Failed to create notification for version ${version.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      versionsProcessed: versionsNeedingFollowUp.length,
      notificationsCreated,
      timestamp: now.toISOString()
    })

  } catch (error) {
    console.error('Error processing follow-up reminders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
