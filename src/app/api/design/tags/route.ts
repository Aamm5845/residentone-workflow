import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  withCreateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

// Get all tags for organization or apply/remove tags
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all tags for the organization
    const tags = await prisma.tag.findMany({
      where: {
        orgId: session.user.orgId
      },
      include: {
        _count: {
          select: {
            assetTags: true,
            commentTags: true
          }
        }
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      tags: tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        type: tag.type,
        color: tag.color,
        description: tag.description,
        usageCount: tag._count.assetTags + tag._count.commentTags,
        createdAt: tag.createdAt
      }))
    })

  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// Create a new custom tag
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { name, color, description } = data

    if (!name?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required field: name' 
      }, { status: 400 })
    }

    // Check if tag with same name already exists in organization
    const existingTag = await prisma.tag.findUnique({
      where: {
        orgId_name: {
          orgId: session.user.orgId,
          name: name.trim()
        }
      }
    })

    if (existingTag) {
      return NextResponse.json({
        error: 'A tag with this name already exists'
      }, { status: 409 })
    }

    // Create the new tag
    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        type: 'CUSTOM',
        color: color || '#6B7280', // Default gray color
        description: description?.trim() || null,
        orgId: session.user.orgId
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.TAG_CREATED,
      entity: EntityTypes.TAG,
      entityId: tag.id,
      details: {
        tagName: tag.name,
        tagType: tag.type,
        hasColor: !!tag.color,
        hasDescription: !!tag.description
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      tag: {
        id: tag.id,
        name: tag.name,
        type: tag.type,
        color: tag.color,
        description: tag.description,
        createdAt: tag.createdAt
      }
    })

  } catch (error) {
    console.error('Error creating tag:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Apply or remove tag from asset/comment
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { tagId, targetType, targetId, action } = data

    if (!tagId || !targetType || !targetId || !action) {
      return NextResponse.json({ 
        error: 'Missing required fields: tagId, targetType, targetId, action' 
      }, { status: 400 })
    }

    if (!['asset', 'comment'].includes(targetType)) {
      return NextResponse.json({
        error: 'targetType must be either "asset" or "comment"'
      }, { status: 400 })
    }

    if (!['add', 'remove'].includes(action)) {
      return NextResponse.json({
        error: 'action must be either "add" or "remove"'
      }, { status: 400 })
    }

    // Verify tag exists and belongs to user's org
    const tag = await prisma.tag.findFirst({
      where: {
        id: tagId,
        orgId: session.user.orgId
      }
    })

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
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

      if (action === 'add') {
        // Add tag to asset (ignore if already exists)
        await prisma.assetTag.upsert({
          where: {
            assetId_tagId: {
              assetId: targetId,
              tagId: tagId
            }
          },
          update: {},
          create: {
            assetId: targetId,
            tagId: tagId,
            userId: session.user.id
          }
        })

        await logActivity({
          session,
          action: ActivityActions.ASSET_TAGGED,
          entity: EntityTypes.ASSET,
          entityId: targetId,
          details: {
            tagName: tag.name,
            tagType: tag.type,
            assetTitle: asset.title
          },
          ipAddress
        })
      } else {
        // Remove tag from asset
        await prisma.assetTag.deleteMany({
          where: {
            assetId: targetId,
            tagId: tagId
          }
        })

        await logActivity({
          session,
          action: ActivityActions.ASSET_UNTAGGED,
          entity: EntityTypes.ASSET,
          entityId: targetId,
          details: {
            tagName: tag.name,
            tagType: tag.type,
            assetTitle: asset.title
          },
          ipAddress
        })
      }
    } else {
      // Handle comment tagging
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

      if (action === 'add') {
        await prisma.commentTag.upsert({
          where: {
            commentId_tagId: {
              commentId: targetId,
              tagId: tagId
            }
          },
          update: {},
          create: {
            commentId: targetId,
            tagId: tagId,
            userId: session.user.id
          }
        })

        await logActivity({
          session,
          action: ActivityActions.COMMENT_TAGGED,
          entity: EntityTypes.COMMENT,
          entityId: targetId,
          details: {
            tagName: tag.name,
            tagType: tag.type
          },
          ipAddress
        })
      } else {
        await prisma.commentTag.deleteMany({
          where: {
            commentId: targetId,
            tagId: tagId
          }
        })

        await logActivity({
          session,
          action: ActivityActions.COMMENT_UNTAGGED,
          entity: EntityTypes.COMMENT,
          entityId: targetId,
          details: {
            tagName: tag.name,
            tagType: tag.type
          },
          ipAddress
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Tag ${action === 'add' ? 'added to' : 'removed from'} ${targetType} successfully`
    })

  } catch (error) {
    console.error('Error managing tag:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// Delete a custom tag
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const tagId = url.searchParams.get('tagId')

    if (!tagId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: tagId' 
      }, { status: 400 })
    }

    // Find the tag and verify user has access
    const tag = await prisma.tag.findFirst({
      where: {
        id: tagId,
        orgId: session.user.orgId,
        type: 'CUSTOM' // Only custom tags can be deleted
      }
    })

    if (!tag) {
      return NextResponse.json({ 
        error: 'Custom tag not found or cannot be deleted' 
      }, { status: 404 })
    }

    // Delete the tag (this will cascade to related AssetTag and CommentTag records)
    await prisma.tag.delete({
      where: { id: tagId }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.TAG_DELETED,
      entity: EntityTypes.TAG,
      entityId: tagId,
      details: {
        tagName: tag.name,
        tagType: tag.type
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: 'Tag deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}