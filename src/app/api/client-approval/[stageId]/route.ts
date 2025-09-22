import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/client-approval/[stageId] - Get client approval data for a stage
export async function GET(
  request: NextRequest,
  { params }: { params: { stageId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params

    // Get the stage info first
    const stage = await prisma.stage.findFirst({
      where: {
        id: stageId
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
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Get the current version with all related data
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

    // If no client approval version exists, check for available rendering versions to push
    if (!currentVersion) {
      // Look for completed rendering versions in the same room that haven't been pushed to client yet
      const availableRenderingVersions = await prisma.renderingVersion.findMany({
        where: {
          roomId: stage.roomId,
          status: 'COMPLETED',
          clientApprovalVersion: null // Not yet pushed to client
        },
        include: {
          assets: {
            where: {
              type: {
                in: ['RENDER', 'IMAGE', 'PDF']
              }
            }
          },
          createdBy: {
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

      return NextResponse.json({ 
        currentVersion: null,
        availableRenderingVersions: availableRenderingVersions.map(version => ({
          id: version.id,
          version: version.version,
          customName: version.customName,
          createdAt: version.createdAt,
          createdBy: version.createdBy,
          assetCount: version.assets.length,
          assets: version.assets.slice(0, 4).map(asset => ({
            id: asset.id,
            title: asset.title,
            url: asset.url,
            type: asset.type
          }))
        }))
      })
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

// POST /api/client-approval/[stageId] - Push a rendering version to client approval
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
    const { renderingVersionId } = body

    if (!renderingVersionId) {
      return NextResponse.json({ error: 'renderingVersionId is required' }, { status: 400 })
    }

    // Verify rendering version access and implement push logic
    const renderingVersion = await prisma.renderingVersion.findFirst({
      where: {
        id: renderingVersionId
      },
      include: {
        assets: {
          where: {
            type: {
              in: ['RENDER', 'IMAGE', 'PDF']
            }
          }
        },
        room: {
          include: {
            project: true
          }
        },
        stage: true,
        clientApprovalVersion: true
      }
    })

    if (!renderingVersion) {
      return NextResponse.json({ error: 'Rendering version not found' }, { status: 404 })
    }

    // Check if already pushed to client
    if (renderingVersion.clientApprovalVersion) {
      return NextResponse.json({ 
        error: 'This version has already been pushed to client approval',
        clientApprovalVersion: renderingVersion.clientApprovalVersion
      }, { status: 400 })
    }

    // Require at least one asset to push to client
    if (renderingVersion.assets.length === 0) {
      return NextResponse.json({ 
        error: 'Cannot push to client approval without any renderings' 
      }, { status: 400 })
    }

    // Get the current stage info
    const currentStage = await prisma.stage.findFirst({
      where: {
        id: stageId
      }
    })

    if (!currentStage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Use database transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update rendering version status
      await tx.renderingVersion.update({
        where: { id: renderingVersionId },
        data: {
          status: 'PUSHED_TO_CLIENT',
          pushedToClientAt: new Date(),
          updatedBy: {
            connect: {
              id: session.user.id
            }
          },
          updatedAt: new Date()
        }
      })

      // Create ClientApprovalVersion
      const clientApprovalVersion = await tx.clientApprovalVersion.create({
        data: {
          stageId: stageId,
          renderingVersionId: renderingVersionId,
          version: renderingVersion.version,
          status: 'DRAFT',
          approvedByAaron: false,
          clientDecision: 'PENDING'
        }
      })

      // Create ClientApprovalAsset entries for each rendering asset
      const clientApprovalAssets = []
      for (let i = 0; i < renderingVersion.assets.length; i++) {
        const asset = renderingVersion.assets[i]
        const clientApprovalAsset = await tx.clientApprovalAsset.create({
          data: {
            versionId: clientApprovalVersion.id,
            assetId: asset.id,
            includeInEmail: true, // Include all assets by default
            displayOrder: i
          }
        })
        clientApprovalAssets.push(clientApprovalAsset)
      }

      // Automatically start the Client Approval stage if it's not started
      let clientApprovalStageOpened = false
      if (currentStage.status === 'NOT_STARTED') {
        await tx.stage.update({
          where: { id: stageId },
          data: {
            status: 'IN_PROGRESS',
            startedAt: new Date(),
            updatedById: session.user.id,
            updatedAt: new Date()
          }
        })
        clientApprovalStageOpened = true
      }

      return {
        clientApprovalVersion: {
          ...clientApprovalVersion,
          assets: clientApprovalAssets.map(asset => ({
            id: asset.id,
            asset: renderingVersion.assets.find(a => a.id === asset.assetId),
            includeInEmail: asset.includeInEmail
          }))
        },
        clientApprovalStageOpened
      }
    })
    
    // Return the newly created client approval version
    return NextResponse.json({
      success: true,
      currentVersion: result.clientApprovalVersion,
      clientApprovalStageOpened: result.clientApprovalStageOpened
    }, { status: 201 })

  } catch (error) {
    console.error('Error pushing to client approval:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
