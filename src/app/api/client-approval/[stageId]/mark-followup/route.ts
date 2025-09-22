import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/client-approval/[stageId]/mark-followup - Mark follow-up as completed
export async function POST(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params
    const body = await request.json()
    const { notes } = body

    // Get the current version
    const currentVersion = await prisma.clientApprovalVersion.findFirst({
      where: {
        stageId
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

    // Update the version to mark follow-up as completed
    const updatedVersion = await prisma.clientApprovalVersion.update({
      where: {
        id: currentVersion.id
      },
      data: {
        followUpCompletedAt: new Date(),
        followUpNotes: notes || null,
        status: 'FOLLOW_UP_REQUIRED' // This will show that follow-up is completed and awaiting client decision
      },
      include: {
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
          }
        }
      }
    })

    // Create activity log
    await prisma.activity.create({
      data: {
        stageId: currentVersion.stageId,
        type: 'FOLLOW_UP_COMPLETED',
        message: `${currentVersion.version} follow-up completed - Follow-up completed by ${session.user.name}${notes ? ` with notes: "${notes}"` : ''}`,
        userId: session.user.id
      }
    })

    return NextResponse.json({ 
      success: true,
      version: {
        ...updatedVersion,
        assets: updatedVersion.assets.map(asset => ({
          id: asset.id,
          asset: asset.asset,
          includeInEmail: asset.includeInEmail
        }))
      }
    })

  } catch (error) {
    console.error('Error marking follow-up as completed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}