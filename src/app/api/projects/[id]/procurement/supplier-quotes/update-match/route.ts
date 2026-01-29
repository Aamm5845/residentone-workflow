import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/projects/[id]/procurement/supplier-quotes/update-match
 * Update a match between an extracted quote item and an RFQ line item
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
    const body = await request.json()
    const { quoteId, matchIndex, rfqItemId, action, unitPrice, quantity } = body

    if (!quoteId || matchIndex === undefined) {
      return NextResponse.json(
        { error: 'quoteId and matchIndex are required' },
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
        }
      }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.supplierRFQ.rfq.orgId !== orgId || quote.supplierRFQ.rfq.projectId !== projectId) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Get the AI match log
    const aiMatchLog = quote.supplierRFQ.accessLogs?.[0]
    if (!aiMatchLog) {
      return NextResponse.json({ error: 'No AI match data found' }, { status: 404 })
    }

    const metadata = aiMatchLog.metadata as any
    const matchResults = metadata?.matchResults || []

    if (matchIndex >= matchResults.length) {
      return NextResponse.json({ error: 'Invalid match index' }, { status: 400 })
    }

    // Update the match result
    if (action === 'approve') {
      matchResults[matchIndex].approved = true
      matchResults[matchIndex].approvedAt = new Date().toISOString()
      matchResults[matchIndex].approvedBy = (session.user as any).id

      // If rfqItemId provided, update the match
      const targetRfqItemId = rfqItemId || matchResults[matchIndex].rfqItem?.id
      if (rfqItemId) {
        matchResults[matchIndex].rfqItem = {
          ...matchResults[matchIndex].rfqItem,
          id: rfqItemId
        }
      }

      // Save edited price/quantity
      if (unitPrice !== undefined || quantity !== undefined) {
        matchResults[matchIndex].extractedItem = {
          ...matchResults[matchIndex].extractedItem,
          ...(unitPrice !== undefined && { unitPrice }),
          ...(quantity !== undefined && { quantity }),
          // Recalculate total
          totalPrice: (unitPrice ?? matchResults[matchIndex].extractedItem?.unitPrice ?? 0) *
                      (quantity ?? matchResults[matchIndex].extractedItem?.quantity ?? 1)
        }

        // If quantity changed and we have a linked RFQ line item, update the spec item quantity
        if (quantity !== undefined && targetRfqItemId) {
          try {
            // Get the RFQ line item to find the linked spec item
            const rfqLineItem = await prisma.rFQLineItem.findUnique({
              where: { id: targetRfqItemId },
              select: { roomFFEItemId: true, quantity: true }
            })

            if (rfqLineItem?.roomFFEItemId && rfqLineItem.quantity !== quantity) {
              // Update the spec item (RoomFFEItem) quantity
              await prisma.roomFFEItem.update({
                where: { id: rfqLineItem.roomFFEItemId },
                data: { quantity }
              })

              // Also update the RFQ line item quantity to keep them in sync
              await prisma.rFQLineItem.update({
                where: { id: targetRfqItemId },
                data: { quantity }
              })

              console.log(`[UpdateMatch] Updated spec item quantity to ${quantity} for RFQ line item ${targetRfqItemId}`)
            }
          } catch (updateErr) {
            console.error('[UpdateMatch] Error updating spec item quantity:', updateErr)
            // Don't fail the whole request if quantity update fails
          }
        }
      }
    } else if (action === 'change' && rfqItemId) {
      // Find the RFQ line item to get its details
      const rfqLineItem = await prisma.rFQLineItem.findUnique({
        where: { id: rfqItemId },
        include: {
          roomFFEItem: {
            select: {
              sku: true,
              brand: true
            }
          }
        }
      })

      if (rfqLineItem) {
        matchResults[matchIndex].rfqItem = {
          id: rfqItemId,
          itemName: rfqLineItem.itemName,
          quantity: rfqLineItem.quantity,
          sku: rfqLineItem.roomFFEItem?.sku || '',
          brand: rfqLineItem.roomFFEItem?.brand || ''
        }
        matchResults[matchIndex].status = 'matched'
        matchResults[matchIndex].confidence = 100
        matchResults[matchIndex].manuallyMatched = true
      }
    } else if (action === 'reject') {
      matchResults[matchIndex].rejected = true
      matchResults[matchIndex].rfqItem = undefined
    } else if (action === 'resolve_extra') {
      // Mark an extra item as resolved (added as component or to specs)
      const { resolveType, parentItemName } = body
      matchResults[matchIndex].resolved = {
        type: resolveType, // 'component' or 'specs'
        parentItemName: parentItemName || null,
        resolvedAt: new Date().toISOString(),
        resolvedBy: (session.user as any).id
      }
    }

    // Update the access log with new match results
    await prisma.supplierAccessLog.update({
      where: { id: aiMatchLog.id },
      data: {
        metadata: {
          ...metadata,
          matchResults
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'Match approved' : 'Match updated'
    })

  } catch (error) {
    console.error('Error updating match:', error)
    return NextResponse.json(
      { error: 'Failed to update match' },
      { status: 500 }
    )
  }
}
