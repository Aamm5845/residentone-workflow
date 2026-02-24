import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const messageUpdateSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  attachments: z.array(z.object({
    url: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number()
  })).optional()
})

const reactionSchema = z.object({
  emoji: z.string().min(1).max(10)
})

// GET /api/projects/[id]/messages/[messageId] - Get specific message
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, messageId } = await params

    // Check if user has access to project and message
    const message = await prisma.projectUpdateMessage.findFirst({
      where: {
        id: messageId,
        projectId,
        project: {
          OR: [
            { createdById: session.user.id },
            { updatedById: session.user.id },
            { organization: { users: { some: { id: session.user.id } } } }
          ]
        }
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true
          }
        },
        update: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            category: true
          }
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true
          }
        },
        photo: {
          select: {
            id: true,
            filename: true,
            url: true,
            type: true,
            metadata: true
          }
        },
        parentMessage: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                image: true,
                role: true
              }
            },
            reactions: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true
                  }
                }
              }
            },
            _count: {
              select: {
                reactions: true,
                replies: true
              }
            }
          }
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            replies: true,
            reactions: true
          }
        }
      }
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Group reactions by emoji
    const groupedReactions = message.reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          userHasReacted: false
        }
      }
      acc[reaction.emoji].count++
      acc[reaction.emoji].users.push(reaction.user)
      if (reaction.userId === session.user.id) {
        acc[reaction.emoji].userHasReacted = true
      }
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      ...message,
      groupedReactions: Object.values(groupedReactions)
    })

  } catch (error) {
    console.error('Error fetching message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id]/messages/[messageId] - Update specific message
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, messageId } = await params
    const body = await request.json()

    // Validate input
    const validatedData = messageUpdateSchema.parse(body)

    // Check if user has access to project and message
    const existingMessage = await prisma.projectUpdateMessage.findFirst({
      where: {
        id: messageId,
        projectId,
        project: {
          OR: [
            { createdById: session.user.id },
            { updatedById: session.user.id },
            { organization: { users: { some: { id: session.user.id } } } }
          ]
        }
      }
    })

    if (!existingMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check permissions - only message author can edit
    if (existingMessage.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Only message author can edit messages' }, { status: 403 })
    }

    // Check if message is not too old (e.g., 24 hours)
    const messageAge = Date.now() - existingMessage.createdAt.getTime()
    const maxEditTime = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    
    if (messageAge > maxEditTime) {
      return NextResponse.json({ error: 'Message is too old to edit' }, { status: 400 })
    }

    // Update the message
    const updatedMessage = await prisma.projectUpdateMessage.update({
      where: { id: messageId },
      data: {
        ...validatedData,
        editedAt: new Date()
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true
          }
        },
        update: {
          select: {
            id: true,
            title: true,
            type: true
          }
        },
        task: {
          select: {
            id: true,
            title: true
          }
        },
        photo: {
          select: {
            id: true,
            filename: true,
            url: true
          }
        }
      }
    })

    // Create activity log for edit
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId: existingMessage.updateId,
        actorId: session.user.id,
        actionType: 'UPDATE',
        entityType: 'MESSAGE',
        entityId: messageId,
        description: `Edited a message`,
        metadata: {
          messageId,
          previousContent: existingMessage.content.substring(0, 100),
          newContent: validatedData.content?.substring(0, 100),
          editedAt: new Date().toISOString()
        }
      }
    })

    // Revalidate paths
    revalidatePath(`/projects/${projectId}/project-updates`)

    // TODO: Send real-time notification via WebSocket

    return NextResponse.json({ success: true, message: updatedMessage })

  } catch (error) {
    console.error('Error updating message:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/messages/[messageId] - Delete specific message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, messageId } = await params

    // Check if user has access to project and message
    const existingMessage = await prisma.projectUpdateMessage.findFirst({
      where: {
        id: messageId,
        projectId,
        project: {
          OR: [
            { createdById: session.user.id },
            { updatedById: session.user.id },
            { organization: { users: { some: { id: session.user.id } } } }
          ]
        }
      },
      include: {
        _count: {
          select: {
            replies: true
          }
        }
      }
    })

    if (!existingMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check permissions - only message author or admin can delete
    const isAuthor = existingMessage.authorId === session.user.id
    const isAdmin = ['OWNER', 'ADMIN'].includes(session.user.role)

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: 'Only message author or admin can delete messages' }, { status: 403 })
    }

    // If message has replies, soft delete by clearing content instead of hard delete
    if (existingMessage._count.replies > 0) {
      await prisma.projectUpdateMessage.update({
        where: { id: messageId },
        data: {
          content: '[This message has been deleted]',
          attachments: [],
          mentions: [],
          deletedAt: new Date()
        }
      })
    } else {
      // Hard delete if no replies
      await prisma.projectUpdateMessage.delete({
        where: { id: messageId }
      })
    }

    // Create activity log
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId: existingMessage.updateId,
        actorId: session.user.id,
        actionType: 'DELETE',
        entityType: 'MESSAGE',
        entityId: messageId,
        description: `Deleted a message`,
        metadata: {
          messageId,
          deletedContent: existingMessage.content.substring(0, 100),
          hadReplies: existingMessage._count.replies > 0,
          deletionType: existingMessage._count.replies > 0 ? 'soft' : 'hard'
        }
      }
    })

    // Revalidate paths
    revalidatePath(`/projects/${projectId}/project-updates`)

    // TODO: Send real-time notification via WebSocket

    return NextResponse.json({ 
      success: true, 
      message: 'Message deleted successfully' 
    })

  } catch (error) {
    console.error('Error deleting message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}