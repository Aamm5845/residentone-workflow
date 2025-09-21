import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  withCreateAttribution, 
  withUpdateAttribution,
  withCompletionAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession
} from '@/lib/attribution'

// GET /api/renderings - List all rendering versions for a stage
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stageId')
    const roomId = searchParams.get('roomId')

    if (!stageId && !roomId) {
      return NextResponse.json({ error: 'stageId or roomId is required' }, { status: 400 })
    }

    const where: any = {}
    if (stageId) {
      where.stageId = stageId
    }
    if (roomId) {
      where.roomId = roomId
    }

    // Verify access through room/project ownership
    const accessQuery = roomId ? {
      room: {
        project: {
          orgId: session.user.orgId
        }
      }
    } : {
      stage: {
        room: {
          project: {
            orgId: session.user.orgId
          }
        }
      }
    }

    const renderingVersions = await prisma.renderingVersion.findMany({
      where: {
        ...where,
        ...accessQuery
      },
      include: {
        assets: {
          orderBy: { createdAt: 'asc' }
        },
        notes: {
          include: {
            author: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        updatedBy: {
          select: { id: true, name: true, email: true }
        },
        completedBy: {
          select: { id: true, name: true, email: true }
        },
        clientApprovalVersion: {
          select: { id: true, version: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ renderingVersions })
  } catch (error) {
    console.error('Error fetching rendering versions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/renderings - Create a new rendering version
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { roomId, stageId, customName } = data

    if (!roomId || !stageId) {
      return NextResponse.json({ error: 'roomId and stageId are required' }, { status: 400 })
    }

    // Verify room/stage access
    const stage = await prisma.stage.findFirst({
      where: {
        id: stageId,
        roomId: roomId,
        type: 'THREE_D',
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

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found or access denied' }, { status: 404 })
    }

    // Get the next version number for this room
    const lastVersion = await prisma.renderingVersion.findFirst({
      where: { roomId },
      orderBy: { createdAt: 'desc' }
    })

    const nextVersionNumber = lastVersion 
      ? parseInt(lastVersion.version.replace('V', '')) + 1 
      : 1

    const version = `V${nextVersionNumber}`

    // Create the new rendering version
    const renderingVersion = await prisma.renderingVersion.create({
      data: withCreateAttribution(session, {
        roomId,
        stageId,
        version,
        customName,
        status: 'IN_PROGRESS'
      }),
      include: {
        assets: true,
        notes: {
          include: {
            author: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    // Log activity
    await logActivity({
      session,
      action: ActivityActions.CREATE,
      entity: 'RENDERING_VERSION',
      entityId: renderingVersion.id,
      details: {
        version,
        roomName: stage.room.name || stage.room.type,
        projectName: stage.room.project.name,
        customName
      },
      ipAddress
    })

    return NextResponse.json(renderingVersion, { status: 201 })
  } catch (error) {
    console.error('Error creating rendering version:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}