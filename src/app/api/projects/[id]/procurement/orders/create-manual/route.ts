// Create a manual purchase order for items without supplier quotes
// (e.g., Amazon, local store purchases)
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Ensure URLs use https to avoid mixed content warnings
function ensureHttps(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://')
  }
  return url
}

/**
 * GET /api/projects/[id]/procurement/orders/create-manual
 *
 * Get all items that can be added to a PO (regardless of status)
 * Includes components and quote matching info
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

    // Get supplier filter from query
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')
    const showAll = searchParams.get('showAll') === 'true' // Include already ordered items

    // Get all sections for this project
    const projectSections = await prisma.roomFFESection.findMany({
      where: {
        instance: {
          room: {
            projectId,
            project: { orgId }
          }
        }
      },
      select: { id: true }
    })

    const sectionIds = projectSections.map(s => s.id)

    if (sectionIds.length === 0) {
      return NextResponse.json({ items: [], suppliers: [] })
    }

    // Get all spec items (visible ones)
    const items = await prisma.roomFFEItem.findMany({
      where: {
        sectionId: { in: sectionIds },
        isSpecItem: true,
        visibility: 'VISIBLE'
      },
      include: {
        section: {
          include: {
            instance: {
              include: {
                room: { select: { name: true } }
              }
            }
          }
        },
        // Get accepted quote
        acceptedQuoteLineItem: {
          include: {
            supplierQuote: {
              include: {
                supplierRFQ: {
                  include: {
                    supplier: true
                  }
                }
              }
            }
          }
        },
        // Get all quotes
        allQuoteLineItems: {
          where: { isLatestVersion: true },
          include: {
            supplierQuote: {
              include: {
                supplierRFQ: {
                  include: {
                    supplier: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        // Get components
        components: {
          orderBy: { order: 'asc' }
        },
        // Check if already ordered
        orderItems: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true
              }
            }
          }
        }
      },
      orderBy: [
        { section: { name: 'asc' } },
        { name: 'asc' }
      ]
    })

    // Build unique suppliers list
    const suppliersMap = new Map<string, any>()

    // Transform items with quote matching info
    const transformedItems = items.map(item => {
      const acceptedQuote = item.acceptedQuoteLineItem
      const latestQuote = item.allQuoteLineItems?.[0]
      const quote = acceptedQuote || latestQuote

      // Track supplier
      if (quote?.supplierQuote?.supplierRFQ?.supplier) {
        const supplier = quote.supplierQuote.supplierRFQ.supplier
        if (!suppliersMap.has(supplier.id)) {
          suppliersMap.set(supplier.id, {
            id: supplier.id,
            name: supplier.name,
            email: supplier.email
          })
        }
      }

      // Calculate component totals
      const componentsTotal = (item.components || []).reduce((sum, c) => {
        return sum + (c.price ? Number(c.price) * (c.quantity || 1) : 0)
      }, 0)

      // Check quote matching
      const itemTradePrice = item.tradePrice ? Number(item.tradePrice) : null
      const quoteUnitPrice = quote ? Number(quote.unitPrice) : null
      const priceMatches = itemTradePrice && quoteUnitPrice
        ? Math.abs(itemTradePrice - quoteUnitPrice) < 0.01
        : null

      // Check if already ordered
      const existingOrder = item.orderItems?.[0]?.order

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        roomName: item.section?.instance?.room?.name,
        categoryName: item.section?.name,
        quantity: item.quantity || 1,
        imageUrl: ensureHttps(item.images?.[0]),
        specStatus: item.specStatus,

        // Pricing
        tradePrice: itemTradePrice,
        rrp: item.rrp ? Number(item.rrp) : null,
        currency: item.currency || 'CAD',

        // Components
        components: (item.components || []).map(c => ({
          id: c.id,
          name: c.name,
          modelNumber: c.modelNumber,
          price: c.price ? Number(c.price) : null,
          quantity: c.quantity || 1,
          total: c.price ? Number(c.price) * (c.quantity || 1) : 0
        })),
        componentsTotal,

        // Quote info
        hasQuote: !!quote,
        quote: quote ? {
          id: quote.id,
          supplierId: quote.supplierQuote?.supplierRFQ?.supplier?.id || null,
          supplierName: quote.supplierQuote?.supplierRFQ?.supplier?.name ||
                        quote.supplierQuote?.supplierRFQ?.vendorName || 'Unknown',
          unitPrice: quoteUnitPrice,
          totalPrice: Number(quote.totalPrice),
          quantity: quote.quantity,
          leadTimeWeeks: quote.leadTimeWeeks,
          isAccepted: quote.isAccepted || !!acceptedQuote,
          // Quote-level info
          shippingCost: quote.supplierQuote?.shippingCost ? Number(quote.supplierQuote.shippingCost) : null,
          depositRequired: quote.supplierQuote?.depositRequired ? Number(quote.supplierQuote.depositRequired) : null,
          depositPercent: quote.supplierQuote?.depositPercent ? Number(quote.supplierQuote.depositPercent) : null,
          paymentTerms: quote.supplierQuote?.paymentTerms,
          currency: quote.currency || 'CAD'
        } : null,

        // Quote matching
        quoteMatch: {
          priceMatches,
          quantityMatches: quote ? (item.quantity || 1) === quote.quantity : null,
          itemPrice: itemTradePrice,
          quotePrice: quoteUnitPrice,
          priceDifference: itemTradePrice && quoteUnitPrice
            ? Math.abs(itemTradePrice - quoteUnitPrice)
            : null
        },

        // Order status
        isOrdered: !!existingOrder,
        existingOrder: existingOrder ? {
          id: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          status: existingOrder.status
        } : null
      }
    })

    // Filter by supplier if specified
    let filteredItems = supplierId
      ? transformedItems.filter(item => item.quote?.supplierId === supplierId)
      : transformedItems

    // Filter out already ordered items unless showAll is true
    if (!showAll) {
      filteredItems = filteredItems.filter(item => !item.isOrdered)
    }

    return NextResponse.json({
      items: filteredItems,
      suppliers: Array.from(suppliersMap.values()),
      summary: {
        totalItems: filteredItems.length,
        itemsWithQuotes: filteredItems.filter(i => i.hasQuote).length,
        itemsWithoutQuotes: filteredItems.filter(i => !i.hasQuote).length,
        alreadyOrdered: transformedItems.filter(i => i.isOrdered).length,
        priceMatches: filteredItems.filter(i => i.quoteMatch.priceMatches === true).length,
        priceMismatches: filteredItems.filter(i => i.quoteMatch.priceMatches === false).length,
        totalComponents: filteredItems.reduce((sum, i) => sum + i.components.length, 0)
      }
    })
  } catch (error) {
    console.error('Error fetching items for manual order:', error)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}

interface ManualOrderItem {
  roomFFEItemId: string
  unitPrice: number
  quantity?: number // Defaults to item's quantity
  notes?: string
  includeComponents?: boolean // Whether to include components as separate line items
}

interface ExtraCharge {
  label: string
  amount: number
}

interface CreateManualOrderBody {
  // Vendor/Supplier info
  supplierId?: string // Link to existing supplier
  vendorName: string
  vendorEmail?: string
  vendorUrl?: string // e.g., Amazon URL, store website

  // Items to order
  items: ManualOrderItem[]

  // Order details
  shippingRecipientName?: string // Name from saved address (e.g., "Warehouse") or client name
  shippingAddress?: string
  shippingMethod?: string
  shippingCost?: number
  extraCharges?: ExtraCharge[] // Additional charges like customs, handling, etc.
  taxAmount?: number
  currency?: string // CAD or USD - defaults to items' currency or CAD
  notes?: string
  internalNotes?: string

  // Tax options
  includeGst?: boolean
  includeQst?: boolean

  // Deposit tracking
  depositRequired?: number
  depositPercent?: number
  paymentTerms?: string
  shippingTerms?: string

  // Payment method for supplier to charge
  savedPaymentMethodId?: string

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

    // Get the FFE items with components and quotes
    const itemIds = body.items.map(i => i.roomFFEItemId)
    const ffeItems = await prisma.roomFFEItem.findMany({
      where: {
        id: { in: itemIds },
        section: {
          instance: {
            room: {
              projectId,
              project: { orgId }
            }
          }
        }
      },
      include: {
        section: {
          include: {
            instance: {
              include: {
                room: { select: { name: true } }
              }
            }
          }
        },
        components: {
          orderBy: { order: 'asc' }
        },
        acceptedQuoteLineItem: {
          include: {
            supplierQuote: true
          }
        },
        allQuoteLineItems: {
          where: { isLatestVersion: true },
          take: 1
        },
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

    // Generate order number - find the highest existing number to avoid collisions
    const year = new Date().getFullYear()
    const latestOrder = await prisma.order.findFirst({
      where: {
        orgId,
        orderNumber: { startsWith: `PO-${year}` }
      },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true }
    })

    let nextNumber = 1
    if (latestOrder?.orderNumber) {
      // Extract the number from PO-2026-0005 format
      const match = latestOrder.orderNumber.match(/PO-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1
      }
    }
    const orderNumber = `PO-${year}-${String(nextNumber).padStart(4, '0')}`

    // Build order items with prices (including components)
    const orderItems: any[] = []
    let subtotal = 0

    for (const orderItem of body.items) {
      const ffeItem = ffeItems.find(i => i.id === orderItem.roomFFEItemId)!
      const quantity = orderItem.quantity || ffeItem.quantity || 1
      const totalPrice = orderItem.unitPrice * quantity

      // Get quote line item ID if available
      const quoteLineItem = ffeItem.acceptedQuoteLineItem || ffeItem.allQuoteLineItems?.[0]

      // Get room name from the section -> instance -> room
      const roomName = ffeItem.section?.instance?.room?.name || null
      const itemImage = ensureHttps(ffeItem.images?.[0])

      // Add main item
      orderItems.push({
        roomFFEItemId: ffeItem.id,
        supplierQuoteLineItemId: quoteLineItem?.id || null,
        name: ffeItem.name,
        description: ffeItem.description,
        roomName,
        imageUrl: itemImage,
        quantity,
        unitType: ffeItem.unitType,
        unitPrice: orderItem.unitPrice,
        totalPrice,
        isComponent: false,
        parentItemId: null,
        status: body.alreadyOrdered ? 'ORDERED' : 'PAYMENT_RECEIVED',
        notes: orderItem.notes || null
      })
      subtotal += totalPrice

      // Add components if requested (default true)
      if (orderItem.includeComponents !== false && ffeItem.components?.length > 0) {
        for (const comp of ffeItem.components) {
          if (comp.price) {
            const compQty = comp.quantity || 1
            const compPrice = Number(comp.price)
            const compTotal = compPrice * compQty

            orderItems.push({
              roomFFEItemId: ffeItem.id,
              supplierQuoteLineItemId: null,
              componentId: comp.id,
              name: comp.name + (comp.modelNumber ? ` (${comp.modelNumber})` : ''),
              description: `Component of ${ffeItem.name}`,
              roomName,
              imageUrl: ensureHttps(comp.image),
              quantity: compQty,
              unitPrice: compPrice,
              totalPrice: compTotal,
              isComponent: true,
              parentItemId: ffeItem.id,
              status: body.alreadyOrdered ? 'ORDERED' : 'PAYMENT_RECEIVED',
              notes: null
            })
            subtotal += compTotal
          }
        }
      }
    }

    // Calculate total with shipping, extra charges, and tax
    const shippingCost = body.shippingCost || 0
    const extraChargesTotal = (body.extraCharges || []).reduce((sum, c) => sum + (c.amount || 0), 0)
    const taxAmount = body.taxAmount || 0
    const totalAmount = subtotal + shippingCost + extraChargesTotal + taxAmount

    // Calculate deposit if provided
    let depositRequired: number | null = null
    if (body.depositRequired) {
      depositRequired = parseFloat(String(body.depositRequired))
    } else if (body.depositPercent) {
      depositRequired = totalAmount * (parseFloat(String(body.depositPercent)) / 100)
    }
    const balanceDue = depositRequired ? totalAmount - depositRequired : null

    // Get payment method details if provided
    let paymentCardData: {
      paymentCardBrand: string | null
      paymentCardLastFour: string | null
      paymentCardHolderName: string | null
      paymentCardExpiry: string | null
      paymentCardNumber: string | null
      paymentCardCvv: string | null
    } = {
      paymentCardBrand: null,
      paymentCardLastFour: null,
      paymentCardHolderName: null,
      paymentCardExpiry: null,
      paymentCardNumber: null,
      paymentCardCvv: null
    }

    if (body.savedPaymentMethodId) {
      const paymentMethod = await prisma.savedPaymentMethod.findUnique({
        where: { id: body.savedPaymentMethodId }
      })

      if (paymentMethod) {
        // Build expiry string from month/year
        const expiry = paymentMethod.expiryMonth && paymentMethod.expiryYear
          ? `${String(paymentMethod.expiryMonth).padStart(2, '0')}/${String(paymentMethod.expiryYear).slice(-2)}`
          : null

        paymentCardData = {
          paymentCardBrand: paymentMethod.cardBrand,
          paymentCardLastFour: paymentMethod.lastFour,
          paymentCardHolderName: paymentMethod.holderName,
          paymentCardExpiry: expiry,
          paymentCardNumber: paymentMethod.encryptedCardNumber, // Full card number for supplier
          paymentCardCvv: paymentMethod.encryptedCvv // CVV for supplier
        }
      }
    }

    // Create the order
    let order
    try {
      order = await prisma.order.create({
        data: {
          orgId,
          projectId,
          orderNumber,
          supplierId: body.supplierId || null,
          vendorName: body.vendorName.trim(),
          vendorEmail: body.vendorEmail?.trim() || null,
          supplierOrderRef: body.externalOrderNumber?.trim() || null,
          status: body.alreadyOrdered ? 'ORDERED' : 'PAYMENT_RECEIVED',
          subtotal,
          shippingCost: shippingCost || null,
          extraCharges: body.extraCharges && body.extraCharges.length > 0 ? body.extraCharges : null,
          taxAmount: taxAmount || null,
          totalAmount,
          currency: orderCurrency,
          shippingRecipientName: body.shippingRecipientName?.trim() || null,
          shippingAddress: body.shippingAddress?.trim() || null,
          shippingMethod: body.shippingMethod?.trim() || null,
          notes: body.notes?.trim() || null,
          internalNotes: body.internalNotes?.trim() || null,
          // Deposit tracking
          depositRequired,
          depositPercent: body.depositPercent ? parseFloat(String(body.depositPercent)) : null,
          balanceDue,
          // Payment method for supplier
          savedPaymentMethodId: body.savedPaymentMethodId || null,
          // Copy card details for supplier portal
          ...paymentCardData,
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
              message: `Order created for ${body.vendorName} (${orderItems.length} items)`,
              userId,
              metadata: {
                vendorName: body.vendorName,
                vendorUrl: body.vendorUrl,
                itemCount: orderItems.length,
                isManualOrder: true,
                externalOrderNumber: body.externalOrderNumber,
                extraCharges: body.extraCharges
              }
            }
          }
        },
        include: {
          items: true
        }
      })
    } catch (createError) {
      console.error('Error creating order in database:', createError)
      const errorMsg = createError instanceof Error ? createError.message : 'Database error'
      return NextResponse.json(
        { error: 'Failed to create order in database', details: errorMsg },
        { status: 500 }
      )
    }

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
          description: `Order ${orderNumber} created for ${body.vendorName}`,
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
        currency: orderCurrency,
        // Deposit info
        depositRequired: order.depositRequired ? Number(order.depositRequired) : null,
        depositPercent: order.depositPercent ? Number(order.depositPercent) : null,
        balanceDue: order.balanceDue ? Number(order.balanceDue) : null
      }
    })
  } catch (error) {
    console.error('Error creating manual order:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Stack:', errorStack)
    return NextResponse.json(
      { error: 'Failed to create order', details: errorMessage },
      { status: 500 }
    )
  }
}
