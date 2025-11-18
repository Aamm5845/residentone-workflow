import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/activities/unread
 * 
 * Returns the count of unread activities (activities created after lastActivityViewedAt).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { orgId: true }
    })

    if (!user?.orgId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get lastViewed from query parameter (sent from client localStorage)
    const { searchParams } = request.nextUrl
    const lastViewedParam = searchParams.get('lastViewed')
    
    let cutoffDate: Date
    if (lastViewedParam) {
      cutoffDate = new Date(lastViewedParam)
    } else {
      // Default to last 24 hours if never viewed
      cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
    }

    const unreadCount = await prisma.activityLog.count({
      where: {
        orgId: user.orgId,
        createdAt: {
          gt: cutoffDate
        }
      }
    })

    return NextResponse.json({
      unreadCount,
      lastViewedAt: lastViewedParam
    })

  } catch (error) {
    console.error('Error fetching unread activities count:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unread activities count' },
      { status: 500 }
    )
  }
}
