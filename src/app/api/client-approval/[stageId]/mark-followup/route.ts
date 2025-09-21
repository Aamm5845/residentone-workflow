import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/client-approval/[stageId]/mark-followup - Mark follow-up as completed
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
    const body = await request.json()
    const { notes } = body

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

    if (!currentVersion.sentToClientAt) {
      return NextResponse.json({ error: 'Email not sent yet' }, { status: 400 })
    }

    // Update version with follow-up completion
    const updatedVersion = await prisma.clientApprovalVersion.update({
      where: {
        id: currentVersion.id
      },
      data: {
        followUpCompletedAt: new Date(),
        followUpNotes: notes,
        status: 'FOLLOW_UP_REQUIRED', // Ready for client decision
        activityLogs: {
          create: {
            type: 'follow_up_completed',
            message: 'Follow-up call completed',
            userId: session.user.id,
            metadata: JSON.stringify({ notes })
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
    console.error('Error marking follow-up done:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}