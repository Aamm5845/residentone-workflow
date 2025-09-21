import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/client-approval/[stageId] - Get client approval workspace data
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

    // Get stage with related data
    const stage = await prisma.stage.findFirst({
      where: { 
        id: stageId,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        room: {
          include: {
            project: {
              include: {
                client: true
              }
            }
          }
        },
        clientApprovalVersions: {
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            assets: {
              include: {
                asset: {
                  include: {
                    uploader: {
                      select: { id: true, name: true, email: true }
                    }
                  }
                }
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
            emailLogs: {
              orderBy: {
                sentAt: 'desc'
              }
            },
            aaronApprovedBy: true,
            sentBy: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // If no versions exist, create a default draft version
    let currentVersion = stage.clientApprovalVersions[0]
    if (!currentVersion) {
      // Get assets from the 3D rendering stage (previous stage)
      const renderingStage = await prisma.stage.findFirst({
        where: {
          roomId: stage.roomId,
          type: 'THREE_D' // Correct enum value for 3D rendering stage
        },
        include: {
          assets: {
            where: {
              type: 'RENDER'
            }
          }
        }
      })

      // Create initial version
      currentVersion = await prisma.clientApprovalVersion.create({
        data: {
          stageId: stage.id,
          version: 'v1',
          status: 'PENDING_AARON_APPROVAL',
          assets: renderingStage?.assets ? {
            create: renderingStage.assets.map((asset, index) => ({
              assetId: asset.id,
              includeInEmail: true,
              displayOrder: index
            }))
          } : undefined,
          activityLogs: {
            create: {
              type: 'version_created',
              message: 'Initial version created',
              userId: session.user.id
            }
          }
        },
        include: {
          assets: {
            include: {
              asset: {
                include: {
                  uploader: {
                    select: { id: true, name: true, email: true }
                  }
                }
              }
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
    }

    return NextResponse.json({
      stage,
      currentVersion,
      client: stage.room.project.client
    })

  } catch (error) {
    console.error('Error fetching client approval data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}