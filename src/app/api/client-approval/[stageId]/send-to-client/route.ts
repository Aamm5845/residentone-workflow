import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST /api/client-approval/[stageId]/send-to-client - Send approval email to client
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
    const { selectedAssetIds } = body

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

    if (!currentVersion.approvedByAaron) {
      return NextResponse.json({ error: 'Version must be approved by Aaron first' }, { status: 400 })
    }

    // Update selected assets
    if (selectedAssetIds && selectedAssetIds.length > 0) {
      // First, set all assets to not included
      await prisma.clientApprovalAsset.updateMany({
        where: {
          versionId: currentVersion.id
        },
        data: {
          includeInEmail: false
        }
      })

      // Then, set selected assets to included
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

    // Update the version to mark as sent
    const updatedVersion = await prisma.clientApprovalVersion.update({
      where: {
        id: currentVersion.id
      },
      data: {
        sentToClientAt: new Date(),
        sentById: session.user.id,
        status: 'SENT_TO_CLIENT'
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

    // TODO: Here you would integrate with your email service
    // For now, we'll just simulate the email being sent
    console.log(`📧 Would send email to: ${currentVersion.stage.room.project.client?.email}`)
    console.log(`📎 With ${selectedAssetIds?.length || 0} assets attached`)

    // Create activity log
    await prisma.activity.create({
      data: {
        stageId: currentVersion.stageId,
        type: 'EMAIL_SENT',
        message: `${currentVersion.version} sent to client - Approval email sent to client by ${session.user.name} with ${selectedAssetIds?.length || 0} assets`,
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
    console.error('Error sending to client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}