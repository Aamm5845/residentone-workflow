import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rfq/[id]/quotes
 * Get all supplier quotes for an RFQ
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

    // Verify RFQ belongs to org
    const rfq = await prisma.rFQ.findFirst({
      where: { id, orgId },
      select: { id: true, rfqNumber: true }
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    // Get all quotes with comparison data
    const supplierRFQs = await prisma.supplierRFQ.findMany({
      where: { rfqId: id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            contactName: true
          }
        },
        quotes: {
          include: {
            lineItems: {
              include: {
                rfqLineItem: {
                  select: {
                    id: true,
                    itemName: true,
                    quantity: true
                  }
                }
              }
            },
            reviewedBy: {
              select: { id: true, name: true }
            },
            acceptedBy: {
              select: { id: true, name: true }
            }
          },
          orderBy: { version: 'desc' }
        },
        accessLogs: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    })

    // Build comparison matrix
    const comparison = buildComparisonMatrix(supplierRFQs)

    return NextResponse.json({
      rfqId: id,
      rfqNumber: rfq.rfqNumber,
      supplierRFQs,
      comparison
    })
  } catch (error) {
    console.error('Error fetching RFQ quotes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quotes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rfq/[id]/quotes
 * Accept or reject a supplier quote
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
    const { quoteId, action, notes } = body

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Verify RFQ belongs to org
    const rfq = await prisma.rFQ.findFirst({
      where: { id, orgId },
      include: {
        supplierRFQs: {
          include: {
            quotes: true
          }
        }
      }
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    // Find the quote
    const quote = await prisma.supplierQuote.findFirst({
      where: { id: quoteId },
      include: {
        supplierRFQ: true
      }
    })

    if (!quote || quote.supplierRFQ.rfqId !== id) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (action === 'accept') {
      // Accept this quote, reject others
      await prisma.$transaction([
        // Accept selected quote
        prisma.supplierQuote.update({
          where: { id: quoteId },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
            acceptedById: userId,
            internalNotes: notes || quote.internalNotes
          }
        }),
        // Reject other quotes for this RFQ
        prisma.supplierQuote.updateMany({
          where: {
            id: { not: quoteId },
            supplierRFQ: {
              rfqId: id
            },
            status: { not: 'ACCEPTED' }
          },
          data: {
            status: 'REJECTED'
          }
        }),
        // Update RFQ status
        prisma.rFQ.update({
          where: { id },
          data: {
            status: 'QUOTE_ACCEPTED',
            updatedById: userId
          }
        })
      ])

      await prisma.rFQActivity.create({
        data: {
          rfqId: id,
          type: 'QUOTE_ACCEPTED',
          message: `Quote accepted from supplier`,
          userId,
          metadata: { quoteId, quoteNumber: quote.quoteNumber }
        }
      })

      return NextResponse.json({ success: true, action: 'accepted' })
    } else if (action === 'reject') {
      await prisma.supplierQuote.update({
        where: { id: quoteId },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedById: userId,
          internalNotes: notes || quote.internalNotes
        }
      })

      await prisma.rFQActivity.create({
        data: {
          rfqId: id,
          type: 'QUOTE_REJECTED',
          message: `Quote rejected`,
          userId,
          metadata: { quoteId, reason: notes }
        }
      })

      return NextResponse.json({ success: true, action: 'rejected' })
    } else if (action === 'request_revision') {
      await prisma.supplierQuote.update({
        where: { id: quoteId },
        data: {
          status: 'REVISION_REQUESTED',
          reviewedAt: new Date(),
          reviewedById: userId,
          internalNotes: notes || quote.internalNotes
        }
      })

      // TODO: Send email to supplier requesting revision

      await prisma.rFQActivity.create({
        data: {
          rfqId: id,
          type: 'REVISION_REQUESTED',
          message: `Revision requested for quote`,
          userId,
          metadata: { quoteId, reason: notes }
        }
      })

      return NextResponse.json({ success: true, action: 'revision_requested' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing quote action:', error)
    return NextResponse.json(
      { error: 'Failed to process quote action' },
      { status: 500 }
    )
  }
}

function buildComparisonMatrix(supplierRFQs: any[]) {
  // Build a matrix comparing prices across suppliers for each line item
  const matrix: Record<string, any> = {}

  for (const sRFQ of supplierRFQs) {
    const latestQuote = sRFQ.quotes[0] // Already sorted by version desc
    if (!latestQuote) continue

    const supplierKey = sRFQ.supplier?.name || sRFQ.vendorName || 'Unknown'

    for (const lineItem of latestQuote.lineItems) {
      const itemId = lineItem.rfqLineItemId
      if (!matrix[itemId]) {
        matrix[itemId] = {
          itemName: lineItem.rfqLineItem.itemName,
          quantity: lineItem.rfqLineItem.quantity,
          suppliers: {}
        }
      }

      matrix[itemId].suppliers[supplierKey] = {
        unitPrice: lineItem.unitPrice,
        totalPrice: lineItem.totalPrice,
        availability: lineItem.availability,
        leadTimeWeeks: lineItem.leadTimeWeeks,
        supplierSKU: lineItem.supplierSKU,
        quoteId: latestQuote.id,
        quoteStatus: latestQuote.status
      }
    }
  }

  // Calculate best prices
  for (const itemId of Object.keys(matrix)) {
    const item = matrix[itemId]
    let lowestPrice = Infinity
    let lowestSupplier = null

    for (const [supplier, data] of Object.entries(item.suppliers) as any) {
      const price = parseFloat(data.unitPrice) || 0
      if (price > 0 && price < lowestPrice) {
        lowestPrice = price
        lowestSupplier = supplier
      }
    }

    item.lowestPrice = lowestPrice === Infinity ? null : lowestPrice
    item.lowestPriceSupplier = lowestSupplier
  }

  return matrix
}
