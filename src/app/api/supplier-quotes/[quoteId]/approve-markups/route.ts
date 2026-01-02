import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/supplier-quotes/[quoteId]/approve-markups
 * Save approved markup percentages for quote line items
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { quoteId } = await params
    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { lineItems } = body

    if (!lineItems || !Array.isArray(lineItems)) {
      return NextResponse.json(
        { error: 'lineItems array is required' },
        { status: 400 }
      )
    }

    // Verify quote exists and belongs to org
    const quote = await prisma.supplierQuote.findFirst({
      where: { id: quoteId },
      include: {
        supplierRFQ: {
          include: {
            rfq: {
              select: { orgId: true }
            }
          }
        }
      }
    })

    if (!quote || quote.supplierRFQ.rfq.orgId !== orgId) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Update each line item with approved markup
    const updates = await Promise.all(
      lineItems.map(async (item: { lineItemId: string; approvedMarkupPercent: number }) => {
        return prisma.supplierQuoteLineItem.update({
          where: { id: item.lineItemId },
          data: {
            approvedMarkupPercent: item.approvedMarkupPercent
          }
        })
      })
    )

    return NextResponse.json({
      success: true,
      updated: updates.length
    })

  } catch (error) {
    console.error('Error saving approved markups:', error)
    return NextResponse.json(
      { error: 'Failed to save markups' },
      { status: 500 }
    )
  }
}
