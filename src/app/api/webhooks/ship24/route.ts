import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mapTrackingStatusToOrderStatus } from '@/lib/ship24'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/ship24
 * Webhook endpoint for Ship24 tracking updates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    console.log('Ship24 webhook received:', JSON.stringify(body, null, 2))

    // Ship24 webhook payload structure
    const trackingNumber = body.trackingNumber || body.data?.trackingNumber
    const status = body.status || body.data?.status
    const statusMilestone = body.statusMilestone || body.data?.statusMilestone
    const deliveredAt = body.deliveredAt || body.data?.deliveredAt

    if (!trackingNumber) {
      console.log('No tracking number in webhook')
      return NextResponse.json({ success: true })
    }

    // Find orders with this tracking number
    const orders = await prisma.order.findMany({
      where: { trackingNumber },
      select: {
        id: true,
        orderNumber: true,
        status: true
      }
    })

    if (orders.length === 0) {
      console.log('No orders found for tracking:', trackingNumber)
      return NextResponse.json({ success: true })
    }

    // Determine new order status
    let newStatus: string | null = null
    let actualDelivery: Date | null = null

    const milestone = (statusMilestone || status || '').toLowerCase()

    if (milestone.includes('delivered')) {
      newStatus = 'DELIVERED'
      actualDelivery = deliveredAt ? new Date(deliveredAt) : new Date()
    } else if (milestone.includes('out_for_delivery')) {
      newStatus = 'IN_TRANSIT'
    } else if (milestone.includes('transit') || milestone.includes('in_transit')) {
      newStatus = 'IN_TRANSIT'
    } else if (milestone.includes('exception') || milestone.includes('failure')) {
      newStatus = 'EXCEPTION'
    }

    // Update each order
    for (const order of orders) {
      // Only update if status would change
      if (newStatus && newStatus !== order.status) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: newStatus as any,
            ...(actualDelivery && { actualDelivery })
          }
        })

        // Log activity
        await prisma.orderActivity.create({
          data: {
            orderId: order.id,
            type: 'TRACKING_UPDATE',
            message: newStatus === 'DELIVERED'
              ? `Package delivered`
              : `Tracking update: ${statusMilestone || status}`,
            metadata: { trackingNumber, status, statusMilestone, deliveredAt }
          }
        })

        console.log(`Updated order ${order.orderNumber} to ${newStatus}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Ship24 webhook error:', error)
    // Return 200 to acknowledge receipt even on error
    return NextResponse.json({ success: false, error: 'Processing error' })
  }
}

// Also handle GET for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({ status: 'Ship24 webhook endpoint active' })
}
