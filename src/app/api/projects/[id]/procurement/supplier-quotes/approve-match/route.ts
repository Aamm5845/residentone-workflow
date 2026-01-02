import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/projects/[id]/procurement/supplier-quotes/approve-match
 * Approve the AI match between a quote line item and an RFQ item
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

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId
    const userId = session.user.id
    const body = await request.json()
    const { lineItemId, quoteId } = body

    if (!lineItemId) {
      return NextResponse.json(
        { error: 'lineItemId is required' },
        { status: 400 }
      )
    }

    // Verify the line item exists and belongs to a quote in this project
    const lineItem = await prisma.supplierQuoteLineItem.findFirst({
      where: { id: lineItemId },
      include: {
        supplierQuote: {
          include: {
            supplierRFQ: {
              include: {
                rfq: {
                  select: { projectId: true, orgId: true }
                }
              }
            }
          }
        },
        rfqLineItem: {
          select: {
            id: true,
            itemName: true
          }
        }
      }
    })

    if (!lineItem) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    // Verify it belongs to the right project and org
    if (lineItem.supplierQuote.supplierRFQ.rfq.orgId !== orgId ||
        lineItem.supplierQuote.supplierRFQ.rfq.projectId !== projectId) {
      return NextResponse.json({ error: 'Line item not found' }, { status: 404 })
    }

    // Update the line item to mark the match as approved
    const updatedLineItem = await prisma.supplierQuoteLineItem.update({
      where: { id: lineItemId },
      data: {
        matchApproved: true,
        matchApprovedAt: new Date(),
        matchApprovedById: userId
      }
    })

    return NextResponse.json({
      success: true,
      lineItem: {
        id: updatedLineItem.id,
        matchApproved: updatedLineItem.matchApproved,
        matchApprovedAt: updatedLineItem.matchApprovedAt
      }
    })

  } catch (error) {
    console.error('Error approving match:', error)
    return NextResponse.json(
      { error: 'Failed to approve match' },
      { status: 500 }
    )
  }
}
