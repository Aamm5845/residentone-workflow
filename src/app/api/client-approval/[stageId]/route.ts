import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/client-approval/[stageId] - Get client approval data for a stage
export async function GET(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params

    // Get the current version with all related data
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
      include: {
        stage: {
          include: {
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
        },
        assets: {
          include: {
            asset: {
              include: {
                uploader: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              }
            }
          },
          orderBy: {
            displayOrder: 'asc'
          }
        },
        emailLogs: {
          orderBy: {
            sentAt: 'desc'
          }
        },
        sentBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        aaronApprovedBy: {
          select: {
            id: true,
            name: true,
            email: true
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

    // Get client approvals/decisions
    const clientApprovals = await prisma.clientApproval.findMany({
      where: {
        versionId: currentVersion.id
      },
      orderBy: {
        approvedAt: 'desc'
      }
    })

    return NextResponse.json({
      currentVersion: currentVersion,
      clientApprovals
    })

  } catch (error) {
    console.error('Error fetching client approval data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}