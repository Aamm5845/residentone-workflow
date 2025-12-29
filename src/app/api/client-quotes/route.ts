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
      lineItems: customLineItems // Optional: override with custom line items
    } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
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

    // Generate quote number
    const year = new Date().getFullYear()
    const lastQuote = await prisma.clientQuote.findFirst({
      where: {
        orgId,
        quoteNumber: { startsWith: `CQ-${year}-` }
      },
      orderBy: { quoteNumber: 'desc' }
    })

    let nextNumber = 1
    if (lastQuote) {
      const match = lastQuote.quoteNumber.match(/CQ-\d{4}-(\d+)/)
      if (match) {
        nextNumber = parseInt(match[1]) + 1
      }
    }
    const quoteNumber = `CQ-${year}-${String(nextNumber).padStart(4, '0')}`

    const markup = defaultMarkupPercent || 25

    // Build line items from supplier quotes or custom items
    let lineItemsData: any[] = []

    if (supplierQuoteIds?.length) {
      // Get category markups
      const categoryMarkups = await prisma.categoryMarkup.findMany({
        where: { orgId, isActive: true }
      })
      const markupMap = new Map(categoryMarkups.map(m => [m.categoryName, parseFloat(m.markupPercent.toString())]))

      // Get supplier quote line items
      for (const sqId of supplierQuoteIds) {
        const supplierQuote = await prisma.supplierQuote.findFirst({
          where: { id: sqId },
          include: {
            lineItems: {
              include: {
                rfqLineItem: {
                  include: {
                    roomFFEItem: {
                      select: {
                        id: true,
                        name: true,
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

        for (const item of supplierQuote.lineItems) {
          const category = item.rfqLineItem.roomFFEItem?.section?.name || 'General'
          const itemMarkup = markupMap.get(category) || markup

          const costPrice = parseFloat(item.unitPrice.toString())
          const sellingPrice = costPrice * (1 + itemMarkup / 100)

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
            markupAmount: new Decimal((sellingPrice - costPrice) * item.quantity),
            clientUnitPrice: sellingPrice,
            clientTotalPrice: new Decimal(sellingPrice * item.quantity)
          })
        }
      }
    } else if (customLineItems?.length) {
      // Use custom line items
      lineItemsData = customLineItems.map((item: any) => {
        const itemMarkup = item.markupPercent || markup
        const costPrice = parseFloat(item.costPrice || 0)
        const sellingPrice = costPrice * (1 + itemMarkup / 100)
        const quantity = item.quantity || 1

        return {
          roomFFEItemId: item.roomFFEItemId,
          groupId: item.groupId || null,
          displayName: item.itemName,
          displayDescription: item.itemDescription || null,
          categoryName: item.categoryName || item.groupId || null,
          roomName: item.roomName || null,
          quantity: quantity,
          unitType: item.unitType || 'units',
          supplierUnitPrice: costPrice,
          supplierTotalPrice: costPrice * quantity,
          markupType: 'PERCENTAGE',
          markupValue: itemMarkup,
          markupAmount: (sellingPrice - costPrice) * quantity,
          clientUnitPrice: sellingPrice,
          clientTotalPrice: sellingPrice * quantity
        }
      })
    }

    // Calculate totals
    const subtotal = lineItemsData.reduce((sum, item) => sum + parseFloat(item.clientTotalPrice.toString()), 0)

    // Get organization tax rates
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        defaultGstRate: true,
        defaultQstRate: true
      }
    })

    // Calculate GST and QST
    const gstRate = organization?.defaultGstRate ? parseFloat(organization.defaultGstRate.toString()) : 5
    const qstRate = organization?.defaultQstRate ? parseFloat(organization.defaultQstRate.toString()) : 9.975
    const gstAmount = subtotal * (gstRate / 100)
    const qstAmount = subtotal * (qstRate / 100)
    const totalAmount = subtotal + gstAmount + qstAmount

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
