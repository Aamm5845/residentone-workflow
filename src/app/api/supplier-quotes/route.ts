import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'

/**
 * GET /api/supplier-quotes
 * Get all supplier quotes for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    // First get all RFQ IDs for this org
    const orgRFQs = await prisma.rFQ.findMany({
      where: { orgId },
      select: { id: true }
    })
    const rfqIds = orgRFQs.map(r => r.id)

    if (rfqIds.length === 0) {
      return NextResponse.json({ quotes: [], stats: { total: 0, pending: 0, submitted: 0, accepted: 0, rejected: 0 } })
    }

    // Get supplier RFQs for these RFQs with all related data
    const supplierRFQsWithQuotes = await prisma.supplierRFQ.findMany({
      where: { rfqId: { in: rfqIds } },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            logo: true
          }
        },
        rfq: {
          select: {
            id: true,
            rfqNumber: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        quotes: {
          where: status ? { status: status as any } : {},
          orderBy: { submittedAt: 'desc' },
          take: limit,
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
            }
          }
        }
      }
    })

    // Flatten and transform the data
    const transformedQuotes: any[] = []

    for (const sRFQ of supplierRFQsWithQuotes) {
      for (const quote of sRFQ.quotes) {
        transformedQuotes.push({
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          version: quote.version,
          status: quote.status,
          totalAmount: quote.totalAmount ? Number(quote.totalAmount) : null,
          subtotal: quote.subtotal ? Number(quote.subtotal) : null,
          submittedAt: quote.submittedAt,
          validUntil: quote.validUntil,
          estimatedLeadTime: quote.estimatedLeadTime,
          quoteDocumentUrl: quote.quoteDocumentUrl,
          supplier: sRFQ.supplier || {
            id: null,
            name: sRFQ.vendorName || sRFQ.vendorEmail || 'Unknown Supplier',
            email: sRFQ.vendorEmail,
            logo: null
          },
          project: sRFQ.rfq.project || { id: '', name: 'Unknown Project' },
          rfq: {
            id: sRFQ.rfq.id,
            rfqNumber: sRFQ.rfq.rfqNumber
          },
          supplierRFQId: quote.supplierRFQId,
          lineItemsCount: quote.lineItems.length,
          lineItems: quote.lineItems.map(li => ({
            id: li.id,
            itemName: li.rfqLineItem?.itemName || 'Unknown Item',
            quantity: li.quantity,
            unitPrice: Number(li.unitPrice),
            totalPrice: Number(li.totalPrice),
            leadTime: li.leadTime
          }))
        })
      }
    }

    // Sort by submittedAt desc and limit
    transformedQuotes.sort((a, b) => {
      if (!a.submittedAt) return 1
      if (!b.submittedAt) return -1
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    })

    const limitedQuotes = transformedQuotes.slice(0, limit)

    // Calculate summary stats
    const stats = {
      total: limitedQuotes.length,
      pending: limitedQuotes.filter(q => q.status === 'PENDING').length,
      submitted: limitedQuotes.filter(q => q.status === 'SUBMITTED').length,
      accepted: limitedQuotes.filter(q => q.status === 'ACCEPTED').length,
      rejected: limitedQuotes.filter(q => q.status === 'REJECTED').length
    }

    return NextResponse.json({
      quotes: limitedQuotes,
      stats
    })

  } catch (error) {
    console.error('Error fetching supplier quotes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier quotes' },
      { status: 500 }
    )
  }
}
