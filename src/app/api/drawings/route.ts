import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'

// GET /api/drawings?stageId=<stageId>
// Returns checklist items, assets grouped by category, and activity logs
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stageId')

    if (!stageId) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 })
    }

    // Verify user has access to this stage
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      include: {
        room: {
          include: {
            project: {
              include: {
                organization: true
              }
            }
          }
        },
        assignedUser: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    })

    if (!stage || stage.room.project.organization.id !== session.user.orgId) {
      return NextResponse.json({ error: 'Stage not found or access denied' }, { status: 404 })
    }

    // Ensure this is a DRAWINGS stage
    if (stage.type !== 'DRAWINGS') {
      return NextResponse.json({ error: 'Invalid stage type for drawings workspace' }, { status: 400 })
    }

    // Get or create default checklist items
    const existingItems = await prisma.drawingChecklistItem.findMany({
      where: { stageId },
      orderBy: { order: 'asc' },
      include: {
        assets: {
          include: {
            uploader: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    // Create default checklist items if none exist
    if (existingItems.length === 0) {
      const defaultItems = [
        { type: 'LIGHTING', name: 'Lighting Plans', order: 0 },
        { type: 'ELEVATION', name: 'Elevation Drawings', order: 1 },
        { type: 'MILLWORK', name: 'Millwork Details', order: 2 },
        { type: 'FLOORPLAN', name: 'Floor Plans', order: 3 }
      ]

      await prisma.drawingChecklistItem.createMany({
        data: defaultItems.map((item) => ({
          stageId,
          type: item.type as any,
          name: item.name,
          order: item.order
        }))
      })

      // Refetch after creation
      const newItems = await prisma.drawingChecklistItem.findMany({
        where: { stageId },
        orderBy: { order: 'asc' },
        include: {
          assets: {
            include: {
              uploader: {
                select: { id: true, name: true, email: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      })

      // Log activity for checklist creation
      await prisma.activityLog.create({
        data: {
          actorId: session.user.id,
          action: 'CREATE_DRAWINGS_CHECKLIST',
          entity: 'STAGE',
          entityId: stageId,
          details: {
            itemsCreated: defaultItems.length,
            items: defaultItems.map(item => item.name)
          },
          orgId: session.user.orgId
        }
      })

      return NextResponse.json({
        success: true,
        stage,
        checklistItems: newItems,
        activity: []
      })
    }

    // Get activity logs for this stage
    const activity = await prisma.activityLog.findMany({
      where: {
        entity: 'STAGE',
        entityId: stageId,
        action: {
          in: [
            'UPLOAD_DRAWING',
            'DELETE_DRAWING',
            'TOGGLE_CHECKLIST_ITEM',
            'COMPLETE_DRAWINGS_STAGE',
            'UPDATE_DRAWING_DESCRIPTION'
          ]
        }
      },
      include: {
        actor: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    return NextResponse.json({
      success: true,
      stage,
      checklistItems: existingItems,
      activity
    })

  } catch (error) {
    console.error('Error fetching drawings workspace:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
