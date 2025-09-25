import { NextRequest, NextResponse } from 'next/server'
import { validateFFECompletion, updateFFEItemState, generateFFECompletionReport } from '@/lib/ffe/completion-validator'
import { getFFEItemsForRoom, autoAddToLibraryIfNew } from '@/lib/ffe/library-manager'
import { getDefaultFFEConfig, type FFEItemState } from '@/lib/constants/room-ffe-config'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/auth'

// Get FFE checklist and status for a room
export async function GET(request: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roomId = params.roomId

    // Get room information
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        project: {
          include: {
            organization: true
          }
        },
        ffeItemStatuses: {
          include: {
            createdBy: { select: { name: true } },
            updatedBy: { select: { name: true } }
          }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get FFE items for this room type (default + custom)
    const ffeItems = await getFFEItemsForRoom(room.project.organization.id, room.type)
    const defaultConfig = getDefaultFFEConfig(room.type)

    // Build status map
    const statusMap: Record<string, any> = {}
    room.ffeItemStatuses.forEach(status => {
      statusMap[status.itemId] = {
        state: status.state,
        isCustomExpanded: status.isCustomExpanded,
        subItemStates: status.subItemStates as Record<string, string>,
        notes: status.notes,
        confirmedAt: status.confirmedAt,
        createdBy: status.createdBy.name,
        updatedBy: status.updatedBy?.name
      }
    })

    // Get completion validation
    const completionResult = await validateFFECompletion(roomId)

    return NextResponse.json({
      room: {
        id: room.id,
        type: room.type,
        name: room.name
      },
      categories: defaultConfig?.categories || [],
      customItems: ffeItems.customItems,
      itemStatuses: statusMap,
      completion: completionResult
    })

  } catch (error) {
    console.error('Error getting FFE status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update FFE item state
export async function PUT(request: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roomId = params.roomId
    const body = await request.json()
    const { itemId, state, notes, subItemStates, isCustomExpanded } = body

    if (!itemId || !state) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate state
    if (!['pending', 'confirmed', 'not_needed'].includes(state)) {
      return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
    }

    // Update the item state
    await updateFFEItemState(
      roomId,
      itemId,
      state as FFEItemState,
      session.user.id,
      notes,
      subItemStates,
      isCustomExpanded
    )

    // Get updated completion status
    const completionResult = await validateFFECompletion(roomId)

    return NextResponse.json({
      success: true,
      completion: completionResult
    })

  } catch (error) {
    console.error('Error updating FFE item state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Add custom FFE item
export async function POST(request: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const roomId = params.roomId
    const body = await request.json()
    const { itemId, name, category, isRequired, isStandard, subItems } = body

    if (!itemId || !name || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get room info
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        project: {
          include: {
            organization: true
          }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Auto-add to organization library
    await autoAddToLibraryIfNew(
      room.project.organization.id,
      room.project.id,
      roomId,
      itemId,
      name,
      category,
      room.type,
      session.user.id,
      {
        isRequired: isRequired || false,
        isStandard: isStandard || true,
        subItems: subItems || []
      }
    )

    // Create initial item status
    await updateFFEItemState(
      roomId,
      itemId,
      'pending',
      session.user.id
    )

    return NextResponse.json({ success: true, message: 'Custom item added' })

  } catch (error) {
    console.error('Error adding custom FFE item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}