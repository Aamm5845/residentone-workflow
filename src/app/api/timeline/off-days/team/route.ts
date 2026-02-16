import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/timeline/off-days/team
 *
 * Get all team members' off days for the organization.
 * All authenticated users in the organization can view team off days.
 *
 * Query params:
 * - startDate: (optional) Start of date range
 * - endDate: (optional) End of date range
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const whereClause: any = {
      user: {
        orgId: session.user.orgId
      }
    }

    if (startDate || endDate) {
      whereClause.date = {}
      if (startDate) {
        whereClause.date.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.date.lte = new Date(endDate)
      }
    }

    const offDays = await prisma.userOffDay.findMany({
      where: whereClause,
      orderBy: [
        { date: 'desc' },
        { user: { name: 'asc' } }
      ],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Group by user for summary
    const userSummary: Record<string, {
      userId: string
      userName: string
      userEmail: string
      userRole: string
      totalDays: number
      byReason: Record<string, number>
    }> = {}

    offDays.forEach(od => {
      if (!userSummary[od.userId]) {
        userSummary[od.userId] = {
          userId: od.userId,
          userName: od.user.name || 'Unknown',
          userEmail: od.user.email,
          userRole: od.user.role,
          totalDays: 0,
          byReason: {}
        }
      }
      userSummary[od.userId].totalDays++
      userSummary[od.userId].byReason[od.reason] =
        (userSummary[od.userId].byReason[od.reason] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      offDays: offDays.map(od => ({
        id: od.id,
        userId: od.userId,
        userName: od.user.name,
        userEmail: od.user.email,
        userRole: od.user.role,
        date: od.date.toISOString().split('T')[0],
        reason: od.reason,
        notes: od.notes,
        createdAt: od.createdAt
      })),
      summary: Object.values(userSummary),
      totalRecords: offDays.length
    })
  } catch (error) {
    console.error('Error fetching team off days:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team off days' },
      { status: 500 }
    )
  }
}
