import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/programa-import/[id]/link
 * Link a programa item to an FFE item
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: programaItemId } = await params
    const orgId = (session.user as any).orgId
    const userId = session.user.id
    const body = await request.json()
    const { roomFFEItemId } = body

    if (!roomFFEItemId) {
      return NextResponse.json({ error: 'roomFFEItemId is required' }, { status: 400 })
    }

    // Verify programa item belongs to org
    const programaItem = await prisma.programaItem.findFirst({
      where: { id: programaItemId, orgId }
    })

    if (!programaItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Verify FFE item exists
    const ffeItem = await prisma.roomFFEItem.findFirst({
      where: { id: roomFFEItemId },
      include: {
        section: {
          include: {
            room: {
              include: {
                project: { select: { orgId: true } }
              }
            }
          }
        }
      }
    })

    if (!ffeItem || ffeItem.section.room.project.orgId !== orgId) {
      return NextResponse.json({ error: 'FFE item not found' }, { status: 404 })
    }

    // Update programa item with link
    const updated = await prisma.programaItem.update({
      where: { id: programaItemId },
      data: {
        linkedRoomFFEItemId: roomFFEItemId,
        linkedAt: new Date(),
        linkedById: userId
      },
      include: {
        linkedRoomFFEItem: {
          select: {
            id: true,
            name: true,
            images: true,
            section: {
              select: {
                name: true,
                room: { select: { name: true } }
              }
            }
          }
        }
      }
    })

    // Also update the FFE item with programa data if desired
    // Copy over relevant fields from programa item to FFE item
    await prisma.roomFFEItem.update({
      where: { id: roomFFEItemId },
      data: {
        // Only update if FFE item fields are empty
        brand: ffeItem.brand || programaItem.brand,
        sku: ffeItem.sku || programaItem.sku,
        color: ffeItem.color || programaItem.color,
        finish: ffeItem.finish || programaItem.finish,
        material: ffeItem.material || programaItem.material,
        leadTime: ffeItem.leadTime || programaItem.leadTime,
        rrp: ffeItem.rrp || programaItem.rrp,
        tradePrice: ffeItem.tradePrice || programaItem.tradePrice,
        supplierName: ffeItem.supplierName || programaItem.supplierCompanyName,
        websiteUrl: ffeItem.websiteUrl || programaItem.websiteUrl
      }
    })

    return NextResponse.json({
      success: true,
      item: updated
    })
  } catch (error) {
    console.error('Error linking programa item:', error)
    return NextResponse.json({ error: 'Failed to link item' }, { status: 500 })
  }
}

/**
 * DELETE /api/programa-import/[id]/link
 * Unlink a programa item from an FFE item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: programaItemId } = await params
    const orgId = (session.user as any).orgId

    // Verify programa item belongs to org
    const programaItem = await prisma.programaItem.findFirst({
      where: { id: programaItemId, orgId }
    })

    if (!programaItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Remove link
    const updated = await prisma.programaItem.update({
      where: { id: programaItemId },
      data: {
        linkedRoomFFEItemId: null,
        linkedAt: null,
        linkedById: null
      }
    })

    return NextResponse.json({
      success: true,
      item: updated
    })
  } catch (error) {
    console.error('Error unlinking programa item:', error)
    return NextResponse.json({ error: 'Failed to unlink item' }, { status: 500 })
  }
}
