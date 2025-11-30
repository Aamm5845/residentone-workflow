import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import { prisma } from '@/lib/prisma'

// GET - Fetch reactions for a message
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch reactions for this message
    const reactions = await prisma.floorplanChatReaction.findMany({
      where: {
        messageId: resolvedParams.messageId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    // Transform reactions to group by emoji
    const reactionMap = new Map<string, { emoji: string; count: number; users: any[]; userHasReacted: boolean }>()
    for (const reaction of reactions) {
      const existing = reactionMap.get(reaction.emoji)
      if (existing) {
        existing.count++
        existing.users.push(reaction.user)
        if (reaction.userId === session.user.id) {
          existing.userHasReacted = true
        }
      } else {
        reactionMap.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          users: [reaction.user],
          userHasReacted: reaction.userId === session.user.id
        })
      }
    }

    return NextResponse.json({ 
      reactions: Array.from(reactionMap.values())
    })
  } catch (error) {
    console.error('Error fetching reactions:', error)
    return NextResponse.json({ error: 'Failed to fetch reactions' }, { status: 500 })
  }
}

// POST - Add or toggle a reaction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { emoji } = await request.json()

    if (!emoji) {
      return NextResponse.json({ error: 'Emoji is required' }, { status: 400 })
    }

    // Verify message exists
    const message = await prisma.floorplanChatMessage.findFirst({
      where: {
        id: resolvedParams.messageId,
        projectId: resolvedParams.id
      }
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check if user already reacted with this emoji
    const existingReaction = await prisma.floorplanChatReaction.findFirst({
      where: {
        messageId: resolvedParams.messageId,
        userId: session.user.id,
        emoji
      }
    })

    if (existingReaction) {
      // Remove the reaction (toggle off)
      await prisma.floorplanChatReaction.delete({
        where: {
          id: existingReaction.id
        }
      })
    } else {
      // Add the reaction
      await prisma.floorplanChatReaction.create({
        data: {
          messageId: resolvedParams.messageId,
          userId: session.user.id,
          emoji
        }
      })
    }

    // Fetch updated message with reactions
    const updatedMessage = await prisma.floorplanChatMessage.findUnique({
      where: {
        id: resolvedParams.messageId
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
        parentMessage: {
          include: {
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
      }
    })

    if (!updatedMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Transform reactions
    const reactionMap = new Map<string, { emoji: string; count: number; users: any[]; userHasReacted: boolean }>()
    for (const reaction of updatedMessage.reactions) {
      const existing = reactionMap.get(reaction.emoji)
      if (existing) {
        existing.count++
        existing.users.push(reaction.user)
        if (reaction.userId === session.user.id) {
          existing.userHasReacted = true
        }
      } else {
        reactionMap.set(reaction.emoji, {
          emoji: reaction.emoji,
          count: 1,
          users: [reaction.user],
          userHasReacted: reaction.userId === session.user.id
        })
      }
    }

    return NextResponse.json({ 
      message: {
        ...updatedMessage,
        isEdited: updatedMessage.editedAt !== null,
        reactions: Array.from(reactionMap.values())
      }
    })
  } catch (error) {
    console.error('Error toggling reaction:', error)
    return NextResponse.json({ error: 'Failed to toggle reaction' }, { status: 500 })
  }
}

