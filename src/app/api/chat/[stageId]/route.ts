import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
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

// GET /api/chat/[stageId] - Get all chat messages for a stage
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this stage
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.stageId
      },
      include: {
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Get chat messages with author info and mentions
    const chatMessages = await prisma.chatMessage.findMany({
      where: {
        stageId: resolvedParams.stageId,
        isDeleted: false
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
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      messages: chatMessages,
      stage: {
        id: stage.id,
        type: stage.type,
        room: {
          id: stage.room.id,
          name: stage.room.name,
          project: {
            id: stage.room.project.id,
            name: stage.room.project.name
          }
        }
      }
    })

  } catch (error) {
    console.error('Error fetching chat messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/chat/[stageId] - Send a new chat message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { content, mentions = [] } = data

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }

    // Verify user has access to this stage
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.stageId
      },
      include: {
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Create the chat message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        content: content.trim(),
        authorId: session.user.id,
        stageId: resolvedParams.stageId
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
            image: true
          }
        }
      }
    })

    // Create mentions if any
    const mentionRecords = []
    if (mentions.length > 0) {
      // Validate mentioned users exist
      const validUsers = await prisma.user.findMany({
        where: {
          id: { in: mentions },
          orgId: { not: null } // Only active users
        },
        select: { id: true, name: true }
      })

      if (validUsers.length > 0) {
        const mentionData = validUsers.map(user => ({
          messageId: chatMessage.id,
          mentionedId: user.id
        }))

        const createdMentions = await prisma.chatMention.createMany({
          data: mentionData
        })

        // Create notifications for mentioned users
        const notificationData = validUsers.map(user => ({
          userId: user.id,
          type: 'MENTION' as const,
          title: `${session.user.name} mentioned you`,
          message: `You were mentioned in ${stage.type} - ${stage.room.name}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          relatedId: resolvedParams.stageId,
          relatedType: 'STAGE'
        }))

        await prisma.notification.createMany({
          data: notificationData
        })

        // Get the created mentions for response
        const fullMentions = await prisma.chatMention.findMany({
          where: {
            messageId: chatMessage.id
          },
          include: {
            mentionedUser: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        })
        
        mentionRecords.push(...fullMentions)
      }
    }

    // Log the activity
    await logActivity({
      session,
      action: 'CHAT_MESSAGE_SENT',
      entity: EntityTypes.STAGE,
      entityId: resolvedParams.stageId,
      details: {
        messageId: chatMessage.id,
        content: content.substring(0, 100),
        mentionsCount: mentionRecords.length,
        stageName: `${stage.type} - ${stage.room.name}`,
        projectName: stage.room.project.name
      },
      ipAddress
    })

    const responseMessage = {
      ...chatMessage,
      mentions: mentionRecords
    }

    return NextResponse.json({
      success: true,
      message: responseMessage
    })

  } catch (error) {
    console.error('Error sending chat message:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}