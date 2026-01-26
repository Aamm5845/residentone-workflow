import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/orders
 * Get all orders for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)

    const projectId = searchParams.get('projectId')
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { orgId }

    if (projectId) {
      where.projectId = projectId
    }

    if (supplierId) {
      where.supplierId = supplierId
    }

    if (status) {
      where.status = status
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          createdBy: {
            select: { id: true, name: true }
          },
          _count: {
            select: {
              items: true,
              deliveries: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.order.count({ where })
    ])

    // Add payment summary to each order
    const ordersWithPayment = orders.map(order => {
      const totalAmount = Number(order.totalAmount) || 0
      const depositRequired = Number(order.depositRequired) || 0
      const depositPaid = Number(order.depositPaid) || 0
      const supplierPaymentAmount = Number(order.supplierPaymentAmount) || 0

      let paymentStatus: 'NOT_STARTED' | 'DEPOSIT_PAID' | 'FULLY_PAID' | 'OVERPAID' = 'NOT_STARTED'
      if (supplierPaymentAmount >= totalAmount && totalAmount > 0) {
        paymentStatus = supplierPaymentAmount > totalAmount ? 'OVERPAID' : 'FULLY_PAID'
      } else if (depositPaid > 0) {
        paymentStatus = 'DEPOSIT_PAID'
      }

      return {
        ...order,
        paymentSummary: {
          totalAmount,
          depositRequired,
          depositPaid,
          supplierPaymentAmount,
          remainingBalance: Math.max(0, totalAmount - supplierPaymentAmount),
          paymentStatus
        }
      }
    })

    return NextResponse.json({
      orders: ordersWithPayment,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/orders
 * Create a new order from approved client quote
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      projectId,
      clientQuoteId, // Optional: create from approved client quote
      supplierId,
      vendorName,
      vendorEmail,
      shippingAddress,
      shippingMethod,
      notes,
      internalNotes,
      items // Manual order items if not from quote
    } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Generate order number
    const year = new Date().getFullYear()
    const lastOrder = await prisma.order.findFirst({
      where: {
        orgId,
        orderNumber: { startsWith: `PO-${year}-` }
      },
      orderBy: { orderNumber: 'desc' }
    })

    let nextNumber = 1
    if (lastOrder) {
      const match = lastOrder.orderNumber.match(/PO-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const orderNumber = `PO-${year}-${String(nextNumber).padStart(4, '0')}`

    let orderItems: any[] = []
    let subtotal = 0

    if (clientQuoteId) {
      // Create from approved client quote
      const clientQuote = await prisma.clientQuote.findFirst({
        where: { id: clientQuoteId, orgId, status: 'APPROVED' },
        include: {
          lineItems: {
            include: {
              supplierQuote: {
                include: {
                  lineItems: true
                }
              }
            }
          },
          payments: {
            where: { status: 'PAID' }
          }
        }
      })

      if (!clientQuote) {
        return NextResponse.json(
          { error: 'Approved client quote not found' },
          { status: 404 }
        )
      }

      // Check if payment received
      const totalPaid = clientQuote.payments.reduce(
        (sum, p) => sum + parseFloat(p.amount.toString()),
        0
      )
      const requiredPayment = clientQuote.depositRequired
        ? parseFloat(clientQuote.depositAmount?.toString() || '0')
        : parseFloat(clientQuote.totalAmount?.toString() || '0')

      if (totalPaid < requiredPayment) {
        return NextResponse.json(
          { error: 'Insufficient payment received' },
          { status: 400 }
        )
      }

      // Build order items from quote line items (at cost price)
      for (const item of clientQuote.lineItems) {
        orderItems.push({
          clientQuoteLineItemId: item.id,
          roomFFEItemId: item.roomFFEItemId,
          name: item.itemName,
          description: item.itemDescription,
          quantity: item.quantity,
          unitType: item.unitType,
          unitPrice: item.costPrice || 0,
          totalPrice: item.totalCost || 0
        })
        subtotal += parseFloat(item.totalCost?.toString() || '0')
      }
    } else if (items?.length) {
      // Manual order items
      for (const item of items) {
        orderItems.push({
          roomFFEItemId: item.roomFFEItemId,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity || 1,
          unitType: item.unitType || 'units',
          unitPrice: item.unitPrice || 0,
          totalPrice: (item.unitPrice || 0) * (item.quantity || 1)
        })
        subtotal += (item.unitPrice || 0) * (item.quantity || 1)
      }
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        orgId,
        projectId,
        orderNumber,
        supplierId: supplierId || null,
        vendorName: vendorName || null,
        vendorEmail: vendorEmail || null,
        status: 'PENDING_PAYMENT',
        subtotal,
        totalAmount: subtotal, // TODO: Add tax and shipping
        currency: 'CAD', // Default currency
        shippingAddress: shippingAddress || null,
        shippingMethod: shippingMethod || null,
        notes: notes || null,
        internalNotes: internalNotes || null,
        createdById: userId,
        updatedById: userId,
        items: {
          create: orderItems
        }
      },
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

    // Create activity log
    await prisma.orderActivity.create({
      data: {
        orderId: order.id,
        type: 'CREATED',
        message: `Order ${orderNumber} created`,
        userId
      }
    })

    return NextResponse.json({ order })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}
