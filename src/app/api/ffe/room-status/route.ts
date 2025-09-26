import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Get FFE item statuses for a room
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // Get all FFE item statuses for this room
    const statuses = await prisma.fFEItemStatus.findMany({
      where: { roomId },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json({ 
      statuses: statuses.map(status => ({
        itemId: status.itemId,
        state: status.state,
        selectionType: status.selectionType,
        customOptions: status.customOptions,
        standardProduct: status.standardProduct,
        notes: status.notes,
        updatedAt: status.updatedAt.toISOString()
      }))
    })

  } catch (error) {
    console.error('Error fetching FFE room statuses:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Update or create an FFE item status
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      roomId, 
      itemId, 
      state, 
      selectionType,
      customOptions,
      standardProduct,
      notes 
    } = body

    if (!roomId || !itemId) {
      return NextResponse.json({ error: 'Room ID and Item ID are required' }, { status: 400 })
    }

    // Verify the room exists and user has access
    const room = await prisma.room.findFirst({
      where: { 
        id: roomId,
        project: {
          organization: {
            users: {
              some: { id: session.user.id }
            }
          }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found or access denied' }, { status: 404 })
    }

    // Update or create the FFE item status
    const upsertedStatus = await prisma.fFEItemStatus.upsert({
      where: {
        roomId_itemId: { roomId, itemId }
      },
      update: {
        state,
        selectionType,
        customOptions: customOptions || undefined,
        standardProduct: standardProduct || undefined,
        notes,
        updatedById: session.user.id
      },
      create: {
        roomId,
        itemId,
        state,
        selectionType,
        customOptions: customOptions || undefined,
        standardProduct: standardProduct || undefined,
        notes,
        createdById: session.user.id,
        updatedById: session.user.id
      }
    })

    // Create audit log entry
    await prisma.fFEAuditLog.create({
      data: {
        roomId,
        itemId,
        action: state === 'confirmed' ? 'confirmed' : 
                state === 'not_needed' ? 'not_needed' : 'updated',
        newValue: JSON.stringify({
          state,
          selectionType,
          customOptions,
          standardProduct
        }),
        notes: `Updated via dynamic FFE interface`,
        userId: session.user.id
      }
    })

    return NextResponse.json({ 
      success: true,
      status: {
        itemId: upsertedStatus.itemId,
        state: upsertedStatus.state,
        selectionType: upsertedStatus.selectionType,
        customOptions: upsertedStatus.customOptions,
        standardProduct: upsertedStatus.standardProduct,
        notes: upsertedStatus.notes,
        updatedAt: upsertedStatus.updatedAt.toISOString()
      }
    })

  } catch (error) {
    console.error('Error updating FFE item status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Delete an FFE item status (reset to default)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const itemId = searchParams.get('itemId')

    if (!roomId || !itemId) {
      return NextResponse.json({ error: 'Room ID and Item ID are required' }, { status: 400 })
    }

    // Verify the room exists and user has access
    const room = await prisma.room.findFirst({
      where: { 
        id: roomId,
        project: {
          organization: {
            users: {
              some: { id: session.user.id }
            }
          }
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: 'Room not found or access denied' }, { status: 404 })
    }

    // Delete the status (resets to default)
    await prisma.fFEItemStatus.delete({
      where: {
        roomId_itemId: { roomId, itemId }
      }
    })

    // Create audit log entry
    await prisma.fFEAuditLog.create({
      data: {
        roomId,
        itemId,
        action: 'reset',
        notes: `Reset to default state`,
        userId: session.user.id
      }
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting FFE item status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}