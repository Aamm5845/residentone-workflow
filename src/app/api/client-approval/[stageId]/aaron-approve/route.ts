import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/client-approval/[stageId]/aaron-approve - Aaron approves renderings for client approval
export async function POST(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is Aaron or has admin privileges
    if (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only Aaron can approve renderings' }, { status: 403 })
    }

    const { stageId } = await params
    const body = await request.json()
    const { approved, notes } = body

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
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: true
              }
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

    // Update the version with Aaron's approval
    const updatedVersion = await prisma.clientApprovalVersion.update({
      where: {
        id: currentVersion.id
      },
      data: {
        approvedByAaron: approved,
        aaronApprovedAt: approved ? new Date() : null,
        aaronApprovedById: approved ? session.user.id : null,
        notes: notes || null,
        status: approved ? 'AARON_APPROVED' : 'DRAFT'
      }
    })

    // Create activity log
    await prisma.activity.create({
      data: {
        stageId: currentVersion.stageId,
        type: approved ? 'AARON_APPROVED' : 'AARON_REJECTED',
        message: approved 
          ? `Aaron approved renderings for client approval${notes ? ` with notes: "${notes}"` : ''}`
          : `Aaron rejected renderings${notes ? ` with notes: "${notes}"` : ''}`,
        userId: session.user.id,
        timestamp: new Date()
      }
    })

    return NextResponse.json({ 
      success: true,
      version: updatedVersion
    })

  } catch (error) {
    console.error('Error processing Aaron approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}