import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
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
      // Count rooms that have at least one IN_PROGRESS stage (truly active)
      prisma.room.count({
        where: { 
          project: { orgId: session.user.orgId },
          stages: {
            some: {
              status: 'IN_PROGRESS'
            }
          }
        }
      }),
      // Count ClientApprovalVersions that are pending client approval
      prisma.clientApprovalVersion.count({
        where: {
          stage: {
            room: {
              project: { orgId: session.user.orgId }
            }
          },
          status: 'SENT_TO_CLIENT',
          clientDecision: 'PENDING'
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
      // Count stages and client approvals that are overdue
      Promise.all([
        prisma.stage.count({
          where: {
            room: {
              project: { orgId: session.user.orgId }
            },
            status: { in: ['IN_PROGRESS', 'NEEDS_ATTENTION'] },
            dueDate: { lt: new Date() }
          }
        }),
        prisma.clientApprovalVersion.count({
          where: {
            stage: {
              room: {
                project: { orgId: session.user.orgId }
              }
            },
            status: 'SENT_TO_CLIENT',
            clientDecision: 'PENDING',
            sentToClientAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // More than 7 days ago
          }
        })
      ]).then(([overdueStages, overdueApprovals]) => overdueStages + overdueApprovals)
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
