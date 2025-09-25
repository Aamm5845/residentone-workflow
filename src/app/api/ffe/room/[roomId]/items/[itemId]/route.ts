import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getRoomFFEConfig } from '@/lib/constants/room-ffe-config'
import type { Session } from 'next-auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
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

    const { roomId, itemId } = resolvedParams
    const updates = await request.json()

    // Verify room ownership
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { 
        id: true,
        type: true,
        projectId: true,
        project: { select: { orgId: true } }
      }
    })

    if (!room || room.project.orgId !== session.user.orgId) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get FFE config to validate item exists
    const ffeConfig = getRoomFFEConfig(room.type)
    if (ffeConfig) {
      const itemExists = ffeConfig.items.some(item => item.id === itemId)
      if (!itemExists) {
        return NextResponse.json({ error: 'FFE item not found in room configuration' }, { status: 404 })
      }
    }

    // Update or create the FFE item status
    const itemStatus = await prisma.fFEItemStatus.upsert({
      where: {
        roomId_itemId: {
          roomId,
          itemId
        }
      },
      create: {
        roomId,
        itemId,
        status: updates.status || 'NOT_STARTED',
        notes: updates.notes,
        supplierLink: updates.supplierLink,
        actualPrice: updates.actualPrice ? parseFloat(updates.actualPrice) : undefined,
        estimatedDelivery: updates.estimatedDelivery ? new Date(updates.estimatedDelivery) : undefined,
        subItemsCompleted: updates.subItemsCompleted || [],
        confirmedAt: updates.status === 'COMPLETED' ? new Date() : null,
        createdById: session.user.id,
        updatedById: session.user.id
      },
      update: {
        ...(updates.status !== undefined && { status: updates.status }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.supplierLink !== undefined && { supplierLink: updates.supplierLink }),
        ...(updates.actualPrice !== undefined && { actualPrice: parseFloat(updates.actualPrice) || null }),
        ...(updates.estimatedDelivery !== undefined && { estimatedDelivery: updates.estimatedDelivery ? new Date(updates.estimatedDelivery) : null }),
        ...(updates.subItemsCompleted !== undefined && { subItemsCompleted: updates.subItemsCompleted }),
        ...(updates.status === 'COMPLETED' && { confirmedAt: new Date() }),
        ...(updates.status && updates.status !== 'COMPLETED' && updates.confirmedAt !== undefined && { confirmedAt: null }),
        updatedById: session.user.id,
        updatedAt: new Date()
      },
      include: {
        updatedBy: {
          select: { name: true }
        }
      }
    })

    // Log the activity
    const itemName = ffeConfig?.items.find(item => item.id === itemId)?.name || itemId
    await prisma.activityLog.create({
      data: {
        type: 'FFE_ITEM_UPDATED',
        description: `Updated FFE item "${itemName}" status to ${updates.status || 'updated'}`,
        metadata: { 
          roomId,
          itemId,
          itemName,
          oldStatus: updates.oldStatus,
          newStatus: updates.status,
          hasNotes: !!updates.notes,
          hasSupplierLink: !!updates.supplierLink,
          hasPrice: !!updates.actualPrice
        },
        userId: session.user.id,
        projectId: room.projectId
      }
    })

    // Return formatted item status
    const formattedStatus = {
      id: itemStatus.itemId,
      status: itemStatus.status,
      confirmedAt: itemStatus.confirmedAt,
      confirmedBy: itemStatus.updatedBy?.name,
      notes: itemStatus.notes,
      supplierLink: itemStatus.supplierLink,
      actualPrice: itemStatus.actualPrice,
      estimatedDelivery: itemStatus.estimatedDelivery,
      subItemsCompleted: itemStatus.subItemsCompleted || []
    }

    return NextResponse.json({
      success: true,
      itemStatus: formattedStatus,
      message: 'FFE item updated successfully'
    })

  } catch (error) {
    console.error('Error updating FFE item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
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

    const { roomId, itemId } = resolvedParams

    // Verify room ownership
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { 
        project: { select: { orgId: true } }
      }
    })

    if (!room || room.project.orgId !== session.user.orgId) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get the FFE item status
    const itemStatus = await prisma.fFEItemStatus.findUnique({
      where: {
        roomId_itemId: {
          roomId,
          itemId
        }
      },
      include: {
        updatedBy: {
          select: { name: true }
        },
        createdBy: {
          select: { name: true }
        }
      }
    })

    if (!itemStatus) {
      return NextResponse.json({ error: 'FFE item status not found' }, { status: 404 })
    }

    const formattedStatus = {
      id: itemStatus.itemId,
      status: itemStatus.status,
      confirmedAt: itemStatus.confirmedAt,
      confirmedBy: itemStatus.updatedBy?.name,
      createdBy: itemStatus.createdBy?.name,
      notes: itemStatus.notes,
      supplierLink: itemStatus.supplierLink,
      actualPrice: itemStatus.actualPrice,
      estimatedDelivery: itemStatus.estimatedDelivery,
      subItemsCompleted: itemStatus.subItemsCompleted || []
    }

    return NextResponse.json({
      itemStatus: formattedStatus,
      message: 'FFE item status retrieved successfully'
    })

  } catch (error) {
    console.error('Error fetching FFE item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; itemId: string }> }
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

    const { roomId, itemId } = resolvedParams

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

    // Delete the FFE item status
    await prisma.fFEItemStatus.delete({
      where: {
        roomId_itemId: {
          roomId,
          itemId
        }
      }
    })

    // Log the activity
    await prisma.activityLog.create({
      data: {
        type: 'FFE_ITEM_DELETED',
        description: `Deleted FFE item status for ${itemId}`,
        metadata: { roomId, itemId },
        userId: session.user.id,
        projectId: room.projectId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'FFE item status deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting FFE item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}