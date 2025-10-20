import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/client-approval/[stageId]/mark-as-sent - Mark as already sent to client manually
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const { stageId } = resolvedParams
    const body = await request.json()
    const { selectedAssetIds } = body

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
                uploadedByUser: {
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

    // Update the version to mark as sent manually
    const updatedVersion = await prisma.clientApprovalVersion.update({
      where: {
        id: currentVersion.id
      },
      data: {
        sentToClientAt: new Date(),
        sentById: session.user.id,
        status: 'SENT_TO_CLIENT',
        followUpNotes: 'Email sent manually outside of system'
      },
      include: {
        assets: {
          include: {
            asset: {
              include: {
                uploadedByUser: {
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

    // Update selected assets to be included in email (for tracking purposes)
    if (selectedAssetIds && selectedAssetIds.length > 0) {
      await prisma.clientApprovalAsset.updateMany({
        where: {
          versionId: currentVersion.id
        },
        data: {
          includeInEmail: false
        }
      })

      await prisma.clientApprovalAsset.updateMany({
        where: {
          versionId: currentVersion.id,
          id: {
            in: selectedAssetIds
          }
        },
        data: {
          includeInEmail: true
        }
      })
    }

    // Create activity log
    await prisma.activity.create({
      data: {
        stageId: currentVersion.stageId,
        type: 'MARKED_AS_SENT',
        message: `${currentVersion.version} marked as sent - Already sent to client manually by ${session.user.name}`,
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
    console.error('Error marking as sent:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}