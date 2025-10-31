import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const reactionSchema = z.object({
  emoji: z.string().min(1).max(10)
})

// POST /api/chat/messages/[messageId]/reactions - Add or toggle reaction
export async function POST(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await params
    const body = await request.json()

    // Validate input
    const { emoji } = reactionSchema.parse(body)

    // Check if user has access to the message
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        stage: {
          OR: [
            { assignedTo: session.user.id },
            { room: { project: { organization: { users: { some: { id: session.user.id } } } } } }
          ]
        }
      },
      select: {
        id: true,
        authorId: true,
        content: true
      }
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Check if user already reacted with this emoji
    const existingReaction = await prisma.chatMessageReaction.findFirst({
      where: {
        messageId,
        userId: session.user.id,
        emoji
      }
    })

    if (existingReaction) {
      // Remove existing reaction (toggle off)
      await prisma.chatMessageReaction.delete({
        where: { id: existingReaction.id }
      })

      // Get updated reaction count
      const reactionCount = await prisma.chatMessageReaction.count({
        where: { messageId, emoji }
      })

      return NextResponse.json({ 
        success: true, 
        action: 'removed',
        emoji,
        count: reactionCount
      })
    } else {
      // Add new reaction
      const newReaction = await prisma.chatMessageReaction.create({
        data: {
          messageId,
          userId: session.user.id,
          emoji
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

      // Notify message author if different from reactor
      if (message.authorId !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: message.authorId,
            type: 'MESSAGE_REACTION',
            title: 'Someone reacted to your message',
            message: `${session.user.name} reacted to your message with ${emoji}`,
            relatedId: messageId,
            relatedType: 'chat_message'
          }
        })
      }

      // Get updated reaction count
      const reactionCount = await prisma.chatMessageReaction.count({
        where: { messageId, emoji }
      })

      return NextResponse.json({ 
        success: true, 
        action: 'added',
        reaction: newReaction,
        count: reactionCount
      }, { status: 201 })
    }

  } catch (error) {
    console.error('Error handling reaction:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/chat/messages/[messageId]/reactions - Get message reactions
export async function GET(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await params

    // Check if user has access to the message
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        stage: {
          OR: [
            { assignedTo: session.user.id },
            { room: { project: { organization: { users: { some: { id: session.user.id } } } } } }
          ]
        }
      },
      select: { id: true }
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Get all reactions for the message
    const reactions = await prisma.chatMessageReaction.findMany({
      where: { messageId },
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
    })

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
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
      reactions: Object.values(groupedReactions),
      totalReactions: reactions.length
    })

  } catch (error) {
    console.error('Error fetching reactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
