import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

// PUT /api/chat/messages/[messageId] - Edit a chat message
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
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

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Find the message and verify ownership
    const existingMessage = await prisma.chatMessage.findFirst({
      where: {
        id: resolvedParams.messageId,
        isDeleted: false
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
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

    if (!existingMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Only the author can edit their message
    if (existingMessage.authorId !== session.user.id) {
      return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 })
    }

    // Update the message
    const updatedMessage = await prisma.chatMessage.update({
      where: {
        id: resolvedParams.messageId
      },
      data: {
        content: content.trim(),
        editedAt: new Date(),
        isEdited: true,
        updatedAt: new Date()
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            image: true
          }
        },
        mentions: {
          include: {
            mentionedUser: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: 'CHAT_MESSAGE_EDITED',
      entity: EntityTypes.STAGE,
      entityId: existingMessage.stageId,
      details: {
        messageId: resolvedParams.messageId,
        newContent: content.substring(0, 100),
        stageName: `${existingMessage.stage.type} - ${existingMessage.stage.room.name}`,
        projectName: existingMessage.stage.room.project.name
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: updatedMessage
    })

  } catch (error) {
    console.error('Error editing chat message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/chat/messages/[messageId] - Delete a chat message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the message and verify ownership
    const existingMessage = await prisma.chatMessage.findFirst({
      where: {
        id: resolvedParams.messageId,
        isDeleted: false
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
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

    if (!existingMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Only the author or admin can delete the message
    const canDelete = existingMessage.authorId === session.user.id || 
                     ['OWNER', 'ADMIN'].includes(session.user.role)

    if (!canDelete) {
      return NextResponse.json({ 
        error: 'You can only delete your own messages or must be an admin' 
      }, { status: 403 })
    }

    // Soft delete the message
    const deletedMessage = await prisma.chatMessage.update({
      where: {
        id: resolvedParams.messageId
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: 'CHAT_MESSAGE_DELETED',
      entity: EntityTypes.STAGE,
      entityId: existingMessage.stageId,
      details: {
        messageId: resolvedParams.messageId,
        originalContent: existingMessage.content.substring(0, 100),
        originalAuthor: existingMessage.author.name,
        stageName: `${existingMessage.stage.type} - ${existingMessage.stage.room.name}`,
        projectName: existingMessage.stage.room.project.name,
        deletedByAdmin: existingMessage.authorId !== session.user.id
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting chat message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}