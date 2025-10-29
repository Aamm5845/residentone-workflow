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
import { getStageName } from '@/constants/workflow'
import { sendMentionSMS } from '@/lib/twilio'

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
        select: { 
          id: true, 
          name: true,
          phoneNumber: true,
          smsNotificationsEnabled: true
        }
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
          message: `You were mentioned in ${getStageName(stage.type)} - ${stage.room.name} (${stage.room.project.name}): ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          relatedId: resolvedParams.stageId,
          relatedType: 'STAGE'
        }))

        await prisma.notification.createMany({
          data: notificationData
        })

        // Send SMS notifications to mentioned users with SMS enabled
        const usersForSMS = validUsers.filter(user => user.phoneNumber && user.smsNotificationsEnabled)
        console.log(`[SMS] Found ${usersForSMS.length} user(s) eligible for SMS:`, 
          usersForSMS.map(u => ({ name: u.name, phone: u.phoneNumber })))
        
        const smsPromises = usersForSMS.map(async (user) => {
            try {
              console.log(`[SMS] Attempting to send to ${user.name} at ${user.phoneNumber}...`)
              await sendMentionSMS({
                to: user.phoneNumber!,
                mentionedBy: session.user.name || 'Someone',
                stageName: getStageName(stage.type),
                projectName: stage.room.project.name,
                message: content.trim(),
                stageId: resolvedParams.stageId
              })
              console.log(`[SMS] ✅ Successfully sent to ${user.name} at ${user.phoneNumber}`)
              
              // Track this SMS conversation for reply routing
              const existingConvo = await prisma.smsConversation.findFirst({
                where: {
                  userId: user.id,
                  stageId: resolvedParams.stageId
                }
              })
              
              if (existingConvo) {
                await prisma.smsConversation.update({
                  where: { id: existingConvo.id },
                  data: { lastMessageAt: new Date() }
                })
              } else {
                await prisma.smsConversation.create({
                  data: {
                    userId: user.id,
                    phoneNumber: user.phoneNumber!,
                    stageId: resolvedParams.stageId,
                    lastMessageAt: new Date()
                  }
                })
              }
            } catch (error) {
              console.error(`[SMS] ❌ Failed to send SMS to ${user.name}:`, error)
              // Don't fail the whole request if SMS fails
            }
          })
        
        // Send all SMS in parallel but don't wait for them
        Promise.all(smsPromises).catch(err => 
          console.error('[SMS] Some SMS notifications failed:', err)
        )

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