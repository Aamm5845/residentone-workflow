import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { aftershipService } from '@/lib/aftership-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/deliveries/[id]/track
 * Get real-time tracking info from AfterShip
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

    // Get delivery
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

    if (!delivery.trackingNumber) {
      return NextResponse.json({ error: 'No tracking number' }, { status: 400 })
    }

    // Check if AfterShip is configured
    if (!aftershipService.isConfigured()) {
      return NextResponse.json({
        trackingNumber: delivery.trackingNumber,
        carrier: delivery.carrier,
        status: delivery.status,
        trackingUrl: delivery.trackingUrl,
        message: 'Real-time tracking not configured'
      })
    }

    // Get tracking from AfterShip
    const tracking = await aftershipService.getTracking(
      delivery.trackingNumber,
      delivery.carrier?.toLowerCase()
    )

    if (!tracking) {
      return NextResponse.json({
        trackingNumber: delivery.trackingNumber,
        carrier: delivery.carrier,
        status: delivery.status,
        trackingUrl: delivery.trackingUrl,
        message: 'Tracking not found in AfterShip'
      })
    }

    // Format tracking data
    const formattedTracking = aftershipService.formatForDelivery(tracking)

    // Update delivery with latest info if status changed
    if (formattedTracking.status !== delivery.status) {
      await prisma.delivery.update({
        where: { id },
        data: {
          status: formattedTracking.status,
          trackingUrl: formattedTracking.trackingUrl,
          expectedDate: formattedTracking.expectedDate,
          actualDate: formattedTracking.actualDate,
          signedBy: formattedTracking.signedBy
        }
      })

      // Update order status if delivered
      if (formattedTracking.status === 'DELIVERED') {
        await prisma.order.update({
          where: { id: delivery.orderId },
          data: { status: 'DELIVERED' }
        })
      }
    }

    return NextResponse.json({
      trackingNumber: delivery.trackingNumber,
      carrier: formattedTracking.carrier,
      status: formattedTracking.status,
      trackingUrl: formattedTracking.trackingUrl,
      expectedDelivery: formattedTracking.expectedDate,
      deliveredAt: formattedTracking.actualDate,
      signedBy: formattedTracking.signedBy,
      lastUpdate: formattedTracking.lastUpdate,
      checkpoints: formattedTracking.checkpoints
    })
  } catch (error) {
    console.error('[Tracking] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get tracking' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/deliveries/[id]/track
 * Register tracking with AfterShip
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

    const { id } = await params
    const orgId = (session.user as any).orgId

    // Get delivery with order info
    const delivery = await prisma.delivery.findFirst({
      where: {
        id,
        order: {
          orgId
        }
      },
      include: {
        order: {
          include: {
            project: {
              include: {
                client: true
              }
            }
          }
        }
      }
    })

    if (!delivery) {
      return NextResponse.json({ error: 'Delivery not found' }, { status: 404 })
    }

    if (!delivery.trackingNumber) {
      return NextResponse.json({ error: 'No tracking number' }, { status: 400 })
    }

    if (!aftershipService.isConfigured()) {
      return NextResponse.json(
        { error: 'AfterShip is not configured' },
        { status: 503 }
      )
    }

    // Detect carrier if not set
    let carrier = delivery.carrier?.toLowerCase()
    if (!carrier) {
      const detectedCarriers = await aftershipService.detectCarrier(delivery.trackingNumber)
      if (detectedCarriers.length > 0) {
        carrier = detectedCarriers[0]

        // Update delivery with detected carrier
        await prisma.delivery.update({
          where: { id },
          data: { carrier: carrier.toUpperCase() }
        })
      }
    }

    // Register tracking with AfterShip
    const clientEmail = delivery.order.project.client?.email
    const tracking = await aftershipService.createTracking({
      trackingNumber: delivery.trackingNumber,
      carrier,
      title: `Order ${delivery.order.orderNumber}`,
      customerName: delivery.order.project.client?.name,
      orderId: delivery.order.id,
      customFields: {
        project: delivery.order.project.name,
        deliveryId: delivery.id
      },
      emails: clientEmail ? [clientEmail] : undefined
    })

    // Update delivery with tracking URL
    if (tracking.courierTrackingLink) {
      await prisma.delivery.update({
        where: { id },
        data: {
          trackingUrl: tracking.courierTrackingLink,
          carrier: tracking.slug.toUpperCase()
        }
      })
    }

    return NextResponse.json({
      success: true,
      trackingId: tracking.id,
      carrier: tracking.slug,
      trackingUrl: tracking.courierTrackingLink,
      status: aftershipService.mapStatus(tracking.tag)
    })
  } catch (error) {
    console.error('[Tracking] Registration Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to register tracking' },
      { status: 500 }
    )
  }
}
