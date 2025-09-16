import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        name: string
      }
    } | null
    const resolvedParams = await params
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { sectionId, content, mentions = [] } = data

    // Verify stage access
    const stage = await prisma.stage.findFirst({
      where: {
        id: resolvedParams.id,
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      },
      include: {
        room: true
      }
    })

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        authorId: session.user.id,
        stageId: stage.id,
        sectionId,
        mentions: mentions.length > 0 ? JSON.stringify(mentions) : null
      },
      include: {
        author: {
          select: { name: true }
        }
      }
    })

    // If there are mentions, create notifications
    if (mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          name: {
            in: mentions.map((m: string) => m.replace('@', ''))
          },
          orgId: session.user.orgId
        }
      })

      // Create notifications for mentioned users
      await prisma.notification.createMany({
        data: mentionedUsers.map(user => ({
          userId: user.id,
          type: 'MENTION',
          title: `${session.user.name} mentioned you`,
          message: `You were mentioned in a comment on ${stage.room?.name || stage.room?.type}`,
          relatedId: comment.id,
          relatedType: 'COMMENT'
        }))
      })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
