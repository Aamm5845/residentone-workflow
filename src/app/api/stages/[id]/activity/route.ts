import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/stages/[id]/activity - Get activity logs for a stage
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: stageId } = await params

    // Verify stage belongs to user's organization
    const stage = await prisma.stage.findFirst({
      where: {
        id: stageId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Get activity logs from both Activity and ActivityLog tables
    // First get from Activity table (client approval specific)
    const activities = await prisma.activity.findMany({
      where: { stageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { timestamp: 'desc' }
    })

    // Get from ActivityLog table (general activity tracking)
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        entity: 'STAGE',
        entityId: stageId,
        orgId: session.user.orgId
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Combine and format activities
    const allActivities = [
      // Format Activity records
      ...activities.map(activity => ({
        id: activity.id,
        type: activity.type,
        message: activity.message,
        user: activity.user,
        createdAt: activity.timestamp.toISOString(),
        source: 'activity'
      })),
      // Format ActivityLog records
      ...activityLogs.map(log => ({
        id: log.id,
        type: log.action,
        message: log.details?.message || `${log.action} performed`,
        user: log.actor,
        createdAt: log.createdAt.toISOString(),
        source: 'activity_log'
      }))
    ]

    // Sort by date (newest first)
    allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      activities: allActivities,
      count: allActivities.length
    })

  } catch (error) {
    console.error('Error fetching stage activity logs:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}