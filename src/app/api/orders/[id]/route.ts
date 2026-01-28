import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/[id]
 * Get a specific order with full details
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

    const order = await prisma.order.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        orgId: true,
        projectId: true,
        orderNumber: true,
        supplierOrderRef: true,
        supplierId: true,
        vendorName: true,
        vendorEmail: true,
        status: true,
        subtotal: true,
        taxAmount: true,
        shippingCost: true,
        extraCharges: true,
        totalAmount: true,
        currency: true,
        orderedAt: true,
        confirmedAt: true,
        expectedShipDate: true,
        actualShipDate: true,
        expectedDelivery: true,
        actualDelivery: true,
        shippingMethod: true,
        trackingNumber: true,
        trackingUrl: true,
        shippingCarrier: true,
        shippingAddress: true,
        billingAddress: true,
        depositRequired: true,
        depositPercent: true,
        depositPaid: true,
        depositPaidAt: true,
        balanceDue: true,
        balancePaidAt: true,
        supplierPaidAt: true,
        supplierPaymentMethod: true,
        supplierPaymentRef: true,
        supplierPaymentAmount: true,
        supplierPaymentNotes: true,
        savedPaymentMethodId: true,
        paymentCardBrand: true,
        paymentCardLastFour: true,
        paymentCardHolderName: true,
        paymentCardExpiry: true,
        notes: true,
        internalNotes: true,
        supplierAccessToken: true,
        supplierViewedAt: true,
        supplierConfirmedAt: true,
        supplierConfirmedBy: true,
        createdById: true,
        updatedById: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            client: {
              select: {
                id: true,
                name: true,
                email: true
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
            address: true
          }
        },
        createdBy: {
          select: { id: true, name: true }
        },
        updatedBy: {
          select: { id: true, name: true }
        },
        items: {
          select: {
            id: true,
            name: true,
            description: true,
            roomName: true,
            imageUrl: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            isComponent: true,
            parentItemId: true,
            status: true,
            roomFFEItem: {
              select: {
                id: true,
                name: true,
                description: true,
                images: true,
                modelNumber: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        documents: {
          select: {
            id: true,
            type: true,
            title: true,
            description: true,
            fileName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        },
        activities: {
          select: {
            id: true,
            type: true,
            message: true,
            createdAt: true,
            user: {
              select: { id: true, name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        savedPaymentMethod: {
          select: {
            id: true,
            type: true,
            nickname: true,
            lastFour: true,
            cardBrand: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // If order has no linked supplier but has vendorName, try to find matching supplier in phonebook
    let supplierFromPhonebook = order.supplier
    if (!order.supplier && order.vendorName) {
      const matchingSupplier = await prisma.supplier.findFirst({
        where: {
          orgId,
          name: {
            equals: order.vendorName,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          contactName: true,
          address: true
        }
      })
      if (matchingSupplier) {
        supplierFromPhonebook = matchingSupplier
      }
    }

    return NextResponse.json({
      order: {
        ...order,
        supplier: supplierFromPhonebook
      }
    })
  } catch (error) {
    console.error('Error fetching order:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch order', details: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/orders/[id]
 * Update an order
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
    const body = await request.json()
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const existing = await prisma.order.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const {
      status,
      supplierOrderRef,
      trackingNumber,
      trackingUrl,
      shippingCarrier,
      shippingAddress,
      shippingMethod,
      expectedShipDate,
      actualShipDate,
      expectedDelivery,
      actualDelivery,
      notes,
      internalNotes,
      // Supplier payment fields
      supplierPaidAt,
      supplierPaymentMethod,
      supplierPaymentAmount,
      supplierPaymentRef,
      supplierPaymentNotes
    } = body

    const updateData: any = {
      ...(supplierOrderRef !== undefined && { supplierOrderRef }),
      ...(trackingNumber !== undefined && { trackingNumber }),
      ...(trackingUrl !== undefined && { trackingUrl }),
      ...(shippingCarrier !== undefined && { shippingCarrier }),
      ...(shippingAddress !== undefined && { shippingAddress }),
      ...(shippingMethod !== undefined && { shippingMethod }),
      ...(expectedShipDate !== undefined && { expectedShipDate: expectedShipDate ? new Date(expectedShipDate) : null }),
      ...(actualShipDate !== undefined && { actualShipDate: actualShipDate ? new Date(actualShipDate) : null }),
      ...(expectedDelivery !== undefined && { expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null }),
      ...(actualDelivery !== undefined && { actualDelivery: actualDelivery ? new Date(actualDelivery) : null }),
      ...(notes !== undefined && { notes }),
      ...(internalNotes !== undefined && { internalNotes }),
      // Supplier payment fields
      ...(supplierPaidAt !== undefined && { supplierPaidAt: supplierPaidAt ? new Date(supplierPaidAt) : null }),
      ...(supplierPaymentMethod !== undefined && { supplierPaymentMethod }),
      ...(supplierPaymentAmount !== undefined && { supplierPaymentAmount }),
      ...(supplierPaymentRef !== undefined && { supplierPaymentRef }),
      ...(supplierPaymentNotes !== undefined && { supplierPaymentNotes }),
      updatedById: userId
    }

    // Handle status transitions
    if (status !== undefined && status !== existing.status) {
      updateData.status = status

      // Set relevant timestamps based on status
      if (status === 'ORDERED' && !existing.orderedAt) {
        updateData.orderedAt = new Date()
      } else if (status === 'CONFIRMED' && !existing.confirmedAt) {
        updateData.confirmedAt = new Date()
      } else if (status === 'SHIPPED' && !existing.actualShipDate) {
        updateData.actualShipDate = new Date()
      } else if (status === 'DELIVERED' && !existing.actualDelivery) {
        updateData.actualDelivery = new Date()
      }
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: { id: true, name: true }
        },
        supplier: {
          select: { id: true, name: true }
        },
        items: true
      }
    })

    // Log status changes
    if (status && status !== existing.status) {
      await prisma.orderActivity.create({
        data: {
          orderId: id,
          type: 'STATUS_CHANGED',
          message: `Status changed from ${existing.status} to ${status}`,
          userId
        }
      })
    }

    // Log tracking updates
    if (trackingNumber && trackingNumber !== existing.trackingNumber) {
      await prisma.orderActivity.create({
        data: {
          orderId: id,
          type: 'TRACKING_UPDATED',
          message: `Tracking number updated: ${trackingNumber}`,
          userId
        }
      })
    }

    // Log payment recording
    if (supplierPaymentAmount && supplierPaymentAmount !== Number(existing.supplierPaymentAmount)) {
      await prisma.orderActivity.create({
        data: {
          orderId: id,
          type: 'PAYMENT_RECORDED',
          message: `Payment to supplier recorded: $${supplierPaymentAmount.toFixed(2)} via ${supplierPaymentMethod || 'unknown'}${supplierPaymentRef ? ` (Ref: ${supplierPaymentRef})` : ''}`,
          userId,
          metadata: {
            amount: supplierPaymentAmount,
            method: supplierPaymentMethod,
            reference: supplierPaymentRef
          }
        }
      })
    }

    return NextResponse.json({ order })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/orders/[id]
 * Perform actions on an order (place, confirm, ship, etc.)
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
    const body = await request.json()
    const { action, ...data } = body

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const order = await prisma.order.findFirst({
      where: { id, orgId },
      include: {
        supplier: true,
        items: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    switch (action) {
      case 'place_order':
        // Send PO to supplier
        if (!order.supplierId && !order.vendorEmail) {
          return NextResponse.json(
            { error: 'Supplier email required' },
            { status: 400 }
          )
        }

        await prisma.order.update({
          where: { id },
          data: {
            status: 'ORDERED',
            orderedAt: new Date(),
            updatedById: userId
          }
        })

        // TODO: Send PO email to supplier

        await prisma.orderActivity.create({
          data: {
            orderId: id,
            type: 'ORDER_PLACED',
            message: 'Purchase order placed with supplier',
            userId
          }
        })

        return NextResponse.json({ success: true, action: 'order_placed' })

      case 'add_tracking':
        const { trackingNumber, carrier, trackingUrl } = data

        await prisma.order.update({
          where: { id },
          data: {
            trackingNumber,
            shippingCarrier: carrier,
            trackingUrl,
            status: order.status === 'ORDERED' || order.status === 'CONFIRMED' ? 'SHIPPED' : order.status,
            actualShipDate: order.actualShipDate || new Date(),
            updatedById: userId
          }
        })

        await prisma.orderActivity.create({
          data: {
            orderId: id,
            type: 'TRACKING_ADDED',
            message: `Tracking: ${carrier} ${trackingNumber}`,
            userId,
            metadata: { trackingNumber, carrier, trackingUrl }
          }
        })

        return NextResponse.json({ success: true, action: 'tracking_added' })

      case 'mark_delivered':
        const { deliveryDate, recipientName, signedBy, notes } = data

        await prisma.$transaction([
          prisma.order.update({
            where: { id },
            data: {
              status: 'DELIVERED',
              actualDelivery: deliveryDate ? new Date(deliveryDate) : new Date(),
              notes: notes || order.notes,
              updatedById: userId
            }
          }),
          prisma.orderItem.updateMany({
            where: { orderId: id },
            data: {
              status: 'DELIVERED',
              actualDelivery: deliveryDate ? new Date(deliveryDate) : new Date()
            }
          })
        ])

        await prisma.orderActivity.create({
          data: {
            orderId: id,
            type: 'DELIVERED',
            message: `Order delivered${signedBy ? ` - Signed by: ${signedBy}` : ''}`,
            userId,
            metadata: { deliveryDate, recipientName, signedBy }
          }
        })

        return NextResponse.json({ success: true, action: 'marked_delivered' })

      case 'pay_supplier':
        // Record payment to supplier
        const { paymentMethod, paymentRef, paymentAmount, paymentNotes } = data

        if (!paymentMethod) {
          return NextResponse.json(
            { error: 'Payment method is required' },
            { status: 400 }
          )
        }

        const amount = paymentAmount || parseFloat(order.totalAmount?.toString() || '0')

        await prisma.order.update({
          where: { id },
          data: {
            supplierPaidAt: new Date(),
            supplierPaymentMethod: paymentMethod,
            supplierPaymentRef: paymentRef || null,
            supplierPaymentAmount: amount,
            supplierPaymentNotes: paymentNotes || null,
            updatedById: userId
          }
        })

        await prisma.orderActivity.create({
          data: {
            orderId: id,
            type: 'SUPPLIER_PAID',
            message: `Supplier paid $${amount.toFixed(2)} via ${paymentMethod}${paymentRef ? ` (Ref: ${paymentRef})` : ''}`,
            userId,
            metadata: { paymentMethod, paymentRef, paymentAmount: amount }
          }
        })

        return NextResponse.json({ success: true, action: 'supplier_paid' })

      case 'cancel':
        const { reason } = data

        if (['DELIVERED', 'INSTALLED', 'COMPLETED'].includes(order.status)) {
          return NextResponse.json(
            { error: 'Cannot cancel a delivered order' },
            { status: 400 }
          )
        }

        await prisma.order.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            internalNotes: `${order.internalNotes || ''}\n\nCancellation reason: ${reason || 'No reason provided'}`.trim(),
            updatedById: userId
          }
        })

        await prisma.orderActivity.create({
          data: {
            orderId: id,
            type: 'CANCELLED',
            message: `Order cancelled${reason ? `: ${reason}` : ''}`,
            userId
          }
        })

        return NextResponse.json({ success: true, action: 'cancelled' })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing order action:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/orders/[id]
 * Delete an order (only if pending/not yet shipped)
 * Items will go back to "Ready to Order" status
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

    const existing = await prisma.order.findFirst({
      where: { id, orgId },
      include: {
        items: {
          select: { roomFFEItemId: true }
        }
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Get the RoomFFEItem IDs to reset their status
    const roomFFEItemIds = existing.items
      .map(item => item.roomFFEItemId)
      .filter((id): id is string => id !== null)

    // Use transaction to delete order and all related records
    await prisma.$transaction(async (tx) => {
      // Delete order activities
      await tx.orderActivity.deleteMany({
        where: { orderId: id }
      })

      // Delete supplier messages
      await tx.supplierMessage.deleteMany({
        where: { orderId: id }
      })

      // Delete deliveries
      await tx.delivery.deleteMany({
        where: { orderId: id }
      })

      // Delete order items
      await tx.orderItem.deleteMany({
        where: { orderId: id }
      })

      // Delete the order
      await tx.order.delete({
        where: { id }
      })

      // Reset the RoomFFEItems specStatus based on their payment status
      if (roomFFEItemIds.length > 0) {
        // Set to CLIENT_PAID if client has paid (deposit or full)
        await tx.roomFFEItem.updateMany({
          where: {
            id: { in: roomFFEItemIds },
            paymentStatus: { in: ['DEPOSIT_PAID', 'FULLY_PAID'] }
          },
          data: { specStatus: 'CLIENT_PAID' }
        })

        // Set to QUOTE_APPROVED if client hasn't paid yet
        await tx.roomFFEItem.updateMany({
          where: {
            id: { in: roomFFEItemIds },
            paymentStatus: { in: ['NOT_INVOICED', 'INVOICED'] }
          },
          data: { specStatus: 'QUOTE_APPROVED' }
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting order:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to delete order', details: errorMessage },
      { status: 500 }
    )
  }
}
