import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/deliveries/[id]
 * Get a single delivery by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = (session.user as any).orgId

    const delivery = await prisma.delivery.findFirst({
      where: {
        id,
        order: {
          orgId
        }
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            supplier: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true
              }
            }
          }
        }
      }
    })

    if (!delivery) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
    }

    return NextResponse.json(delivery)
  } catch (error) {
    console.error('Error fetching delivery:', error)
    return NextResponse.json(
      { error: 'Failed to fetch delivery' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/deliveries/[id]
 * Update a delivery
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = (session.user as any).orgId
    const userId = (session.user as any).id

    // Verify delivery belongs to org
    const existingDelivery = await prisma.delivery.findFirst({
      where: {
        id,
        order: {
          orgId
        }
      }
    })

    if (!existingDelivery) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      status,
      scheduledDate,
      actualDate,
      carrier,
      trackingNumber,
      notes,
      receivedBy,
      signatureUrl,
      photoUrls
    } = body

    // Build update data
    const updateData: any = {}

    if (status !== undefined) updateData.status = status
    if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate ? new Date(scheduledDate) : null
    if (actualDate !== undefined) updateData.actualDate = actualDate ? new Date(actualDate) : null
    if (carrier !== undefined) updateData.carrier = carrier
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber
    if (notes !== undefined) updateData.notes = notes
    if (receivedBy !== undefined) updateData.receivedBy = receivedBy
    if (signatureUrl !== undefined) updateData.signatureUrl = signatureUrl
    if (photoUrls !== undefined) updateData.photoUrls = photoUrls

    const delivery = await prisma.delivery.update({
      where: { id },
      data: updateData,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        }
      }
    })

    // If status changed to DELIVERED, update the order status
    if (status === 'DELIVERED') {
      await prisma.order.update({
        where: { id: existingDelivery.orderId },
        data: { status: 'DELIVERED' }
      })

      // Log activity
      await prisma.orderActivity.create({
        data: {
          orderId: existingDelivery.orderId,
          userId,
          action: 'Delivery completed',
          details: `Delivery marked as delivered${receivedBy ? ` - Received by: ${receivedBy}` : ''}`
        }
      })
    }

    return NextResponse.json(delivery)
  } catch (error) {
    console.error('Error updating delivery:', error)
    return NextResponse.json(
      { error: 'Failed to update delivery' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/deliveries/[id]
 * Delete a delivery
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

    const { id } = await params
    const orgId = (session.user as any).orgId

    // Verify delivery belongs to org
    const delivery = await prisma.delivery.findFirst({
      where: {
        id,
        order: {
          orgId
        }
      }
    })

    if (!delivery) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
    }

    await prisma.delivery.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting delivery:', error)
    return NextResponse.json(
      { error: 'Failed to delete delivery' },
      { status: 500 }
    )
  }
}
