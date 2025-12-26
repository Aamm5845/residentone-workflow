import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { aftershipService } from '@/lib/aftership-service'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/aftership
 * Handle AfterShip webhook events for tracking updates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('aftership-hmac-sha256')

    // Verify webhook signature if secret is configured
    if (process.env.AFTERSHIP_WEBHOOK_SECRET) {
      if (!signature) {
        console.warn('[AfterShip Webhook] Missing signature')
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
      }

      const expectedSignature = crypto
        .createHmac('sha256', process.env.AFTERSHIP_WEBHOOK_SECRET)
        .update(body)
        .digest('base64')

      if (signature !== expectedSignature) {
        console.warn('[AfterShip Webhook] Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const data = JSON.parse(body)
    const { event, msg } = data

    console.log(`[AfterShip Webhook] Received event: ${event}`)

    // Handle different event types
    switch (event) {
      case 'tracking_update':
        await handleTrackingUpdate(msg)
        break
      default:
        console.log(`[AfterShip Webhook] Unhandled event: ${event}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[AfterShip Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleTrackingUpdate(msg: any) {
  const {
    tracking_number,
    slug,
    tag,
    subtag,
    checkpoints,
    expected_delivery,
    shipment_delivery_date,
    signed_by,
    courier_tracking_link,
    custom_fields
  } = msg

  console.log(`[AfterShip Webhook] Tracking update for ${tracking_number}: ${tag}`)

  // Find delivery by tracking number
  let delivery = await prisma.delivery.findFirst({
    where: { trackingNumber: tracking_number }
  })

  // If not found, try using custom_fields.deliveryId
  if (!delivery && custom_fields?.deliveryId) {
    delivery = await prisma.delivery.findUnique({
      where: { id: custom_fields.deliveryId }
    })
  }

  if (!delivery) {
    console.warn(`[AfterShip Webhook] Delivery not found for tracking: ${tracking_number}`)
    return
  }

  // Map AfterShip status to our status
  const newStatus = aftershipService.mapStatus(tag)
  const statusChanged = delivery.status !== newStatus

  // Update delivery
  const updateData: any = {
    status: newStatus,
    carrier: slug?.toUpperCase() || delivery.carrier
  }

  if (courier_tracking_link) {
    updateData.trackingUrl = courier_tracking_link
  }

  if (expected_delivery) {
    updateData.expectedDate = new Date(expected_delivery)
  }

  if (shipment_delivery_date) {
    updateData.actualDate = new Date(shipment_delivery_date)
  }

  if (signed_by) {
    updateData.signedBy = signed_by
  }

  await prisma.delivery.update({
    where: { id: delivery.id },
    data: updateData
  })

  // If delivered, update order status
  if (newStatus === 'DELIVERED' && statusChanged) {
    await prisma.order.update({
      where: { id: delivery.orderId },
      data: { status: 'DELIVERED' }
    })

    // Log activity
    const order = await prisma.order.findUnique({
      where: { id: delivery.orderId }
    })

    if (order) {
      await prisma.orderActivity.create({
        data: {
          orderId: order.id,
          action: 'Delivery completed',
          details: `Package delivered${signed_by ? ` - Signed by: ${signed_by}` : ''}`
        }
      })
    }
  }

  // Store latest checkpoint info in notes if provided
  if (checkpoints && checkpoints.length > 0) {
    const latestCheckpoint = checkpoints[checkpoints.length - 1]
    const checkpointInfo = `[${latestCheckpoint.checkpoint_time}] ${latestCheckpoint.message} - ${latestCheckpoint.city || ''} ${latestCheckpoint.country_name || ''}`

    // Append to notes (keep last 5 updates)
    const existingNotes = delivery.notes || ''
    const noteLines = existingNotes.split('\n').filter(Boolean)
    noteLines.push(checkpointInfo)
    const updatedNotes = noteLines.slice(-5).join('\n')

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { notes: updatedNotes }
    })
  }

  console.log(`[AfterShip Webhook] Updated delivery ${delivery.id} to status: ${newStatus}`)
}
