// Create a manual purchase order for items without supplier quotes
// (e.g., Amazon, local store purchases)
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface ManualOrderItem {
  roomFFEItemId: string
  unitPrice: number
  quantity?: number // Defaults to item's quantity
  notes?: string
}

interface CreateManualOrderBody {
  // Vendor info
  vendorName: string
  vendorEmail?: string
  vendorUrl?: string // e.g., Amazon URL, store website

  // Items to order (must be paid items without supplier quotes)
  items: ManualOrderItem[]

  // Order details
  shippingAddress?: string
  shippingMethod?: string
  shippingCost?: number
  taxAmount?: number
  currency?: string // CAD or USD - defaults to items' currency or CAD
  notes?: string
  internalNotes?: string

  // If order was already placed externally
  alreadyOrdered?: boolean
  externalOrderNumber?: string // e.g., Amazon order #
  orderedAt?: string // ISO date
}

/**
 * POST /api/projects/[id]/procurement/orders/create-manual
 *
 * Creates a manual purchase order for items without supplier quotes.
 * Use this for Amazon, local store, or other ad-hoc purchases.
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

    const orgId = (session.user as any).orgId
    const userId = (session.user as any).id
    const { id: projectId } = await params
    const body: CreateManualOrderBody = await request.json()

    // Validate required fields
    if (!body.vendorName?.trim()) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 })
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get the FFE items
    const itemIds = body.items.map(i => i.roomFFEItemId)
    const ffeItems = await prisma.roomFFEItem.findMany({
      where: {
        id: { in: itemIds },
        room: {
          projectId,
          project: { orgId }
        }
      },
      select: {
        id: true,
        name: true,
        description: true,
        quantity: true,
        unitType: true,
        currency: true,
        room: { select: { name: true } },
        orderItems: {
          select: {
            order: { select: { orderNumber: true, status: true } }
          }
        }
      }
    })

    if (ffeItems.length !== itemIds.length) {
      const foundIds = new Set(ffeItems.map(i => i.id))
      const missingIds = itemIds.filter(id => !foundIds.has(id))
      return NextResponse.json({
        error: `Some items not found: ${missingIds.join(', ')}`
      }, { status: 404 })
    }

    // Check for items that already have orders
    const itemsWithOrders = ffeItems.filter(i => i.orderItems.length > 0)
    if (itemsWithOrders.length > 0) {
      return NextResponse.json({
        error: 'Some items already have orders',
        itemsWithOrders: itemsWithOrders.map(i => ({
          id: i.id,
          name: i.name,
          existingOrder: i.orderItems[0].order.orderNumber
        }))
      }, { status: 400 })
    }

    // Determine currency from items or use provided/default
    // Priority: body.currency > items' currency (if all same) > CAD
    let orderCurrency = 'CAD'
    if (body.currency && ['CAD', 'USD'].includes(body.currency.toUpperCase())) {
      orderCurrency = body.currency.toUpperCase()
    } else {
      // Check if all items have the same currency
      const itemCurrencies = ffeItems
        .map(i => i.currency?.toUpperCase() || 'CAD')
        .filter((v, i, a) => a.indexOf(v) === i) // unique values

      if (itemCurrencies.length === 1) {
        orderCurrency = itemCurrencies[0]
      }
      // If mixed currencies, default to CAD
    }

    // Generate order number
    const year = new Date().getFullYear()
    const existingCount = await prisma.order.count({
      where: {
        orgId,
        orderNumber: { startsWith: `PO-${year}` }
      }
    })
    const orderNumber = `PO-${year}-${String(existingCount + 1).padStart(4, '0')}`

    // Build order items with prices
    const orderItems: {
      roomFFEItemId: string
      name: string
      description: string | null
      quantity: number
      unitType: string | null
      unitPrice: number
      totalPrice: number
      status: string
      notes: string | null
    }[] = []

    let subtotal = 0

    for (const orderItem of body.items) {
      const ffeItem = ffeItems.find(i => i.id === orderItem.roomFFEItemId)!
      const quantity = orderItem.quantity || ffeItem.quantity || 1
      const totalPrice = orderItem.unitPrice * quantity

      orderItems.push({
        roomFFEItemId: ffeItem.id,
        name: ffeItem.name,
        description: ffeItem.description,
        quantity,
        unitType: ffeItem.unitType,
        unitPrice: orderItem.unitPrice,
        totalPrice,
        status: body.alreadyOrdered ? 'ORDERED' : 'PAYMENT_RECEIVED',
        notes: orderItem.notes || null
      })

      subtotal += totalPrice
    }

    // Calculate total with shipping and tax
    const shippingCost = body.shippingCost || 0
    const taxAmount = body.taxAmount || 0
    const totalAmount = subtotal + shippingCost + taxAmount

    // Create the order
    const order = await prisma.order.create({
      data: {
        orgId,
        projectId,
        orderNumber,
        vendorName: body.vendorName.trim(),
        vendorEmail: body.vendorEmail?.trim() || null,
        supplierOrderRef: body.externalOrderNumber?.trim() || null,
        status: body.alreadyOrdered ? 'ORDERED' : 'PAYMENT_RECEIVED',
        subtotal,
        shippingCost,
        taxAmount,
        totalAmount,
        currency: orderCurrency,
        shippingAddress: body.shippingAddress?.trim() || null,
        shippingMethod: body.shippingMethod?.trim() || null,
        notes: body.notes?.trim() || null,
        internalNotes: body.internalNotes?.trim() || null,
        orderedAt: body.alreadyOrdered
          ? (body.orderedAt ? new Date(body.orderedAt) : new Date())
          : null,
        createdById: userId,
        updatedById: userId,
        items: {
          create: orderItems
        },
        activities: {
          create: {
            type: 'CREATED',
            message: `Manual order created for ${body.vendorName} (${orderItems.length} items)`,
            userId,
            metadata: {
              vendorName: body.vendorName,
              vendorUrl: body.vendorUrl,
              itemCount: orderItems.length,
              isManualOrder: true,
              externalOrderNumber: body.externalOrderNumber
            }
          }
        }
      },
      include: {
        items: true
      }
    })

    // Update FFE item statuses
    await prisma.roomFFEItem.updateMany({
      where: {
        id: { in: itemIds }
      },
      data: {
        specStatus: body.alreadyOrdered ? 'ORDERED' : 'CLIENT_PAID',
        // Keep paymentStatus as is - items are already paid
      }
    })

    // If already ordered, update to ORDERED status
    if (body.alreadyOrdered) {
      await prisma.roomFFEItem.updateMany({
        where: {
          id: { in: itemIds }
        },
        data: {
          specStatus: 'ORDERED'
        }
      })
    }

    // Create activity logs for each item
    const activityPromises = itemIds.map(itemId =>
      prisma.itemActivity.create({
        data: {
          itemId: itemId,
          type: 'ADDED_TO_ORDER',
          title: `Order Created - ${body.vendorName}`,
          description: `Manual order ${orderNumber} created for ${body.vendorName}`,
          actorId: userId,
          actorType: 'user',
          metadata: {
            orderId: order.id,
            orderNumber,
            vendorName: body.vendorName,
            isManualOrder: true
          }
        }
      })
    )
    await Promise.all(activityPromises)

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        vendorName: order.vendorName,
        status: order.status,
        itemCount: orderItems.length,
        subtotal,
        totalAmount: order.totalAmount,
        currency: orderCurrency
      }
    })
  } catch (error) {
    console.error('Error creating manual order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
