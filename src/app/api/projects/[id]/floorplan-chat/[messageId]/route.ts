import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { isValidAuthSession } from '@/lib/attribution'
import { prisma } from '@/lib/prisma'

// PATCH - Edit a message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { content } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Find the message and verify ownership
    const existingMessage = await prisma.floorplanChatMessage.findFirst({
      where: {
        id: resolvedParams.messageId,
        projectId: resolvedParams.id,
        authorId: session.user.id
      }
    })

    if (!existingMessage) {
      return NextResponse.json({ error: 'Message not found or not authorized' }, { status: 404 })
    }

    // Update the message
    const message = await prisma.floorplanChatMessage.update({
      where: {
        id: resolvedParams.messageId
      },
      data: {
        content: content.trim(),
        editedAt: new Date()
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

    // Transform reactions
    const reactionMap = new Map<string, { emoji: string; count: number; users: any[]; userHasReacted: boolean }>()
    for (const reaction of message.reactions) {
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
        ...message,
        isEdited: true,
        reactions: Array.from(reactionMap.values())
      }
    })
  } catch (error) {
    console.error('Error updating floorplan chat message:', error)
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 })
  }
}

// DELETE - Delete a message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the message and verify ownership
    const existingMessage = await prisma.floorplanChatMessage.findFirst({
      where: {
        id: resolvedParams.messageId,
        projectId: resolvedParams.id,
        authorId: session.user.id
      }
    })

    if (!existingMessage) {
      return NextResponse.json({ error: 'Message not found or not authorized' }, { status: 404 })
    }

    // Delete the message
    await prisma.floorplanChatMessage.delete({
      where: {
        id: resolvedParams.messageId
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting floorplan chat message:', error)
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  }
}

