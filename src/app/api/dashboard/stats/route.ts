import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all stats in parallel
    const [
      activeProjects,
      activeRooms,
      pendingApprovals,
      completedThisMonth,
      totalRevenue,
      activeStages,
      overdueTasks
    ] = await Promise.all([
      prisma.project.count({
        where: {
          orgId: session.user.orgId,
          status: { in: ['IN_PROGRESS', 'PENDING_APPROVAL'] }
        }
      }),
      prisma.room.count({
        where: { 
          project: { orgId: session.user.orgId },
          status: 'IN_PROGRESS'
        }
      }),
      prisma.approval.count({
        where: {
          project: { orgId: session.user.orgId },
          status: 'PENDING'
        }
      }),
      prisma.project.count({
        where: {
          orgId: session.user.orgId,
          status: 'COMPLETED',
          updatedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.project.aggregate({
        where: {
          orgId: session.user.orgId,
          status: 'COMPLETED'
        },
        _sum: { budget: true }
      }),
      prisma.stage.count({
        where: {
          room: {
            project: { orgId: session.user.orgId }
          },
          status: 'IN_PROGRESS'
        }
      }),
      prisma.stage.count({
        where: {
          room: {
            project: { orgId: session.user.orgId }
          },
          status: 'NEEDS_ATTENTION',
          dueDate: { lt: new Date() }
        }
      })
    ])

    return NextResponse.json({
      activeProjects,
      activeRooms,
      pendingApprovals,
      completedThisMonth,
      totalRevenue: totalRevenue._sum.budget || 0,
      activeStages,
      overdueTasks
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}