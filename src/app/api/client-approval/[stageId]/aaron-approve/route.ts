import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/client-approval/[stageId]/aaron-approve - Aaron approves rendering
export async function POST(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params

    // Get the current version
    const currentVersion = await prisma.clientApprovalVersion.findFirst({
      where: {
        stageId,
        stage: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!currentVersion) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Update version with Aaron's approval
    const updatedVersion = await prisma.clientApprovalVersion.update({
      where: {
        id: currentVersion.id
      },
      data: {
        approvedByAaron: true,
        aaronApprovedAt: new Date(),
        aaronApprovedById: session.user.id,
        status: 'READY_FOR_CLIENT',
        activityLogs: {
          create: {
            type: 'aaron_approved',
            message: 'Aaron approved rendering',
            userId: session.user.id
          }
        }
      },
      include: {
        assets: {
          include: {
            asset: true
          },
          orderBy: {
            displayOrder: 'asc'
          }
        },
        activityLogs: {
          include: {
            user: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        },
        emailLogs: true,
        aaronApprovedBy: true,
        sentBy: true
      }
    })

    return NextResponse.json({ version: updatedVersion })

  } catch (error) {
    console.error('Error approving rendering:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}