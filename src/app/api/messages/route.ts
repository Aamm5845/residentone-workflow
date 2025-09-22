import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { 
  withCreateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { message, sectionId, roomId } = data

    console.log('📝 Creating message:', { hasMessage: !!message, sectionId, roomId })

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Try to find the section to validate access
    let section = null
    if (sectionId) {
      section = await prisma.designSection.findFirst({
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
    }

    // If no section but we have roomId, try to find or create a default section
    if (!section && roomId) {
      const stage = await prisma.stage.findFirst({
        where: {
          type: 'DESIGN_CONCEPT',
          roomId: roomId,
          room: {
            project: {
              orgId: session.user.orgId
            }
          }
        },
        include: {
          room: {
            include: {
              project: true
            }
          }
        }
      })

      if (stage) {
        // Try to find or create a GENERAL section
        section = await prisma.designSection.findFirst({
          where: {
            stageId: stage.id,
            type: 'GENERAL'
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
          section = await prisma.designSection.create({
            data: {
              type: 'GENERAL',
              stageId: stage.id,
              content: 'General design discussion'
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
        }
      }
    }

    if (!section) {
      return NextResponse.json({ 
        error: 'Section not found or access denied' 
      }, { status: 404 })
    }

    // Create the comment in the database
    const comment = await prisma.comment.create({
      data: withCreateAttribution(session, {
        content: message.trim(),
        projectId: section.stage.room.project.id,
        roomId: section.stage.room.id,
        stageId: section.stage.id,
        sectionId: section.id
      }),
      include: {
        author: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.COMMENT_CREATED,
      entity: EntityTypes.COMMENT,
      entityId: comment.id,
      details: {
        sectionType: section.type,
        stageName: `${section.stage.type} - ${section.stage.room.name || section.stage.room.type}`,
        projectName: section.stage.room.project.name
      },
      ipAddress
    })

    // Format response as expected by design-board.tsx
    const responseMessage = {
      id: comment.id,
      message: comment.content,
      createdAt: comment.createdAt.toISOString(),
      author: {
        id: comment.author.id,
        name: comment.author.name,
        role: comment.author.role
      },
      sectionId: comment.sectionId,
      roomId: comment.roomId
    }

    return NextResponse.json({
      success: true,
      message: responseMessage
    })

  } catch (error) {
    console.error('Error posting message:', error)
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId')
    const roomId = searchParams.get('roomId')

    console.log('📥 Fetching messages for:', { sectionId, roomId })

    let whereClause: any = {
      orgId: session.user.orgId
    }

    if (sectionId) {
      whereClause.sectionId = sectionId
    } else if (roomId) {
      whereClause.roomId = roomId
    } else {
      return NextResponse.json({ 
        error: 'Missing required parameter: sectionId or roomId' 
      }, { status: 400 })
    }

    // Get comments/messages from database
    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Limit to most recent 50 messages
    })

    // Format as expected by design-board.tsx
    const messages = comments.map(comment => ({
      id: comment.id,
      message: comment.content,
      createdAt: comment.createdAt.toISOString(),
      author: {
        id: comment.author.id,
        name: comment.author.name,
        role: comment.author.role
      },
      sectionId: comment.sectionId,
      roomId: comment.roomId
    }))

    return NextResponse.json({
      success: true,
      messages: messages
    })

  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}
