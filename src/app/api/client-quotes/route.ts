import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client-quotes
 * Get all client quotes for the organization
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
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { orgId }

    if (projectId) {
      where.projectId = projectId
    }

    if (status) {
      where.status = status
    }

    const [quotes, total] = await Promise.all([
      prisma.clientQuote.findMany({
        where,
        include: {
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
          createdBy: {
            select: { id: true, name: true }
          },
          _count: {
            select: {
              lineItems: true,
              payments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.clientQuote.count({ where })
    ])

    return NextResponse.json({
      quotes,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error fetching client quotes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch client quotes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/client-quotes
 * Create a new client quote (from accepted supplier quotes)
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
      title,
      description,
      supplierQuoteIds, // Array of accepted supplier quote IDs
      defaultMarkupPercent,
      groupingType,
      groupTitle,
      validUntil,
      paymentTerms,
      depositRequired,
      // Bill To information
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      // Payment options
      allowCreditCard,
      lineItems: customLineItems // Optional: override with custom line items
    } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Validate custom line items if provided
    if (customLineItems && Array.isArray(customLineItems)) {
      for (let i = 0; i < customLineItems.length; i++) {
        const item = customLineItems[i]

        // Validate item name is provided
        if (!item.itemName || item.itemName.trim() === '') {
          return NextResponse.json({ error: `Line item ${i + 1}: Item name is required` }, { status: 400 })
        }

        // Validate quantity is positive
        if (item.quantity !== undefined && item.quantity !== null) {
          const qty = Number(item.quantity)
          if (isNaN(qty) || qty <= 0) {
            return NextResponse.json({ error: `Line item ${i + 1}: Quantity must be a positive number` }, { status: 400 })
          }
        }

        // Validate cost price is non-negative
        if (item.costPrice !== undefined && item.costPrice !== null) {
          const price = Number(item.costPrice)
          if (isNaN(price) || price < 0) {
            return NextResponse.json({ error: `Line item ${i + 1}: Cost price must be a non-negative number` }, { status: 400 })
          }
        }

        // Validate markup percent is reasonable (0-500%)
        if (item.markupPercent !== undefined && item.markupPercent !== null) {
          const markup = Number(item.markupPercent)
          if (isNaN(markup) || markup < 0 || markup > 500) {
            return NextResponse.json({ error: `Line item ${i + 1}: Markup percent must be between 0 and 500` }, { status: 400 })
          }
        }
      }
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

    // Generate quote number with retry logic to handle race conditions
    const year = new Date().getFullYear()
    const quoteNumber = await generateUniqueQuoteNumber(orgId, year)

    const markup = defaultMarkupPercent || 25

    // Build line items from supplier quotes or custom items
    let lineItemsData: any[] = []

    if (supplierQuoteIds?.length) {
      // Get supplier quote line items with item and supplier markup info
      for (const sqId of supplierQuoteIds) {
        const supplierQuote = await prisma.supplierQuote.findFirst({
          where: { id: sqId },
          include: {
            supplierRFQ: {
              include: {
                supplier: {
                  select: { markupPercent: true }
                }
              }
            },
            lineItems: {
              include: {
                rfqLineItem: {
                  include: {
                    roomFFEItem: {
                      select: {
                        id: true,
                        name: true,
                        markupPercent: true, // Item's saved markup
                        section: {
                          select: {
                            name: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })

        if (!supplierQuote) continue

        // Get supplier's default markup as fallback
        const supplierMarkup = supplierQuote.supplierRFQ?.supplier?.markupPercent
          ? parseFloat(supplierQuote.supplierRFQ.supplier.markupPercent.toString())
          : null

        for (const item of supplierQuote.lineItems) {
          const category = item.rfqLineItem.roomFFEItem?.section?.name || 'General'

          // Priority: Item's markupPercent > Supplier's markupPercent > Default markup
          const itemStoredMarkup = item.rfqLineItem.roomFFEItem?.markupPercent
            ? parseFloat(item.rfqLineItem.roomFFEItem.markupPercent.toString())
            : null
          const itemMarkup = itemStoredMarkup ?? supplierMarkup ?? markup

          const costPrice = parseFloat(item.unitPrice.toString())
          // Round to 2 decimal places for currency precision
          const sellingPrice = Math.round(costPrice * (1 + itemMarkup / 100) * 100) / 100
          const markupAmount = Math.round((sellingPrice - costPrice) * item.quantity * 100) / 100
          const clientTotal = Math.round(sellingPrice * item.quantity * 100) / 100

          lineItemsData.push({
            supplierQuoteId: sqId,
            roomFFEItemId: item.rfqLineItem.roomFFEItemId,
            groupId: category, // Group by category by default
            displayName: item.rfqLineItem.itemName,
            displayDescription: item.rfqLineItem.itemDescription,
            categoryName: category,
            quantity: item.quantity,
            unitType: item.rfqLineItem.unitType,
            supplierUnitPrice: item.unitPrice,
            supplierTotalPrice: item.totalPrice,
            markupType: 'PERCENTAGE',
            markupValue: itemMarkup,
            markupAmount: new Decimal(markupAmount),
            clientUnitPrice: sellingPrice,
            clientTotalPrice: new Decimal(clientTotal)
          })
        }
      }
    } else if (customLineItems?.length) {
      // Use custom line items
      lineItemsData = customLineItems.map((item: any) => {
        const itemMarkup = item.markupPercent || markup
        const costPrice = parseFloat(item.costPrice || 0)
        // Round to 2 decimal places for currency precision
        const sellingPrice = Math.round(costPrice * (1 + itemMarkup / 100) * 100) / 100
        const quantity = item.quantity || 1
        const markupAmount = Math.round((sellingPrice - costPrice) * quantity * 100) / 100
        const clientTotal = Math.round(sellingPrice * quantity * 100) / 100
        const supplierTotal = Math.round(costPrice * quantity * 100) / 100

        return {
          roomFFEItemId: item.roomFFEItemId,
          groupId: item.groupId || null,
          displayName: item.itemName,
          displayDescription: item.itemDescription || null,
          categoryName: item.categoryName || item.groupId || null,
          roomName: item.roomName || null,
          imageUrl: item.imageUrl || null,
          isComponent: item.isComponent || false,
          quantity: quantity,
          unitType: item.unitType || 'units',
          supplierUnitPrice: costPrice,
          supplierTotalPrice: supplierTotal,
          markupType: 'PERCENTAGE',
          markupValue: itemMarkup,
          markupAmount: markupAmount,
          clientUnitPrice: sellingPrice,
          clientTotalPrice: clientTotal
        }
      })
    }

    // Calculate totals - round to 2 decimal places
    const subtotal = Math.round(lineItemsData.reduce((sum, item) => sum + parseFloat(item.clientTotalPrice.toString()), 0) * 100) / 100

    // Get organization tax rates
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        defaultGstRate: true,
        defaultQstRate: true
      }
    })

    // Calculate GST and QST - round to 2 decimal places
    const gstRate = organization?.defaultGstRate ? parseFloat(organization.defaultGstRate.toString()) : 5
    const qstRate = organization?.defaultQstRate ? parseFloat(organization.defaultQstRate.toString()) : 9.975
    const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100
    const qstAmount = Math.round(subtotal * (qstRate / 100) * 100) / 100
    const totalAmount = Math.round((subtotal + gstAmount + qstAmount) * 100) / 100

    // Create client quote
    const clientQuote = await prisma.clientQuote.create({
      data: {
        orgId,
        projectId,
        quoteNumber,
        title,
        description: description || null,
        groupingType: groupingType || null,
        groupTitle: groupTitle || null,
        defaultMarkupPercent: markup,
        subtotal,
        gstRate,
        gstAmount,
        qstRate,
        qstAmount,
        totalAmount,
        validUntil: validUntil ? new Date(validUntil) : null,
        paymentTerms: paymentTerms || null,
        depositRequired: depositRequired || null,
        // Bill To information
        clientName: clientName || null,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        clientAddress: clientAddress || null,
        // Payment options
        allowCreditCard: allowCreditCard !== false, // Default to true
        createdById: userId,
        updatedById: userId,
        lineItems: {
          create: lineItemsData.map((item, index) => ({
            ...item,
            order: index
          }))
        }
      },
      include: {
        project: {
          select: { id: true, name: true }
        },
        lineItems: true
      }
    })

    // Create activity log
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: clientQuote.id,
        type: 'CREATED',
        message: `Quote ${quoteNumber} created`,
        userId
      }
    })

    return NextResponse.json({ quote: clientQuote })
  } catch (error) {
    console.error('Error creating client quote:', error)
    return NextResponse.json(
      { error: 'Failed to create client quote' },
      { status: 500 }
    )
  }
}

/**
 * Generate a unique quote number with retry logic to handle race conditions
 * Uses random offset on retry to avoid collision with concurrent requests
 */
async function generateUniqueQuoteNumber(orgId: string, year: number, maxRetries = 5): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Count total quotes for this year to get accurate next number
    const count = await prisma.clientQuote.count({
      where: {
        orgId,
        quoteNumber: { startsWith: `CQ-${year}-` }
      }
    })

    let nextNumber = count + 1

    // Add random offset on retry to avoid collision with concurrent requests
    if (attempt > 0) {
      nextNumber += Math.floor(Math.random() * 100) + attempt
    }

    const quoteNumber = `CQ-${year}-${String(nextNumber).padStart(4, '0')}`

    // Check if this number already exists (race condition check)
    const existing = await prisma.clientQuote.findFirst({
      where: { orgId, quoteNumber }
    })

    if (!existing) {
      return quoteNumber
    }

    console.warn(`Quote number collision detected: ${quoteNumber}, retrying...`)
  }

  // Fallback: use timestamp + random to guarantee uniqueness
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0')
  return `CQ-${year}-${timestamp}${random}`
}
