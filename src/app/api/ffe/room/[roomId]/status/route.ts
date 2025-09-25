import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getRoomFFEConfig } from '@/lib/constants/room-ffe-config'
import type { Session } from 'next-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    const resolvedParams = await params

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = resolvedParams

    // Get room information
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { 
        id: true, 
        type: true, 
        name: true,
        projectId: true,
        project: {
          select: { orgId: true }
        }
      }
    })

    if (!room || room.project.orgId !== session.user.orgId) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get FFE configuration for this room type
    const ffeConfig = getRoomFFEConfig(room.type)
    if (!ffeConfig) {
      return NextResponse.json({ 
        itemStatuses: {},
        roomConfig: null,
        message: 'No FFE configuration found for this room type'
      })
    }

    // Get existing FFE item statuses from database
    const existingStatuses = await prisma.fFEItemStatus.findMany({
      where: { roomId },
      include: {
        updatedBy: {
          select: { name: true }
        },
        createdBy: {
          select: { name: true }
        }
      }
    })

    // Convert to lookup object
    const itemStatuses: Record<string, any> = {}
    existingStatuses.forEach(status => {
      itemStatuses[status.itemId] = {
        id: status.itemId,
        status: status.status,
        confirmedAt: status.confirmedAt,
        confirmedBy: status.updatedBy?.name,
        notes: status.notes,
        supplierLink: status.supplierLink,
        actualPrice: status.actualPrice,
        estimatedDelivery: status.estimatedDelivery,
        subItemsCompleted: status.subItemsCompleted || []
      }
    })

    return NextResponse.json({
      itemStatuses,
      roomConfig: ffeConfig,
      message: 'FFE status loaded successfully'
    })

  } catch (error) {
    console.error('Error fetching FFE status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create or update multiple FFE item statuses
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        orgId: string
        role: string
      }
    } | null
    const resolvedParams = await params

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { roomId } = resolvedParams
    const updates = await request.json()

    // Verify room ownership
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { 
        projectId: true,
        project: { select: { orgId: true } }
      }
    })

    if (!room || room.project.orgId !== session.user.orgId) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const results = []

    for (const [itemId, itemUpdates] of Object.entries(updates as Record<string, any>)) {
      const result = await prisma.fFEItemStatus.upsert({
        where: {
          roomId_itemId: {
            roomId,
            itemId
          }
        },
        create: {
          roomId,
          itemId,
          status: itemUpdates.status || 'NOT_STARTED',
          notes: itemUpdates.notes,
          supplierLink: itemUpdates.supplierLink,
          actualPrice: itemUpdates.actualPrice,
          estimatedDelivery: itemUpdates.estimatedDelivery,
          subItemsCompleted: itemUpdates.subItemsCompleted || [],
          confirmedAt: itemUpdates.status === 'COMPLETED' ? new Date() : null,
          createdById: session.user.id,
          updatedById: session.user.id
        },
        update: {
          status: itemUpdates.status,
          notes: itemUpdates.notes,
          supplierLink: itemUpdates.supplierLink,
          actualPrice: itemUpdates.actualPrice,
          estimatedDelivery: itemUpdates.estimatedDelivery,
          subItemsCompleted: itemUpdates.subItemsCompleted,
          confirmedAt: itemUpdates.status === 'COMPLETED' ? new Date() : undefined,
          updatedById: session.user.id,
          updatedAt: new Date()
        }
      })
      
      results.push(result)
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'FFE_ITEMS_UPDATED',
        description: `Updated ${results.length} FFE item statuses`,
        metadata: { 
          roomId, 
          itemCount: results.length,
          updatedItems: Object.keys(updates)
        },
        userId: session.user.id,
        projectId: room.projectId
      }
    })

    return NextResponse.json({ 
      success: true, 
      updatedCount: results.length,
      message: 'FFE item statuses updated successfully'
    })

  } catch (error) {
    console.error('Error updating FFE statuses:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}