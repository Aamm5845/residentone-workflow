import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/projects/[id]/activity - Get project activity timeline
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const entityType = searchParams.get('entityType')
    const actionType = searchParams.get('actionType')
    const updateId = searchParams.get('updateId')
    const actorId = searchParams.get('actorId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Check if user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build filter conditions
    const where: any = {
      projectId,
      ...(entityType && { entityType }),
      ...(actionType && { actionType }),
      ...(updateId && { updateId }),
      ...(actorId && { actorId }),
      ...(startDate && endDate && {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      })
    }

    const skip = (page - 1) * limit

    const [activities, total] = await Promise.all([
      prisma.projectUpdateActivity.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true
            }
          },
          update: {
            select: {
              id: true,
              title: true,
              type: true,
              category: true,
              status: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.projectUpdateActivity.count({ where })
    ])

    // Get activity statistics
    const stats = await Promise.all([
      // Activity by action type
      prisma.projectUpdateActivity.groupBy({
        by: ['actionType'],
        where: { projectId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      }),
      
      // Activity by entity type
      prisma.projectUpdateActivity.groupBy({
        by: ['entityType'],
        where: { projectId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } }
      }),
      
      // Most active users
      prisma.projectUpdateActivity.groupBy({
        by: ['actorId'],
        where: { projectId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5
      }),

      // Activity over time (last 30 days)
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM project_update_activities 
        WHERE project_id = ${projectId}
          AND created_at >= NOW() - INTERVAL 30 DAY
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `
    ])

    const [actionStats, entityStats, userStats, timeStats] = stats

    // Get user details for top contributors
    const topContributors = await Promise.all(
      userStats.map(async (stat) => {
        const user = await prisma.user.findUnique({
          where: { id: stat.actorId },
          select: {
            id: true,
            name: true,
            image: true,
            role: true
          }
        })
        return {
          user,
          activityCount: stat._count.id
        }
      })
    )

    // Format activities with enhanced context
    const formattedActivities = activities.map(activity => {
      let contextualDescription = activity.description

      // Add contextual information based on entity type
      if (activity.entityType === 'UPDATE' && activity.update) {
        contextualDescription = `${activity.description} - "${activity.update.title}" (${activity.update.type})`
      }

      // Parse metadata for additional context
      let additionalContext = {}
      if (activity.metadata && typeof activity.metadata === 'object') {
        additionalContext = activity.metadata
      }

      return {
        ...activity,
        contextualDescription,
        additionalContext,
        timeAgo: getTimeAgo(activity.createdAt)
      }
    })

    return NextResponse.json({
      activities: formattedActivities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      stats: {
        totalActivities: total,
        actionTypeBreakdown: actionStats.map(s => ({
          actionType: s.actionType,
          count: s._count.id
        })),
        entityTypeBreakdown: entityStats.map(s => ({
          entityType: s.entityType,
          count: s._count.id
        })),
        topContributors,
        activityOverTime: timeStats
      }
    })

  } catch (error) {
    console.error('Error fetching activity:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  } else {
    return date.toLocaleDateString()
  }
}