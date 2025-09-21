import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  withCreateAttribution,
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { sectionId, content } = data

    if (!sectionId || !content?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields: sectionId and content' 
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
      }
    })

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Extract mentions from content (simple @username parsing)
    const mentionPattern = /@(\w+)/g
    const mentions = []
    let match
    while ((match = mentionPattern.exec(content)) !== null) {
      mentions.push(match[1])
    }

    // Create the comment/note
    const comment = await prisma.comment.create({
      data: withCreateAttribution(session, {
        content: content.trim(),
        authorId: session.user.id,
        projectId: section.stage.room.project.id,
        roomId: section.stage.room.id,
        stageId: section.stage.id,
        sectionId: section.id,
        mentions: mentions.length > 0 ? JSON.stringify(mentions) : null
      }),
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        commentTags: {
          include: {
            tag: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        commentPin: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.COMMENT_CREATED,
      entity: EntityTypes.COMMENT,
      entityId: comment.id,
      details: {
        sectionType: section.type,
        sectionName: section.type,
        stageName: `${section.stage.type} - ${section.stage.room.name || section.stage.room.type}`,
        projectName: section.stage.room.project.name,
        contentLength: content.length,
        hasMentions: mentions.length > 0,
        mentionCount: mentions.length
      },
      ipAddress
    })

    // TODO: Create notifications for mentioned users
    // This would integrate with your existing notification system

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: comment.author,
        mentions: mentions,
        tags: comment.commentTags.map(ct => ({
          id: ct.tag.id,
          name: ct.tag.name,
          type: ct.tag.type,
          color: ct.tag.color,
          taggedBy: ct.user
        })),
        pinnedBy: comment.commentPin ? comment.commentPin.user : null,
        isPinned: !!comment.commentPin
      }
    })

  } catch (error) {
    console.error('Error creating note:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

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

    // Get all comments/notes for this section
    const comments = await prisma.comment.findMany({
      where: {
        sectionId: sectionId
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        commentTags: {
          include: {
            tag: true,
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        commentPin: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: [
        {
          commentPin: {
            createdAt: 'desc'
          }
        },
        {
          createdAt: 'desc'
        }
      ]
    })

    return NextResponse.json({
      success: true,
      notes: comments.map(comment => {
        // Parse mentions from stored JSON
        let mentions = []
        try {
          mentions = comment.mentions ? JSON.parse(comment.mentions) : []
        } catch {
          mentions = []
        }

        return {
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          author: comment.author,
          mentions: mentions,
          tags: comment.commentTags.map(ct => ({
            id: ct.tag.id,
            name: ct.tag.name,
            type: ct.tag.type,
            color: ct.tag.color,
            taggedBy: ct.user
          })),
          pinnedBy: comment.commentPin ? comment.commentPin.user : null,
          isPinned: !!comment.commentPin
        }
      })
    })

  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { commentId, content } = data

    if (!commentId || !content?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields: commentId and content' 
      }, { status: 400 })
    }

    // Find the comment and verify user has access to edit
    const existingComment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        authorId: session.user.id, // Users can only edit their own comments
        section: {
          stage: {
            room: {
              project: {
                orgId: session.user.orgId
              }
            }
          }
        }
      },
      include: {
        section: {
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
          }
        }
      }
    })

    if (!existingComment) {
      return NextResponse.json({ 
        error: 'Comment not found or you do not have permission to edit it' 
      }, { status: 404 })
    }

    // Extract mentions from updated content
    const mentionPattern = /@(\w+)/g
    const mentions = []
    let match
    while ((match = mentionPattern.exec(content)) !== null) {
      mentions.push(match[1])
    }

    // Update the comment
    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: withUpdateAttribution(session, {
        content: content.trim(),
        mentions: mentions.length > 0 ? JSON.stringify(mentions) : null
      }),
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.COMMENT_UPDATED,
      entity: EntityTypes.COMMENT,
      entityId: commentId,
      details: {
        sectionType: existingComment.section?.type,
        sectionName: existingComment.section?.type,
        stageName: existingComment.section ? `${existingComment.section.stage.type} - ${existingComment.section.stage.room.name || existingComment.section.stage.room.type}` : undefined,
        projectName: existingComment.section?.stage.room.project.name,
        contentLength: content.length,
        hasMentions: mentions.length > 0,
        mentionCount: mentions.length
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      comment: {
        id: updatedComment.id,
        content: updatedComment.content,
        createdAt: updatedComment.createdAt,
        updatedAt: updatedComment.updatedAt,
        author: updatedComment.author,
        mentions: mentions
      }
    })

  } catch (error) {
    console.error('Error updating note:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const commentId = url.searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: commentId' 
      }, { status: 400 })
    }

    // Find the comment and verify user has access to delete
    const existingComment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        authorId: session.user.id, // Users can only delete their own comments
        section: {
          stage: {
            room: {
              project: {
                orgId: session.user.orgId
              }
            }
          }
        }
      },
      include: {
        section: {
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
          }
        }
      }
    })

    if (!existingComment) {
      return NextResponse.json({ 
        error: 'Comment not found or you do not have permission to delete it' 
      }, { status: 404 })
    }

    // Delete the comment (this will cascade to related records)
    await prisma.comment.delete({
      where: { id: commentId }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.COMMENT_DELETED,
      entity: EntityTypes.COMMENT,
      entityId: commentId,
      details: {
        sectionType: existingComment.section?.type,
        sectionName: existingComment.section?.type,
        stageName: existingComment.section ? `${existingComment.section.stage.type} - ${existingComment.section.stage.room.name || existingComment.section.stage.room.type}` : undefined,
        projectName: existingComment.section?.stage.room.project.name,
        contentLength: existingComment.content.length
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: 'Note deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting note:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}