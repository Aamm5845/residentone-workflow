import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all stats in parallel (no org filtering)
    const [
      activeProjects,
      activeRooms,
      pendingApprovals,
      completedThisMonth,
      totalRevenue,
      activeStages,
      overdueTasks
    ] = await Promise.all([
      // Count projects with IN_PROGRESS status only
      prisma.project.count({
        where: {
          status: 'IN_PROGRESS'
        }
      }),
      // Count rooms that have IN_PROGRESS stages AND not all applicable stages are completed
      prisma.room.count({
        where: {
          AND: [
            // Must have at least one IN_PROGRESS or NEEDS_ATTENTION stage
            {
              stages: {
                some: {
                  status: { in: ['IN_PROGRESS', 'NEEDS_ATTENTION'] }
                }
              }
            },
            // Must not have ALL applicable stages completed (meaning not fully done)
            {
              NOT: {
                stages: {
                  every: {
                    OR: [
                      { status: 'COMPLETED' },
                      { status: 'NOT_APPLICABLE' }
                    ]
                  }
                }
              }
            }
          ]
        }
      }),
      // Count ClientApprovalVersions that are pending Aaron's approval
      prisma.clientApprovalVersion.count({
        where: {
          approvedByAaron: false,
          status: { in: ['DRAFT', 'PENDING_AARON_APPROVAL'] }
        }
      }),
      prisma.project.count({
        where: {
          status: 'COMPLETED',
          updatedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.project.aggregate({
        where: {
          status: 'COMPLETED'
        },
        _sum: { budget: true }
      }),
      prisma.stage.count({
        where: {
          status: 'IN_PROGRESS'
        }
      }),
      // Count stages and client approvals that are overdue
      Promise.all([
        prisma.stage.count({
          where: {
            status: { in: ['IN_PROGRESS', 'NEEDS_ATTENTION'] },
            dueDate: { lt: new Date() }
          }
        }),
        prisma.clientApprovalVersion.count({
          where: {
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
