// Create Purchase Orders from paid client invoice, grouped by supplier
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface SupplierGroup {
  supplierId: string | null
  supplierName: string
  supplierEmail: string | null
  items: {
    roomFFEItemId: string
    clientQuoteLineItemId: string
    supplierQuoteLineItemId: string | null
    name: string
    description: string | null
    quantity: number
    unitPrice: number // Supplier cost price
    totalPrice: number
    leadTimeWeeks: number | null
  }[]
}

/**
 * POST /api/projects/[id]/procurement/orders/create-from-invoice
 *
 * Creates POs grouped by supplier from a paid client invoice
 *
 * Body:
 * - clientQuoteId: string (the invoice ID)
 * - itemIds?: string[] (optional - specific items to order, defaults to all)
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
    const body = await request.json()
    const { clientQuoteId, itemIds } = body

    if (!clientQuoteId) {
      return NextResponse.json({ error: 'Client quote/invoice ID is required' }, { status: 400 })
    }

    // Fetch the client invoice with line items
    const clientQuote = await prisma.clientQuote.findFirst({
      where: {
        id: clientQuoteId,
        projectId,
        orgId
      },
      include: {
        lineItems: {
          include: {
            roomFFEItem: {
              include: {
                // Get the accepted supplier quote
                acceptedQuoteLineItem: {
                  include: {
                    supplierQuote: {
                      include: {
                        supplier: true
                      }
                    }
                  }
                },
                // Also get all quotes for items without accepted quote
                quoteLineItems: {
                  where: {
                    isLatestVersion: true
                  },
                  include: {
                    supplierQuote: {
                      include: {
                        supplier: true
                      }
                    }
                  },
                  orderBy: {
                    createdAt: 'desc'
                  }
                }
              }
            }
          }
        },
        payments: {
          where: {
            status: { in: ['PAID', 'PARTIAL'] }
          }
        }
      }
    })

    if (!clientQuote) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if invoice has been paid
    const totalPaid = clientQuote.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalAmount = Number(clientQuote.totalAmount) || 0

    if (totalPaid <= 0) {
      return NextResponse.json({
        error: 'Invoice has not been paid. Please record payment first.'
      }, { status: 400 })
    }

    // Filter line items to order
    let lineItemsToOrder = clientQuote.lineItems.filter(li => li.roomFFEItemId)

    if (itemIds && itemIds.length > 0) {
      lineItemsToOrder = lineItemsToOrder.filter(li =>
        itemIds.includes(li.roomFFEItemId) || itemIds.includes(li.id)
      )
    }

    if (lineItemsToOrder.length === 0) {
      return NextResponse.json({ error: 'No items to order' }, { status: 400 })
    }

    // Check which items already have orders
    const existingOrderItems = await prisma.orderItem.findMany({
      where: {
        roomFFEItemId: { in: lineItemsToOrder.map(li => li.roomFFEItemId!).filter(Boolean) }
      },
      select: {
        roomFFEItemId: true,
        orderId: true,
        order: {
          select: {
            orderNumber: true,
            status: true
          }
        }
      }
    })

    const alreadyOrderedItemIds = new Set(existingOrderItems.map(oi => oi.roomFFEItemId))

    // Filter out already ordered items
    const newItemsToOrder = lineItemsToOrder.filter(li => !alreadyOrderedItemIds.has(li.roomFFEItemId!))

    if (newItemsToOrder.length === 0) {
      const existingOrders = [...new Set(existingOrderItems.map(oi => oi.order.orderNumber))]
      return NextResponse.json({
        error: `All items already have orders: ${existingOrders.join(', ')}`,
        existingOrders: existingOrderItems.map(oi => ({
          itemId: oi.roomFFEItemId,
          orderNumber: oi.order.orderNumber,
          status: oi.order.status
        }))
      }, { status: 400 })
    }

    // Group items by supplier
    const supplierGroups: Record<string, SupplierGroup> = {}
    const itemsWithoutSupplier: typeof newItemsToOrder = []

    for (const lineItem of newItemsToOrder) {
      const roomFFEItem = lineItem.roomFFEItem
      if (!roomFFEItem) continue

      // Get the accepted quote or the most recent quote
      const acceptedQuote = roomFFEItem.acceptedQuoteLineItem
      const latestQuote = roomFFEItem.quoteLineItems?.[0]
      const supplierQuote = acceptedQuote || latestQuote

      if (!supplierQuote) {
        itemsWithoutSupplier.push(lineItem)
        continue
      }

      const supplier = supplierQuote.supplierQuote?.supplier
      const supplierId = supplier?.id || 'unknown'
      const supplierName = supplier?.name || supplierQuote.supplierQuote?.vendorName || 'Unknown Supplier'
      const supplierEmail = supplier?.email || supplierQuote.supplierQuote?.vendorEmail || null

      if (!supplierGroups[supplierId]) {
        supplierGroups[supplierId] = {
          supplierId: supplier?.id || null,
          supplierName,
          supplierEmail,
          items: []
        }
      }

      supplierGroups[supplierId].items.push({
        roomFFEItemId: roomFFEItem.id,
        clientQuoteLineItemId: lineItem.id,
        supplierQuoteLineItemId: supplierQuote.id,
        name: roomFFEItem.name,
        description: roomFFEItem.description,
        quantity: lineItem.quantity,
        unitPrice: Number(supplierQuote.unitPrice), // Supplier cost price
        totalPrice: Number(supplierQuote.totalPrice),
        leadTimeWeeks: supplierQuote.leadTimeWeeks
      })
    }

    // Generate order numbers
    const year = new Date().getFullYear()
    const existingOrders = await prisma.order.count({
      where: {
        orgId,
        orderNumber: { startsWith: `PO-${year}` }
      }
    })

    let orderCounter = existingOrders + 1
    const createdOrders: any[] = []

    // Create orders for each supplier group
    for (const [supplierId, group] of Object.entries(supplierGroups)) {
      const orderNumber = `PO-${year}-${String(orderCounter).padStart(4, '0')}`
      orderCounter++

      const subtotal = group.items.reduce((sum, item) => sum + item.totalPrice, 0)

      // Create the order
      const order = await prisma.order.create({
        data: {
          orgId,
          projectId,
          orderNumber,
          supplierId: group.supplierId,
          vendorName: group.supplierName,
          vendorEmail: group.supplierEmail,
          status: 'PAYMENT_RECEIVED', // Client has paid
          subtotal,
          totalAmount: subtotal, // Will add tax/shipping later
          currency: 'CAD',
          createdById: userId,
          updatedById: userId,
          items: {
            create: group.items.map(item => ({
              roomFFEItemId: item.roomFFEItemId,
              clientQuoteLineItemId: item.clientQuoteLineItemId,
              supplierQuoteLineItemId: item.supplierQuoteLineItemId,
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              status: 'PAYMENT_RECEIVED'
            }))
          },
          activities: {
            create: {
              type: 'CREATED',
              message: `Order created from invoice ${clientQuote.quoteNumber} (${group.items.length} items)`,
              userId,
              metadata: {
                clientQuoteId: clientQuote.id,
                clientQuoteNumber: clientQuote.quoteNumber,
                itemCount: group.items.length,
                totalPaid
              }
            }
          }
        },
        include: {
          items: true,
          supplier: true
        }
      })

      // Update item statuses
      await prisma.roomFFEItem.updateMany({
        where: {
          id: { in: group.items.map(i => i.roomFFEItemId) }
        },
        data: {
          specStatus: 'ORDERED',
          paymentStatus: 'FULLY_PAID'
        }
      })

      createdOrders.push({
        id: order.id,
        orderNumber: order.orderNumber,
        supplierName: group.supplierName,
        supplierEmail: group.supplierEmail,
        itemCount: group.items.length,
        subtotal,
        status: order.status
      })
    }

    // Log activity on the client quote
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId,
        type: 'ORDERS_CREATED',
        description: `${createdOrders.length} purchase order${createdOrders.length > 1 ? 's' : ''} created: ${createdOrders.map(o => o.orderNumber).join(', ')}`,
        userId,
        metadata: {
          orders: createdOrders.map(o => ({ id: o.id, number: o.orderNumber }))
        }
      }
    })

    return NextResponse.json({
      success: true,
      orders: createdOrders,
      itemsWithoutSupplier: itemsWithoutSupplier.map(li => ({
        id: li.roomFFEItemId,
        name: li.displayName,
        reason: 'No supplier quote found'
      })),
      skippedItems: existingOrderItems.map(oi => ({
        itemId: oi.roomFFEItemId,
        orderNumber: oi.order.orderNumber,
        reason: 'Already has an order'
      }))
    })
  } catch (error) {
    console.error('Error creating orders from invoice:', error)
    return NextResponse.json({ error: 'Failed to create orders' }, { status: 500 })
  }
}

/**
 * GET /api/projects/[id]/procurement/orders/create-from-invoice?clientQuoteId=xxx
 *
 * Preview what orders will be created (dry run)
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

    const orgId = (session.user as any).orgId
    const { id: projectId } = await params

    const { searchParams } = new URL(request.url)
    const clientQuoteId = searchParams.get('clientQuoteId')

    if (!clientQuoteId) {
      return NextResponse.json({ error: 'clientQuoteId is required' }, { status: 400 })
    }

    // Fetch the client invoice with line items
    const clientQuote = await prisma.clientQuote.findFirst({
      where: {
        id: clientQuoteId,
        projectId,
        orgId
      },
      include: {
        lineItems: {
          include: {
            roomFFEItem: {
              include: {
                acceptedQuoteLineItem: {
                  include: {
                    supplierQuote: {
                      include: {
                        supplier: true
                      }
                    }
                  }
                },
                quoteLineItems: {
                  where: { isLatestVersion: true },
                  include: {
                    supplierQuote: {
                      include: {
                        supplier: true
                      }
                    }
                  },
                  orderBy: { createdAt: 'desc' }
                },
                orderItems: {
                  include: {
                    order: {
                      select: {
                        orderNumber: true,
                        status: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        payments: {
          where: { status: { in: ['PAID', 'PARTIAL'] } }
        }
      }
    })

    if (!clientQuote) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const totalPaid = clientQuote.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalAmount = Number(clientQuote.totalAmount) || 0

    // Group items by supplier for preview
    const supplierGroups: Record<string, {
      supplierId: string | null
      supplierName: string
      supplierEmail: string | null
      items: any[]
      subtotal: number
    }> = {}

    const itemsWithoutSupplier: any[] = []
    const alreadyOrderedItems: any[] = []

    for (const lineItem of clientQuote.lineItems) {
      const roomFFEItem = lineItem.roomFFEItem
      if (!roomFFEItem) continue

      // Check if already ordered
      if (roomFFEItem.orderItems && roomFFEItem.orderItems.length > 0) {
        alreadyOrderedItems.push({
          id: roomFFEItem.id,
          name: roomFFEItem.name,
          existingOrder: roomFFEItem.orderItems[0].order.orderNumber,
          status: roomFFEItem.orderItems[0].order.status
        })
        continue
      }

      const acceptedQuote = roomFFEItem.acceptedQuoteLineItem
      const latestQuote = roomFFEItem.quoteLineItems?.[0]
      const supplierQuote = acceptedQuote || latestQuote

      if (!supplierQuote) {
        itemsWithoutSupplier.push({
          id: roomFFEItem.id,
          name: roomFFEItem.name,
          reason: 'No supplier quote'
        })
        continue
      }

      const supplier = supplierQuote.supplierQuote?.supplier
      const supplierId = supplier?.id || 'unknown'
      const supplierName = supplier?.name || supplierQuote.supplierQuote?.vendorName || 'Unknown Supplier'

      if (!supplierGroups[supplierId]) {
        supplierGroups[supplierId] = {
          supplierId: supplier?.id || null,
          supplierName,
          supplierEmail: supplier?.email || supplierQuote.supplierQuote?.vendorEmail || null,
          items: [],
          subtotal: 0
        }
      }

      const itemTotal = Number(supplierQuote.totalPrice)
      supplierGroups[supplierId].items.push({
        id: roomFFEItem.id,
        name: roomFFEItem.name,
        quantity: lineItem.quantity,
        unitPrice: Number(supplierQuote.unitPrice),
        totalPrice: itemTotal,
        leadTimeWeeks: supplierQuote.leadTimeWeeks,
        hasAcceptedQuote: !!acceptedQuote
      })
      supplierGroups[supplierId].subtotal += itemTotal
    }

    return NextResponse.json({
      invoice: {
        id: clientQuote.id,
        number: clientQuote.quoteNumber,
        title: clientQuote.title,
        totalAmount,
        totalPaid,
        isPaid: totalPaid >= totalAmount,
        paymentPercent: totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0
      },
      orders: Object.values(supplierGroups).map(group => ({
        supplierName: group.supplierName,
        supplierEmail: group.supplierEmail,
        itemCount: group.items.length,
        subtotal: group.subtotal,
        items: group.items
      })),
      itemsWithoutSupplier,
      alreadyOrderedItems,
      canCreateOrders: totalPaid > 0 && Object.keys(supplierGroups).length > 0
    })
  } catch (error) {
    console.error('Error previewing orders:', error)
    return NextResponse.json({ error: 'Failed to preview orders' }, { status: 500 })
  }
}
