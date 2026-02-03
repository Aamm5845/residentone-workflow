import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { decrypt } from '@/lib/encryption'

export const dynamic = 'force-dynamic'

// Notification email recipient
const NOTIFICATION_EMAIL = 'shaya@meisnerinteriors.com'

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
            address: true,
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        },
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            contactName: true,
            logo: true
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
                material: true,
                images: true,
                leadTime: true,
                supplierLink: true,
                width: true,
                height: true,
                depth: true,
                components: {
                  select: {
                    id: true,
                    modelNumber: true,
                    link: true
                  }
                }
              }
            },
            supplierQuoteLineItem: {
              select: {
                id: true,
                unitPrice: true,
                leadTime: true,
                leadTimeWeeks: true,
                notes: true,
                supplierQuote: {
                  select: {
                    id: true,
                    quoteNumber: true
                  }
                }
              }
            },
            clientQuoteLineItem: {
              select: {
                id: true,
                clientQuote: {
                  select: {
                    id: true,
                    quoteNumber: true
                  }
                }
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
        },
        activities: {
          where: {
            // Filter out internal activities like SUPPLIER_VIEWED
            NOT: {
              type: { in: ['SUPPLIER_VIEWED'] }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            type: true,
            message: true,
            createdAt: true
          }
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

    // Payment card data - start with order values, then override with fresh data from saved payment method
    let paymentCardBrand = order.paymentCardBrand
    let paymentCardLastFour = order.paymentCardLastFour
    let paymentCardHolderName = order.paymentCardHolderName
    let paymentCardExpiry = order.paymentCardExpiry
    let paymentCardNumber = order.paymentCardNumber
    let paymentCardCvv = order.paymentCardCvv

    // If order has a saved payment method, always fetch fresh data from it
    if (order.savedPaymentMethodId) {
      const savedPaymentMethod = await prisma.savedPaymentMethod.findUnique({
        where: { id: order.savedPaymentMethodId }
      })

      console.log('Saved payment method found:', savedPaymentMethod ? {
        id: savedPaymentMethod.id,
        holderName: savedPaymentMethod.holderName,
        expiryMonth: savedPaymentMethod.expiryMonth,
        expiryYear: savedPaymentMethod.expiryYear
      } : 'null')

      if (savedPaymentMethod) {
        const expiry = savedPaymentMethod.expiryMonth && savedPaymentMethod.expiryYear
          ? `${String(savedPaymentMethod.expiryMonth).padStart(2, '0')}/${String(savedPaymentMethod.expiryYear).slice(-2)}`
          : null

        // Use fresh data from saved payment method
        paymentCardBrand = savedPaymentMethod.cardBrand || paymentCardBrand
        paymentCardLastFour = savedPaymentMethod.lastFour || paymentCardLastFour
        paymentCardHolderName = savedPaymentMethod.holderName || paymentCardHolderName
        paymentCardExpiry = expiry || paymentCardExpiry
        paymentCardNumber = savedPaymentMethod.encryptedCardNumber || paymentCardNumber
        paymentCardCvv = savedPaymentMethod.encryptedCvv || paymentCardCvv

        // Update order in database if data changed
        if (paymentCardHolderName !== order.paymentCardHolderName || paymentCardExpiry !== order.paymentCardExpiry) {
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentCardBrand,
              paymentCardLastFour,
              paymentCardHolderName,
              paymentCardExpiry,
              paymentCardNumber,
              paymentCardCvv
            }
          })
        }
      }
    } else {
      console.log('No savedPaymentMethodId on order:', order.id)
    }

    // Update viewed timestamp if first view
    if (!order.supplierViewedAt) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          supplierViewedAt: new Date()
        }
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

    // Extract quote numbers from items
    const supplierQuoteNumber = order.items.find(item => item.supplierQuoteLineItem?.supplierQuote?.quoteNumber)
      ?.supplierQuoteLineItem?.supplierQuote?.quoteNumber || null
    const clientQuoteNumber = order.items.find(item => item.clientQuoteLineItem?.clientQuote?.quoteNumber)
      ?.clientQuoteLineItem?.clientQuote?.quoteNumber || null

    // Format response
    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        supplierQuoteNumber,
        clientQuoteNumber,
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
        shippingRecipientName: order.shippingRecipientName,
        shippingAddress: order.shippingAddress,
        billingAddress: order.billingAddress,
        notes: order.notes,
        subtotal: order.subtotal ? parseFloat(order.subtotal.toString()) : 0,
        taxAmount: order.taxAmount ? parseFloat(order.taxAmount.toString()) : 0,
        shippingCost: order.shippingCost ? parseFloat(order.shippingCost.toString()) : 0,
        extraCharges: order.extraCharges as Array<{ label: string; amount: number }> | null,
        totalAmount: order.totalAmount ? parseFloat(order.totalAmount.toString()) : 0,
        currency: order.currency,
        // Payment card info for supplier to charge (use fresh data from saved payment method)
        paymentCardBrand,
        paymentCardLastFour,
        paymentCardHolderName,
        paymentCardExpiry,
        paymentCardNumber: paymentCardNumber ? decrypt(paymentCardNumber) : null,
        paymentCardCvv: paymentCardCvv ? decrypt(paymentCardCvv) : null,
        // Payment status
        supplierPaidAt: order.supplierPaidAt?.toISOString() || null,
        supplierPaymentAmount: order.supplierPaymentAmount ? Number(order.supplierPaymentAmount) : null,
        supplierPaymentMethod: order.supplierPaymentMethod,
        // Deposit info
        depositPercent: order.depositPercent ? parseFloat(order.depositPercent.toString()) : null,
        depositRequired: order.depositRequired ? parseFloat(order.depositRequired.toString()) : null,
        depositPaid: order.depositPaid ? parseFloat(order.depositPaid.toString()) : null,
        depositPaidAt: order.depositPaidAt?.toISOString() || null,
        balanceDue: order.balanceDue ? parseFloat(order.balanceDue.toString()) : null
      },
      project: order.project ? {
        id: order.project.id,
        name: order.project.name,
        address: order.project.address,
        clientName: order.project.client?.name
      } : {
        id: '',
        name: 'Unknown Project',
        address: null,
        clientName: null
      },
      supplier: order.supplier || {
        id: '',
        name: order.vendorName || 'Supplier',
        email: order.vendorEmail || null,
        phone: null,
        contactName: null
      },
      items: order.items.map(item => {
        // Get images - prefer OrderItem imageUrl, then roomFFEItem images
        const roomImages = item.roomFFEItem?.images as string[] | null
        const images = item.imageUrl
          ? [item.imageUrl]
          : (roomImages && roomImages.length > 0 ? roomImages : null)

        // For components, get the component's modelNumber instead of parent's SKU
        let sku = item.roomFFEItem?.sku || item.roomFFEItem?.modelNumber
        let supplierLink = item.roomFFEItem?.supplierLink

        if (item.componentId && item.roomFFEItem?.components) {
          const component = (item.roomFFEItem.components as Array<{ id: string; modelNumber: string | null; link: string | null }>)
            .find(c => c.id === item.componentId)
          if (component) {
            sku = component.modelNumber || sku
            supplierLink = component.link || supplierLink
          }
        }

        return {
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
          sku,
          brand: item.roomFFEItem?.brand,
          color: item.roomFFEItem?.color,
          finish: item.roomFFEItem?.finish,
          material: item.roomFFEItem?.material,
          images,
          supplierLink,
          dimensions: item.roomFFEItem?.width || item.roomFFEItem?.height || item.roomFFEItem?.depth
            ? `${item.roomFFEItem?.width || '-'} × ${item.roomFFEItem?.height || '-'} × ${item.roomFFEItem?.depth || '-'}`
            : null,
          isComponent: item.isComponent || false,
          parentItemId: item.parentItemId || null
        }
      }),
      documents: order.documents.map(doc => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        description: doc.description,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        mimeType: doc.mimeType,
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
      activities: order.activities.map(act => ({
        id: act.id,
        type: act.type,
        message: act.message,
        createdAt: act.createdAt
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

        // If payment has already been recorded, update spec items to ORDERED
        // (spec items only become ORDERED when BOTH confirmed AND paid)
        if (order.supplierPaidAt) {
          const roomFFEItemIds = order.items
            .map(item => item.roomFFEItemId)
            .filter((id): id is string => id !== null)

          if (roomFFEItemIds.length > 0) {
            await prisma.roomFFEItem.updateMany({
              where: { id: { in: roomFFEItemIds } },
              data: { specStatus: 'ORDERED' }
            })
          }
        }

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

        // Register tracking with Ship24 for auto-updates
        if (trackingNumber) {
          try {
            const { createTracker } = await import('@/lib/ship24')
            await createTracker(trackingNumber)
            console.log(`Registered tracking ${trackingNumber} with Ship24`)
          } catch (trackingError) {
            console.error('Failed to register tracking with Ship24:', trackingError)
            // Don't fail the request if tracking registration fails
          }
        }

        // Create delivery record
        await prisma.delivery.create({
          data: {
            orderId: order.id,
            status: 'IN_TRANSIT',
            trackingNumber,
            carrier,
            expectedDate: expectedDelivery ? new Date(expectedDelivery) : null,
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

        // Send notification email
        try {
          const supplierName = order.supplier?.name || 'Supplier'
          await sendEmail({
            to: NOTIFICATION_EMAIL,
            subject: `New Message from ${supplierName} - PO #${order.orderNumber}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1f2937;">New Supplier Message</h2>
                <p><strong>Order:</strong> ${order.orderNumber}</p>
                <p><strong>Supplier:</strong> ${supplierName}</p>
                <p><strong>Message:</strong></p>
                <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p style="white-space: pre-line; margin: 0;">${content}</p>
                </div>
                <p style="margin-top: 24px;">
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL}/supplier-order/${token}"
                     style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                    View Order
                  </a>
                </p>
              </div>
            `
          })
        } catch (emailErr) {
          console.error('Failed to send notification email:', emailErr)
        }

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

      case 'delete_message': {
        const { messageId } = body

        if (!messageId) {
          return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
        }

        // Find and verify the message belongs to this order and was sent by supplier
        const messageToDelete = await prisma.supplierMessage.findFirst({
          where: {
            id: messageId,
            orderId: order.id,
            senderType: 'SUPPLIER'
          }
        })

        if (!messageToDelete) {
          return NextResponse.json({ error: 'Message not found or cannot be deleted' }, { status: 404 })
        }

        await prisma.supplierMessage.delete({
          where: { id: messageId }
        })

        return NextResponse.json({ success: true, message: 'Message deleted' })
      }

      case 'delete_document': {
        const { documentId } = body

        if (!documentId) {
          return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
        }

        // Find and verify the document belongs to this order
        const docToDelete = await prisma.rFQDocument.findFirst({
          where: {
            id: documentId,
            orderId: order.id
          }
        })

        if (!docToDelete) {
          return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        await prisma.rFQDocument.delete({
          where: { id: documentId }
        })

        await prisma.orderActivity.create({
          data: {
            orderId: order.id,
            type: 'DOCUMENT_DELETED',
            message: `Supplier deleted document: ${docToDelete.title}`
          }
        })

        return NextResponse.json({ success: true, message: 'Document deleted' })
      }

      case 'record_payment': {
        // Supplier records that they've charged the card or received payment
        const { amount, method, reference, notes: paymentNotes, chargedBy } = body

        if (!amount || amount <= 0) {
          return NextResponse.json({ error: 'Payment amount is required' }, { status: 400 })
        }

        // Round amount to 2 decimal places
        const paymentAmountRounded = Math.round(amount * 100) / 100

        // Calculate new total payment (add to existing)
        const existingPayment = order.supplierPaymentAmount ? Number(order.supplierPaymentAmount) : 0
        const newTotalPayment = Math.round((existingPayment + paymentAmountRounded) * 100) / 100

        // Update order with payment info
        const isShippedOrDelivered = order.status === 'SHIPPED' || order.status === 'DELIVERED'

        // Build update data
        const updateData: any = {
          supplierPaidAt: new Date(),
          supplierPaymentMethod: method || 'CARD',
          supplierPaymentAmount: newTotalPayment, // Accumulate payments
          supplierPaymentRef: reference || null,
          notes: paymentNotes
            ? `${order.notes || ''}\n\nPayment Note (${new Date().toLocaleDateString()}): ${paymentNotes}`.trim()
            : order.notes
        }

        // Set to CONFIRMED when payment is recorded (unless already shipped/delivered)
        if (!isShippedOrDelivered) {
          updateData.status = 'CONFIRMED'
          updateData.confirmedAt = order.confirmedAt || new Date()
          updateData.supplierConfirmedAt = order.supplierConfirmedAt || new Date()
          updateData.supplierConfirmedBy = order.supplierConfirmedBy || chargedBy || order.supplier?.contactName || 'Supplier'
        }

        await prisma.order.update({
          where: { id: order.id },
          data: updateData
        })

        // Update all order items to ORDERED status
        await prisma.orderItem.updateMany({
          where: { orderId: order.id },
          data: { status: 'ORDERED' }
        })

        // Update spec items to ORDERED only if the order is also confirmed
        // (spec items only become ORDERED when BOTH confirmed AND paid)
        const isConfirmed = order.supplierConfirmedAt || order.status === 'CONFIRMED' || !isShippedOrDelivered
        // Note: !isShippedOrDelivered means we're about to set status to CONFIRMED above

        if (isConfirmed) {
          const roomFFEItemIds = order.items
            .map(item => item.roomFFEItemId)
            .filter((id): id is string => id !== null)

          if (roomFFEItemIds.length > 0) {
            await prisma.roomFFEItem.updateMany({
              where: { id: { in: roomFFEItemIds } },
              data: { specStatus: 'ORDERED' }
            })
          }
        }

        await prisma.orderActivity.create({
          data: {
            orderId: order.id,
            type: 'PAYMENT_RECORDED',
            message: `Supplier recorded payment: $${paymentAmountRounded.toFixed(2)} via ${method || 'card'}${reference ? ` (Ref: ${reference})` : ''} (Total paid: $${newTotalPayment.toFixed(2)})`,
            metadata: { amount: paymentAmountRounded, totalPaid: newTotalPayment, method, reference, chargedBy, notes: paymentNotes }
          }
        })

        // Send notification email
        try {
          const supplierName = order.supplier?.name || order.vendorName || 'Supplier'
          await sendEmail({
            to: NOTIFICATION_EMAIL,
            subject: `Payment Recorded by ${supplierName} - PO #${order.orderNumber}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1f2937;">Payment Recorded</h2>
                <p><strong>Order:</strong> ${order.orderNumber}</p>
                <p><strong>Supplier:</strong> ${supplierName}</p>
                <p><strong>Amount:</strong> $${paymentAmountRounded.toFixed(2)}</p>
                <p><strong>Method:</strong> ${method || 'Card'}</p>
                ${reference ? `<p><strong>Reference:</strong> ${reference}</p>` : ''}
                ${chargedBy ? `<p><strong>Processed By:</strong> ${chargedBy}</p>` : ''}
                ${paymentNotes ? `<p><strong>Notes:</strong> ${paymentNotes}</p>` : ''}
              </div>
            `
          })
        } catch (emailErr) {
          console.error('Failed to send payment notification:', emailErr)
        }

        return NextResponse.json({ success: true, message: 'Payment recorded' })
      }

      case 'update_tracking': {
        const { trackingNumber: newTrackingNumber, carrierName } = body

        // Update the order with new tracking number and carrier (or remove if null)
        await prisma.order.update({
          where: { id: order.id },
          data: {
            trackingNumber: newTrackingNumber || null,
            // Update carrier if we got it from tracking lookup
            ...(carrierName && { shippingCarrier: carrierName })
          }
        })

        // Log activity
        await prisma.orderActivity.create({
          data: {
            orderId: order.id,
            type: newTrackingNumber ? 'TRACKING_ADDED' : 'TRACKING_REMOVED',
            message: newTrackingNumber
              ? `Tracking number added: ${newTrackingNumber}`
              : 'Tracking number removed',
            metadata: { trackingNumber: newTrackingNumber, updatedBy: 'Supplier' }
          }
        })

        // If adding tracking, register with Ship24
        if (newTrackingNumber) {
          try {
            const { createTracker } = await import('@/lib/ship24')
            await createTracker(newTrackingNumber)
          } catch (trackErr) {
            console.error('Failed to register tracking with Ship24:', trackErr)
          }
        }

        return NextResponse.json({ success: true, message: newTrackingNumber ? 'Tracking added' : 'Tracking removed' })
      }

      case 'get_tracking': {
        const { trackingNumber: trackNum } = body
        if (!trackNum) {
          return NextResponse.json({ error: 'Tracking number required' }, { status: 400 })
        }

        try {
          const { getTracking } = await import('@/lib/ship24')
          const trackingResult = await getTracking(trackNum)
          return NextResponse.json(trackingResult)
        } catch (trackingError) {
          console.error('Tracking lookup error:', trackingError)
          return NextResponse.json({
            success: false,
            trackingNumber: trackNum,
            error: 'Failed to fetch tracking info'
          })
        }
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error processing supplier action:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to process request'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
