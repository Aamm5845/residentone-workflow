import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find comment and verify access
    const comment = await prisma.comment.findFirst({
      where: {
        id: resolvedParams.id,
        project: {
          orgId: session.user.orgId
        }
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        section: {
          select: { type: true }
        }
      }
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    return NextResponse.json(comment)
  } catch (error) {
    console.error('Error fetching comment:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { content } = data

    if (!content?.trim()) {
      return NextResponse.json({ 
        error: 'Content is required' 
      }, { status: 400 })
    }

    // Find comment and verify access and ownership
    const existingComment = await prisma.comment.findFirst({
      where: {
        id: resolvedParams.id,
        authorId: session.user.id, // Only author can edit
        project: {
          orgId: session.user.orgId
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

    // Update comment
    const updatedComment = await prisma.comment.update({
      where: { id: resolvedParams.id },
      data: withUpdateAttribution(session, {
        content: content.trim()
      }),
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.COMMENT_UPDATED,
      entity: EntityTypes.COMMENT,
      entityId: updatedComment.id,
      details: {
        sectionType: existingComment.section?.type,
        stageName: existingComment.section ? `${existingComment.section.stage.type} - ${existingComment.section.stage.room.name || existingComment.section.stage.room.type}` : undefined,
        projectName: existingComment.section?.stage.room.project.name
      },
      ipAddress
    })

    return NextResponse.json(updatedComment)
  } catch (error) {
    console.error('Error updating comment:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find comment and verify access and ownership
    const existingComment = await prisma.comment.findFirst({
      where: {
        id: resolvedParams.id,
        authorId: session.user.id, // Only author can delete
        project: {
          orgId: session.user.orgId
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

    // Delete comment
    await prisma.comment.delete({
      where: { id: resolvedParams.id }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.COMMENT_DELETED,
      entity: EntityTypes.COMMENT,
      entityId: resolvedParams.id,
      details: {
        sectionType: existingComment.section?.type,
        stageName: existingComment.section ? `${existingComment.section.stage.type} - ${existingComment.section.stage.room.name || existingComment.section.stage.room.type}` : undefined,
        projectName: existingComment.section?.stage.room.project.name,
        originalContent: existingComment.content
      },
      ipAddress
    })

    return NextResponse.json({ 
      success: true,
      message: 'Comment deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}