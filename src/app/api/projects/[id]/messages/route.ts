import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const messageSchema = z.object({
  content: z.string().min(1).max(2000),
  updateId: z.string().optional(),
  taskId: z.string().optional(),
  photoId: z.string().optional(),
  parentMessageId: z.string().optional(),
  attachments: z.array(z.object({
    url: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number()
  })).optional(),
  mentions: z.array(z.string()).optional()
})

// GET /api/projects/[id]/messages - Get project messages
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const updateId = searchParams.get('updateId')
    const taskId = searchParams.get('taskId')
    const photoId = searchParams.get('photoId')
    const parentMessageId = searchParams.get('parentMessageId')
    const search = searchParams.get('search')
    const authorId = searchParams.get('authorId')

    // Check if user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build filter conditions
    const where: any = {
      projectId,
      ...(updateId && { updateId }),
      ...(taskId && { taskId }),
      ...(photoId && { photoId }),
      ...(parentMessageId && { parentMessageId }),
      ...(authorId && { authorId }),
      ...(search && {
        OR: [
          { content: { contains: search, mode: 'insensitive' } },
          { author: { name: { contains: search, mode: 'insensitive' } } }
        ]
      })
    }

    const skip = (page - 1) * limit

    const [messages, total] = await Promise.all([
      prisma.projectUpdateMessage.findMany({
        where,
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
              status: true
            }
          },
          task: {
            select: {
              id: true,
              title: true,
              status: true
            }
          },
          photo: {
            select: {
              id: true,
              filename: true,
              url: true,
              type: true
            }
          },
          parentMessage: {
            select: {
              id: true,
              content: true,
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
                  image: true
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
            }
          },
          _count: {
            select: {
              replies: true,
              reactions: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.projectUpdateMessage.count({ where })
    ])

    // Get message statistics
    const stats = await prisma.projectUpdateMessage.groupBy({
      by: ['authorId'],
      where: { projectId },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })

    const authorStats = await Promise.all(
      stats.slice(0, 5).map(async (stat) => {
        const author = await prisma.user.findUnique({
          where: { id: stat.authorId },
          select: {
            id: true,
            name: true,
            image: true
          }
        })
        return {
          author,
          messageCount: stat._count.id
        }
      })
    )

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      stats: {
        totalMessages: total,
        topContributors: authorStats
      }
    })

  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/messages - Create new message
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()

    // Validate input
    const validatedData = messageSchema.parse(body)

    // Check if user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify related entities exist if provided
    if (validatedData.updateId) {
      const update = await prisma.projectUpdate.findFirst({
        where: { id: validatedData.updateId, projectId }
      })
      if (!update) {
        return NextResponse.json({ error: 'Related update not found' }, { status: 400 })
      }
    }

    if (validatedData.taskId) {
      const task = await prisma.projectUpdateTask.findFirst({
        where: { id: validatedData.taskId, projectId }
      })
      if (!task) {
        return NextResponse.json({ error: 'Related task not found' }, { status: 400 })
      }
    }

    if (validatedData.photoId) {
      const photo = await prisma.projectUpdatePhoto.findFirst({
        where: { id: validatedData.photoId, projectId }
      })
      if (!photo) {
        return NextResponse.json({ error: 'Related photo not found' }, { status: 400 })
      }
    }

    if (validatedData.parentMessageId) {
      const parentMessage = await prisma.projectUpdateMessage.findFirst({
        where: { id: validatedData.parentMessageId, projectId }
      })
      if (!parentMessage) {
        return NextResponse.json({ error: 'Parent message not found' }, { status: 400 })
      }
    }

    // Verify mentioned users exist
    if (validatedData.mentions && validatedData.mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          id: { in: validatedData.mentions },
          organization: { users: { some: { id: session.user.id } } }
        },
        select: { id: true, name: true, email: true }
      })

      if (mentionedUsers.length !== validatedData.mentions.length) {
        return NextResponse.json({ error: 'Some mentioned users not found' }, { status: 400 })
      }
    }

    // Create the message
    const newMessage = await prisma.projectUpdateMessage.create({
      data: {
        projectId,
        authorId: session.user.id,
        content: validatedData.content,
        updateId: validatedData.updateId,
        taskId: validatedData.taskId,
        photoId: validatedData.photoId,
        parentMessageId: validatedData.parentMessageId,
        attachments: validatedData.attachments || [],
        mentions: validatedData.mentions || []
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
        },
        parentMessage: {
          select: {
            id: true,
            content: true,
            author: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    // Create activity log
    let activityDescription = `Posted a message`
    if (validatedData.updateId) activityDescription += ` on update`
    if (validatedData.taskId) activityDescription += ` on task`
    if (validatedData.photoId) activityDescription += ` on photo`
    if (validatedData.parentMessageId) activityDescription += ` as a reply`

    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId: validatedData.updateId,
        actorId: session.user.id,
        actionType: 'CREATE',
        entityType: 'MESSAGE',
        entityId: newMessage.id,
        description: activityDescription,
        metadata: {
          messageId: newMessage.id,
          content: validatedData.content.substring(0, 100),
          hasAttachments: (validatedData.attachments?.length || 0) > 0,
          mentionCount: validatedData.mentions?.length || 0,
          isReply: !!validatedData.parentMessageId
        }
      }
    })

    // Send notifications for mentions
    if (validatedData.mentions && validatedData.mentions.length > 0) {
      const mentionNotifications = validatedData.mentions
        .filter(userId => userId !== session.user.id)
        .map(userId => ({
          userId,
          type: 'MESSAGE_MENTION' as const,
          title: 'You were mentioned in a message',
          message: `${session.user.name} mentioned you in a message: ${validatedData.content.substring(0, 100)}...`,
          relatedId: newMessage.id,
          relatedType: 'message' as const
        }))

      if (mentionNotifications.length > 0) {
        await prisma.notification.createMany({
          data: mentionNotifications
        })
      }
    }

    // Send notification for replies
    if (validatedData.parentMessageId) {
      const parentMessage = await prisma.projectUpdateMessage.findUnique({
        where: { id: validatedData.parentMessageId },
        select: { authorId: true }
      })

      if (parentMessage && parentMessage.authorId !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: parentMessage.authorId,
            type: 'MESSAGE_REPLY',
            title: 'Reply to your message',
            message: `${session.user.name} replied to your message`,
            relatedId: newMessage.id,
            relatedType: 'message'
          }
        })
      }
    }

    // Revalidate paths
    revalidatePath(`/projects/${projectId}/project-updates`)

    // TODO: Send real-time notification via WebSocket

    return NextResponse.json({ success: true, message: newMessage }, { status: 201 })

  } catch (error) {
    console.error('Error creating message:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}