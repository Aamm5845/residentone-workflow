import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  withCreateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { sectionId, content, mentions = [] } = data

    if (!sectionId || !content?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields: sectionId and content' 
      }, { status: 400 })
    }

    // Verify section exists and user has access
    const section = await prisma.designSection.findFirst({
      where: {
        id: sectionId,
        stage: {
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        }
      },
      include: {
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

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: withCreateAttribution(session, {
        content: content.trim(),
        projectId: section.stage.room.project.id,
        roomId: section.stage.room.id,
        stageId: section.stage.id,
        sectionId: section.id,
        mentions: mentions.length > 0 ? JSON.stringify(mentions) : null
      }),
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    })

    // If there are mentions, create notifications
    if (mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          id: { in: mentions },
          orgId: session.user.orgId
        }
      })

      // Create notifications for mentioned users
      if (mentionedUsers.length > 0) {
        await prisma.notification.createMany({
          data: mentionedUsers.map(user => ({
            userId: user.id,
            type: 'MENTION' as any,
            title: `${session.user.name} mentioned you`,
            message: `You were mentioned in a comment on ${section.stage.room.name || section.stage.room.type} - Design Concept`,
            relatedId: section.stage.id,
            relatedType: 'STAGE'
          }))
        })
      }
    }

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.COMMENT_CREATED,
      entity: EntityTypes.COMMENT,
      entityId: comment.id,
      details: {
        sectionType: section.type,
        stageName: `${section.stage.type} - ${section.stage.room.name || section.stage.room.type}`,
        projectName: section.stage.room.project.name,
        hasMentions: mentions.length > 0,
        mentionCount: mentions.length
      },
      ipAddress
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Error creating design comment:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}