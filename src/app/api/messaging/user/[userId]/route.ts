import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'
import { getStageName } from '@/constants/workflow'

// GET /api/messaging/user/[userId] - Get all messages from a specific user
// Returns messages from phases where current user is assigned or was mentioned, plus general chat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUserId = session.user.id
    const orgId = session.user.orgId
    const targetUserId = resolvedParams.userId

    // Get the target user info
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        orgId: orgId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get messages from this user that are relevant to current user:
    // 1. Messages in phases assigned to current user (sent by target user)
    // 2. Messages where current user was mentioned (sent by target user)
    // 3. Messages in general chat (sent by target user)
    // 4. Also include current user's replies in those same conversations

    const messages = await prisma.chatMessage.findMany({
      where: {
        isDeleted: false,
        OR: [
          // Messages in phases assigned to current user
          {
            chatType: 'PHASE',
            stage: {
              assignedTo: currentUserId
            },
            OR: [
              { authorId: targetUserId },
              { authorId: currentUserId }
            ]
          },
          // Messages where current user was mentioned (in any phase)
          {
            chatType: 'PHASE',
            authorId: targetUserId,
            mentions: {
              some: {
                mentionedId: currentUserId
              }
            }
          },
          // General chat messages between the two users
          {
            chatType: 'GENERAL',
            orgId: orgId,
            OR: [
              { authorId: targetUserId },
              { authorId: currentUserId }
            ]
          }
        ]
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
        stage: {
          select: {
            id: true,
            type: true,
            room: {
              select: {
                id: true,
                name: true,
                type: true,
                project: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
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
      },
      orderBy: {
        createdAt: 'asc'
      },
      take: 500
    })

    // Group reactions by emoji for each message
    const messagesWithGroupedReactions = messages.map(msg => {
      const groupedReactions = msg.reactions.reduce((acc, reaction) => {
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

      // Add context info for phase messages
      let context = null
      if (msg.chatType === 'PHASE' && msg.stage) {
        context = {
          type: 'phase',
          stageId: msg.stage.id,
          stageName: getStageName(msg.stage.type),
          roomId: msg.stage.room.id,
          roomName: msg.stage.room.name || msg.stage.room.type.replace('_', ' '),
          projectId: msg.stage.room.project.id,
          projectName: msg.stage.room.project.name
        }
      } else if (msg.chatType === 'GENERAL') {
        context = {
          type: 'general',
          label: 'Team Chat'
        }
      }

      return {
        ...msg,
        reactions: Object.values(groupedReactions),
        context
      }
    })

    // Group messages by context (stage or general)
    const groupedMessages = messagesWithGroupedReactions.reduce((acc, msg) => {
      const contextKey = msg.context?.type === 'phase' 
        ? `phase_${msg.stage?.id}` 
        : 'general'
      
      if (!acc[contextKey]) {
        acc[contextKey] = {
          context: msg.context,
          messages: []
        }
      }
      acc[contextKey].messages.push(msg)
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      success: true,
      user: targetUser,
      conversations: Object.values(groupedMessages),
      allMessages: messagesWithGroupedReactions
    })

  } catch (error) {
    console.error('Error fetching user messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

