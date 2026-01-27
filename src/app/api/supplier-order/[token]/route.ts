import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/supplier-order/[token]
 * Get order details for supplier portal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    // Find order by supplier access token
    const order = await prisma.order.findUnique({
      where: { supplierAccessToken: token },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            contactName: true
          }
        },
        items: {
          include: {
            roomFFEItem: {
              select: {
                id: true,
                name: true,
                description: true,
                brand: true,
                sku: true,
                modelNumber: true,
                color: true,
                finish: true,
                images: true,
                leadTime: true
              }
            },
            supplierQuoteLineItem: {
              select: {
                id: true,
                unitPrice: true,
                leadTime: true,
                leadTimeWeeks: true,
                notes: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        documents: {
          where: {
            OR: [
              { visibleToSupplier: true },
              { type: { in: ['PURCHASE_ORDER', 'SPEC_SHEET', 'DRAWING'] } }
            ]
          },
          orderBy: { createdAt: 'desc' }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        deliveries: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found or invalid token' }, { status: 404 })
    }

    // Check token expiration
    if (order.supplierTokenExpiresAt && new Date(order.supplierTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Access token has expired' }, { status: 403 })
    }

    // Get organization info for branding
    const organization = await prisma.organization.findUnique({
      where: { id: order.orgId },
      select: {
        name: true,
        logoUrl: true,
        businessName: true,
        businessPhone: true,
        businessEmail: true,
        businessAddress: true
      }
    })

    // Update viewed timestamp if first view
    if (!order.supplierViewedAt) {
      await prisma.order.update({
        where: { id: order.id },
        data: { supplierViewedAt: new Date() }
      })

      // Log activity
      await prisma.orderActivity.create({
        data: {
          orderId: order.id,
          type: 'SUPPLIER_VIEWED',
          message: `Supplier viewed the purchase order`
        }
      })
    }

    // Format response
    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        orderedAt: order.orderedAt,
        confirmedAt: order.confirmedAt,
        expectedDelivery: order.expectedDelivery,
        expectedShipDate: order.expectedShipDate,
        actualShipDate: order.actualShipDate,
        actualDelivery: order.actualDelivery,
        supplierConfirmedAt: order.supplierConfirmedAt,
        supplierConfirmedBy: order.supplierConfirmedBy,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        shippingCarrier: order.shippingCarrier,
        shippingMethod: order.shippingMethod,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        notes: order.notes,
        subtotal: order.subtotal ? parseFloat(order.subtotal.toString()) : 0,
        taxAmount: order.taxAmount ? parseFloat(order.taxAmount.toString()) : 0,
        shippingCost: order.shippingCost ? parseFloat(order.shippingCost.toString()) : 0,
        extraCharges: order.extraCharges as Array<{ label: string; amount: number }> | null,
        totalAmount: order.totalAmount ? parseFloat(order.totalAmount.toString()) : 0,
        currency: order.currency,
        // Payment card info for supplier to charge
        paymentCardBrand: order.paymentCardBrand,
        paymentCardLastFour: order.paymentCardLastFour,
        paymentCardHolderName: order.paymentCardHolderName,
        paymentCardExpiry: order.paymentCardExpiry,
        paymentCardNumber: order.paymentCardNumber,
        paymentCardCvv: order.paymentCardCvv
      },
      project: order.project,
      supplier: order.supplier,
      items: order.items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitType: item.unitType,
        unitPrice: parseFloat(item.unitPrice.toString()),
        totalPrice: parseFloat(item.totalPrice.toString()),
        expectedDelivery: item.expectedDelivery,
        status: item.status,
        notes: item.notes,
        sku: item.roomFFEItem?.sku || item.roomFFEItem?.modelNumber,
        brand: item.roomFFEItem?.brand,
        color: item.roomFFEItem?.color,
        finish: item.roomFFEItem?.finish,
        images: item.roomFFEItem?.images,
        leadTime: item.supplierQuoteLineItem?.leadTime || item.roomFFEItem?.leadTime
      })),
      documents: order.documents.map(doc => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        description: doc.description,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        createdAt: doc.createdAt
      })),
      messages: order.messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        direction: msg.direction,
        senderType: msg.senderType,
        senderName: msg.senderName,
        attachments: msg.attachments,
        createdAt: msg.createdAt,
        readAt: msg.readAt
      })),
      deliveries: order.deliveries.map(del => ({
        id: del.id,
        status: del.status,
        trackingNumber: del.trackingNumber,
        carrier: del.carrier,
        expectedDate: del.expectedDate,
        actualDate: del.actualDate,
        notes: del.notes,
        createdAt: del.createdAt
      })),
      organization: {
        name: organization?.businessName || organization?.name || 'Company',
        logo: organization?.logoUrl,
        phone: organization?.businessPhone,
        email: organization?.businessEmail,
        address: organization?.businessAddress
      }
    })

  } catch (error) {
    console.error('Error fetching supplier order:', error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      {
        error: 'Failed to fetch order details',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : 'Unknown'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/supplier-order/[token]
 * Supplier actions: confirm, ship, update, message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { action } = body

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    // Find order
    const order = await prisma.order.findUnique({
      where: { supplierAccessToken: token },
      include: {
        supplier: true,
        items: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check token expiration
    if (order.supplierTokenExpiresAt && new Date(order.supplierTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Access token has expired' }, { status: 403 })
    }

    switch (action) {
      case 'confirm': {
        // Supplier confirms receipt of PO
        const { confirmedBy, notes } = body

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'CONFIRMED',
            confirmedAt: new Date(),
            supplierConfirmedAt: new Date(),
            supplierConfirmedBy: confirmedBy || order.supplier?.contactName || 'Supplier',
            notes: notes ? `${order.notes || ''}\n\nSupplier Note: ${notes}`.trim() : order.notes
          }
        })

        await prisma.orderActivity.create({
          data: {
            orderId: order.id,
            type: 'SUPPLIER_CONFIRMED',
            message: `Order confirmed by ${confirmedBy || 'supplier'}`,
            metadata: { confirmedBy, notes }
          }
        })

        return NextResponse.json({ success: true, message: 'Order confirmed' })
      }

      case 'ship': {
        // Supplier marks order as shipped
        const { trackingNumber, trackingUrl, carrier, expectedDelivery, notes: shipNotes } = body

        if (!trackingNumber && !carrier) {
          return NextResponse.json(
            { error: 'Tracking number or carrier is required' },
            { status: 400 }
          )
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'SHIPPED',
            trackingNumber,
            trackingUrl,
            shippingCarrier: carrier,
            actualShipDate: new Date(),
            expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : order.expectedDelivery
          }
        })

        // Create delivery record
        await prisma.delivery.create({
          data: {
            orderId: order.id,
            status: 'IN_TRANSIT',
            trackingNumber,
            carrier,
            scheduledDate: expectedDelivery ? new Date(expectedDelivery) : null,
            notes: shipNotes
          }
        })

        await prisma.orderActivity.create({
          data: {
            orderId: order.id,
            type: 'SHIPPED',
            message: `Order shipped via ${carrier || 'carrier'}${trackingNumber ? ` - Tracking: ${trackingNumber}` : ''}`,
            metadata: { trackingNumber, trackingUrl, carrier, expectedDelivery }
          }
        })

        // Update all order items to SHIPPED
        await prisma.orderItem.updateMany({
          where: { orderId: order.id },
          data: { status: 'SHIPPED' }
        })

        return NextResponse.json({ success: true, message: 'Shipment recorded' })
      }

      case 'update_eta': {
        // Update expected delivery date
        const { expectedDelivery, reason } = body

        if (!expectedDelivery) {
          return NextResponse.json(
            { error: 'Expected delivery date is required' },
            { status: 400 }
          )
        }

        await prisma.order.update({
          where: { id: order.id },
          data: {
            expectedDelivery: new Date(expectedDelivery)
          }
        })

        await prisma.orderActivity.create({
          data: {
            orderId: order.id,
            type: 'ETA_UPDATED',
            message: `Expected delivery updated to ${new Date(expectedDelivery).toLocaleDateString()}${reason ? `: ${reason}` : ''}`,
            metadata: { expectedDelivery, reason }
          }
        })

        return NextResponse.json({ success: true, message: 'Delivery date updated' })
      }

      case 'message': {
        // Send a message to the team
        const { content, attachments } = body

        if (!content?.trim()) {
          return NextResponse.json(
            { error: 'Message content is required' },
            { status: 400 }
          )
        }

        const message = await prisma.supplierMessage.create({
          data: {
            orgId: order.orgId,
            supplierId: order.supplierId || '',
            orderId: order.id,
            content: content.trim(),
            attachments: attachments || null,
            direction: 'INBOUND',
            senderType: 'SUPPLIER',
            senderName: order.supplier?.contactName || order.supplier?.name || 'Supplier'
          }
        })

        await prisma.orderActivity.create({
          data: {
            orderId: order.id,
            type: 'MESSAGE_RECEIVED',
            message: `Message from supplier: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Message sent',
          data: {
            id: message.id,
            content: message.content,
            createdAt: message.createdAt
          }
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error processing supplier action:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
