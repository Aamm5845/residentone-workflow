import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/auth'

// POST /api/drawings/{stageId}/checklist/add
// Add a custom checklist item to a drawings stage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stageId } = await params
    const { name } = await request.json()

    if (!stageId || !name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Stage ID and name are required' 
      }, { status: 400 })
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

    // Get the current max order to add the new item at the end
    const maxOrder = await prisma.drawingChecklistItem.findFirst({
      where: { stageId },
      orderBy: { order: 'desc' },
      select: { order: true }
    })

    const newOrder = (maxOrder?.order ?? -1) + 1

    // Create the custom checklist item
    const newItem = await prisma.drawingChecklistItem.create({
      data: {
        stageId,
        type: 'CUSTOM',
        name: name.trim(),
        order: newOrder,
        completed: false
      },
      include: {
        assets: {
          include: {
            uploadedByUser: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        dropboxFiles: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    // Log activity
    await prisma.activityLog.create({
      data: {
        actorId: session.user.id,
        action: 'ADD_CUSTOM_CHECKLIST_ITEM',
        entity: 'STAGE',
        entityId: stageId,
        details: {
          checklistItemId: newItem.id,
          checklistItemName: newItem.name,
          order: newItem.order
        },
        orgId: session.user.orgId
      }
    })

    return NextResponse.json({
      success: true,
      checklistItem: newItem
    }, { status: 201 })

  } catch (error) {
    console.error('Error adding custom checklist item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
