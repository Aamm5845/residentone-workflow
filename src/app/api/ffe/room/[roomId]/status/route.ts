import { NextRequest, NextResponse } from 'next/server'
import { validateFFECompletion, generateFFECompletionReport } from '@/lib/ffe/completion-validator'
import { getFFEItemsForRoom } from '@/lib/ffe/library-manager'
import { getDefaultFFEConfig } from '@/lib/constants/room-ffe-config'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/auth'

// Get FFE status and checklist for a room
export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await params

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

// Update FFE completion status for the room
export async function PUT(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = await params
    const body = await request.json()
    const { action } = body

    if (action === 'complete_stage') {
      // Complete the FFE stage
      const completionResult = await validateFFECompletion(roomId)
      
      if (!completionResult.isComplete && !completionResult.canForceComplete) {
        return NextResponse.json({
          error: 'Cannot complete FFE stage',
          issues: completionResult.issues,
          missingRequired: completionResult.missingRequired.map(item => item.name)
        }, { status: 400 })
      }

      // Update room FFE progress to completed
      await prisma.room.update({
        where: { id: roomId },
        data: {
          progressFFE: 100
        }
      })

      return NextResponse.json({ success: true, completed: true })
    }

    if (action === 'generate_report') {
      const report = await generateFFECompletionReport(roomId)
      return NextResponse.json({ report })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Error updating FFE status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
