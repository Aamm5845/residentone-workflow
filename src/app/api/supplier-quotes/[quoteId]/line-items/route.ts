import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/supplier-quotes/[quoteId]/line-items
 * Get all line items for a supplier quote with related RFQ and FFE data
 */
export async function GET(
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

    // Get line items with related data
    const lineItems = await prisma.supplierQuoteLineItem.findMany({
      where: { supplierQuoteId: quoteId },
      include: {
        rfqLineItem: {
          include: {
            roomFFEItem: {
              select: {
                id: true,
                name: true,
                rrp: true, // Include RRP to check if markup should be skipped
                markupPercent: true, // Include saved markup
                section: {
                  select: {
                    name: true,
                    presetId: true,
                    preset: {
                      select: {
                        name: true,
                        markupPercent: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({ lineItems })

  } catch (error) {
    console.error('Error fetching quote line items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch line items' },
      { status: 500 }
    )
  }
}
