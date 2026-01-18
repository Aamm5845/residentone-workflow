import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface ReviewedMatch {
  matchIndex: number
  extractedItemName: string
  rfqItemId: string | null  // null means unmatched/rejected
  rfqItemName?: string
  approved: boolean
  unitPrice?: number
  quantity?: number
  leadTime?: string
}

/**
 * POST /api/projects/[id]/procurement/supplier-quotes/save-review
 * Save all reviewed matches for a supplier quote
 * This is the unified endpoint for saving all match verifications at once
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
    const { quoteId, reviewedMatches, notes } = body as {
      quoteId: string
      reviewedMatches: ReviewedMatch[]
      notes?: string
    }

    if (!quoteId) {
      return NextResponse.json(
        { error: 'quoteId is required' },
        { status: 400 }
      )
    }

    // Verify quote exists and belongs to project in this org
    const quote = await prisma.supplierQuote.findFirst({
      where: { id: quoteId },
      include: {
        supplierRFQ: {
          include: {
            rfq: {
              select: { projectId: true, orgId: true }
            },
            accessLogs: {
              where: { action: 'AI_MATCH' },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        },
        lineItems: {
          include: {
            rfqLineItem: true
          }
        }
      }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.supplierRFQ.rfq.orgId !== orgId || quote.supplierRFQ.rfq.projectId !== projectId) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const aiMatchLog = quote.supplierRFQ.accessLogs?.[0]
    const now = new Date()

    // Process each reviewed match
    const updatePromises: Promise<any>[] = []

    for (const reviewedMatch of reviewedMatches) {
      if (!reviewedMatch.approved) continue

      // Find the corresponding line item by matching extracted item to quote line items
      // We need to find which SupplierQuoteLineItem corresponds to this extracted item
      const matchingLineItem = quote.lineItems.find(li => {
        // Match by item name (normalized comparison)
        const liName = li.itemName?.toLowerCase().trim() || ''
        const extractedName = reviewedMatch.extractedItemName?.toLowerCase().trim() || ''
        return liName === extractedName ||
               liName.includes(extractedName) ||
               extractedName.includes(liName)
      })

      if (matchingLineItem && reviewedMatch.rfqItemId) {
        // Get the RFQ line item to get the roomFFEItemId
        const rfqLineItem = await prisma.rFQLineItem.findUnique({
          where: { id: reviewedMatch.rfqItemId },
          select: { roomFFEItemId: true }
        })

        // Update the line item to mark match as approved and link to RFQ item
        updatePromises.push(
          prisma.supplierQuoteLineItem.update({
            where: { id: matchingLineItem.id },
            data: {
              matchApproved: true,
              matchApprovedAt: now,
              matchApprovedById: userId,
              rfqLineItemId: reviewedMatch.rfqItemId,
              roomFFEItemId: rfqLineItem?.roomFFEItemId, // Direct link to spec item
              // Update price/quantity if provided
              ...(reviewedMatch.unitPrice !== undefined && { unitPrice: reviewedMatch.unitPrice }),
              ...(reviewedMatch.quantity !== undefined && { quotedQuantity: reviewedMatch.quantity }),
              ...(reviewedMatch.leadTime && { leadTime: reviewedMatch.leadTime })
            }
          })
        )

        // Update the RoomFFEItem status to QUOTE_RECEIVED if it has a direct link
        if (rfqLineItem?.roomFFEItemId) {
          updatePromises.push(
            prisma.roomFFEItem.update({
              where: { id: rfqLineItem.roomFFEItemId },
              data: {
                specStatus: 'QUOTE_RECEIVED',
                tradePrice: reviewedMatch.unitPrice ?? matchingLineItem.unitPrice,
                updatedById: userId
              }
            })
          )
        }
      }
    }

    // Update AI match metadata if exists
    if (aiMatchLog) {
      const metadata = aiMatchLog.metadata as any
      const matchResults = metadata?.matchResults || []

      // Update match results with approval status
      for (const reviewedMatch of reviewedMatches) {
        if (reviewedMatch.matchIndex < matchResults.length) {
          matchResults[reviewedMatch.matchIndex] = {
            ...matchResults[reviewedMatch.matchIndex],
            approved: reviewedMatch.approved,
            approvedAt: reviewedMatch.approved ? now.toISOString() : undefined,
            approvedBy: reviewedMatch.approved ? userId : undefined,
            rejected: !reviewedMatch.approved && !reviewedMatch.rfqItemId,
            manuallyMatched: reviewedMatch.rfqItemId !== matchResults[reviewedMatch.matchIndex]?.rfqItem?.id
          }

          // Update the rfqItem reference if changed
          if (reviewedMatch.rfqItemId && reviewedMatch.rfqItemId !== matchResults[reviewedMatch.matchIndex]?.rfqItem?.id) {
            matchResults[reviewedMatch.matchIndex].rfqItem = {
              id: reviewedMatch.rfqItemId,
              itemName: reviewedMatch.rfqItemName || '',
              quantity: reviewedMatch.quantity || 0
            }
            matchResults[reviewedMatch.matchIndex].confidence = 100
            matchResults[reviewedMatch.matchIndex].status = 'matched'
          }
        }
      }

      updatePromises.push(
        prisma.supplierAccessLog.update({
          where: { id: aiMatchLog.id },
          data: {
            metadata: {
              ...metadata,
              matchResults,
              reviewedAt: now.toISOString(),
              reviewedBy: userId
            }
          }
        })
      )
    }

    // Update internal notes if provided
    if (notes !== undefined) {
      updatePromises.push(
        prisma.supplierQuote.update({
          where: { id: quoteId },
          data: { internalNotes: notes }
        })
      )
    }

    // Execute all updates
    await Promise.all(updatePromises)

    // Count how many were approved
    const approvedCount = reviewedMatches.filter(m => m.approved).length

    return NextResponse.json({
      success: true,
      message: `${approvedCount} match${approvedCount !== 1 ? 'es' : ''} verified successfully`,
      approvedCount
    })

  } catch (error) {
    console.error('Error saving review:', error)
    return NextResponse.json(
      { error: 'Failed to save review' },
      { status: 500 }
    )
  }
}
