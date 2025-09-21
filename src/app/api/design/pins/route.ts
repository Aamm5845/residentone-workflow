import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

// Pin or unpin an asset or comment
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { targetType, targetId, action } = data

    if (!targetType || !targetId || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields: targetType, targetId, action' 
      }, { status: 400 })
    }

    if (!['asset', 'comment'].includes(targetType)) {
      return NextResponse.json({
        error: 'targetType must be either "asset" or "comment"'
      }, { status: 400 })
    }

    if (!['pin', 'unpin'].includes(action)) {
      return NextResponse.json({
        error: 'action must be either "pin" or "unpin"'
      }, { status: 400 })
    }

    if (targetType === 'asset') {
      // Verify asset exists and user has access
      const asset = await prisma.asset.findFirst({
        where: {
          id: targetId,
          orgId: session.user.orgId
        }
      })

      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
      }

      if (action === 'pin') {
        // Pin the asset (ignore if already pinned)
        await prisma.assetPin.upsert({
          where: {
            assetId: targetId
          },
          update: {
            userId: session.user.id // Update who pinned it
          },
          create: {
            assetId: targetId,
            userId: session.user.id
          }
        })

        await logActivity({
          session,
          action: ActivityActions.ASSET_PINNED,
          entity: EntityTypes.ASSET,
          entityId: targetId,
          details: {
            assetTitle: asset.title,
            assetType: asset.type
          },
          ipAddress
        })
      } else {
        // Unpin the asset
        await prisma.assetPin.deleteMany({
          where: {
            assetId: targetId
          }
        })

        await logActivity({
          session,
          action: ActivityActions.ASSET_UNPINNED,
          entity: EntityTypes.ASSET,
          entityId: targetId,
          details: {
            assetTitle: asset.title,
            assetType: asset.type
          },
          ipAddress
        })
      }
    } else {
      // Handle comment pinning
      const comment = await prisma.comment.findFirst({
        where: {
          id: targetId,
          section: {
            stage: {
              room: {
                project: {
                  orgId: session.user.orgId
                }
              }
            }
          }
        }
      })

      if (!comment) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
      }

      if (action === 'pin') {
        await prisma.commentPin.upsert({
          where: {
            commentId: targetId
          },
          update: {
            userId: session.user.id
          },
          create: {
            commentId: targetId,
            userId: session.user.id
          }
        })

        await logActivity({
          session,
          action: ActivityActions.COMMENT_PINNED,
          entity: EntityTypes.COMMENT,
          entityId: targetId,
          details: {
            contentLength: comment.content.length
          },
          ipAddress
        })
      } else {
        await prisma.commentPin.deleteMany({
          where: {
            commentId: targetId
          }
        })

        await logActivity({
          session,
          action: ActivityActions.COMMENT_UNPINNED,
          entity: EntityTypes.COMMENT,
          entityId: targetId,
          details: {
            contentLength: comment.content.length
          },
          ipAddress
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${targetType} ${action}ned successfully`
    })

  } catch (error) {
    console.error('Error managing pin:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get pinned items for a section
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const sectionId = url.searchParams.get('sectionId')

    if (!sectionId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: sectionId' 
      }, { status: 400 })
    }

    // Verify section exists and user has access
    const section = await prisma.designSection.findFirst({
      where: {
        id: sectionId,
        stage: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Get pinned assets
    const pinnedAssets = await prisma.asset.findMany({
      where: {
        sectionId: sectionId,
        assetPin: {
          isNot: null
        }
      },
      include: {
        assetPin: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        uploader: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        assetPin: {
          createdAt: 'desc'
        }
      }
    })

    // Get pinned comments
    const pinnedComments = await prisma.comment.findMany({
      where: {
        sectionId: sectionId,
        commentPin: {
          isNot: null
        }
      },
      include: {
        commentPin: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        author: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: {
        commentPin: {
          createdAt: 'desc'
        }
      }
    })

    return NextResponse.json({
      success: true,
      pinnedAssets: pinnedAssets.map(asset => ({
        id: asset.id,
        title: asset.title,
        url: asset.url,
        type: asset.type,
        createdAt: asset.createdAt,
        uploadedBy: asset.uploader,
        pinnedBy: asset.assetPin?.user,
        pinnedAt: asset.assetPin?.createdAt
      })),
      pinnedComments: pinnedComments.map(comment => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        author: comment.author,
        pinnedBy: comment.commentPin?.user,
        pinnedAt: comment.commentPin?.createdAt
      }))
    })

  } catch (error) {
    console.error('Error fetching pinned items:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
