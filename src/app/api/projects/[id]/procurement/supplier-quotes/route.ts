import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/procurement/supplier-quotes
 * Get all supplier quotes for a specific project
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

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all RFQs for this project
    const rfqs = await prisma.rFQ.findMany({
      where: { projectId },
      select: { id: true }
    })
    const rfqIds = rfqs.map(r => r.id)

    if (rfqIds.length === 0) {
      return NextResponse.json({
        quotes: [],
        stats: { total: 0, pending: 0, submitted: 0, accepted: 0, rejected: 0 }
      })
    }

    // Build status filter
    const statusFilter = status ? { status: status as any } : {
      status: { in: ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'REVISION_REQUESTED', 'REVISED'] }
    }

    // Get supplier RFQs with quotes
    const supplierRFQs = await prisma.supplierRFQ.findMany({
      where: { rfqId: { in: rfqIds } },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            logo: true,
            phone: true
          }
        },
        rfq: {
          select: {
            id: true,
            rfqNumber: true,
            title: true,
            lineItems: {
              select: {
                id: true,
                itemName: true,
                itemDescription: true,
                quantity: true,
                unitType: true,
                specifications: true,
                targetUnitPrice: true
              }
            }
          }
        },
        quotes: {
          where: statusFilter,
          orderBy: [
            { version: 'desc' },
            { submittedAt: 'desc' }
          ],
          include: {
            lineItems: {
              include: {
                rfqLineItem: {
                  select: {
                    id: true,
                    itemName: true,
                    itemDescription: true,
                    quantity: true,
                    unitType: true,
                    specifications: true,
                    targetUnitPrice: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // Transform and enrich data
    const transformedQuotes: any[] = []

    for (const sRFQ of supplierRFQs) {
      for (const quote of sRFQ.quotes) {
        // Analyze mismatches between requested and quoted
        const mismatches: any[] = []
        const lineItemDetails: any[] = []

        for (const li of quote.lineItems) {
          const rfqItem = li.rfqLineItem
          const mismatchReasons: string[] = []

          // Check quantity mismatch
          if (rfqItem && li.quantity !== rfqItem.quantity) {
            mismatchReasons.push(`Quantity: requested ${rfqItem.quantity}, quoted ${li.quantity}`)
          }

          // Check if alternate product
          if (li.alternateProduct) {
            mismatchReasons.push(`Alternate product suggested${li.alternateNotes ? ': ' + li.alternateNotes : ''}`)
          }

          // Check price vs target
          if (rfqItem?.targetUnitPrice && li.unitPrice) {
            const target = Number(rfqItem.targetUnitPrice)
            const quoted = Number(li.unitPrice)
            if (quoted > target * 1.1) { // More than 10% over target
              const diff = ((quoted - target) / target * 100).toFixed(0)
              mismatchReasons.push(`Price ${diff}% above target ($${target.toFixed(2)} target vs $${quoted.toFixed(2)} quoted)`)
            }
          }

          if (mismatchReasons.length > 0) {
            mismatches.push({
              itemName: rfqItem?.itemName || 'Unknown Item',
              reasons: mismatchReasons
            })
          }

          lineItemDetails.push({
            id: li.id,
            itemName: rfqItem?.itemName || 'Unknown Item',
            itemDescription: rfqItem?.itemDescription,
            requestedQuantity: rfqItem?.quantity || 0,
            quotedQuantity: li.quantity,
            unitPrice: Number(li.unitPrice),
            totalPrice: Number(li.totalPrice),
            currency: li.currency,
            availability: li.availability,
            leadTime: li.leadTime,
            leadTimeWeeks: li.leadTimeWeeks,
            leadTimeNotes: li.leadTimeNotes,
            supplierSKU: li.supplierSKU,
            supplierModelNumber: li.supplierModelNumber,
            alternateProduct: li.alternateProduct,
            alternateNotes: li.alternateNotes,
            notes: li.notes,
            hasMismatch: mismatchReasons.length > 0,
            mismatchReasons
          })
        }

        // Calculate overall lead time (max of all items)
        let maxLeadTimeWeeks = 0
        let leadTimeDisplay = quote.estimatedLeadTime || ''
        for (const li of quote.lineItems) {
          if (li.leadTimeWeeks && li.leadTimeWeeks > maxLeadTimeWeeks) {
            maxLeadTimeWeeks = li.leadTimeWeeks
          }
        }
        if (maxLeadTimeWeeks > 0 && !leadTimeDisplay) {
          leadTimeDisplay = `${maxLeadTimeWeeks} week${maxLeadTimeWeeks > 1 ? 's' : ''}`
        }

        transformedQuotes.push({
          id: quote.id,
          supplierRFQId: quote.supplierRFQId,
          quoteNumber: quote.quoteNumber,
          version: quote.version,
          status: quote.status,

          // Pricing
          totalAmount: quote.totalAmount ? Number(quote.totalAmount) : null,
          subtotal: quote.subtotal ? Number(quote.subtotal) : null,
          taxAmount: quote.taxAmount ? Number(quote.taxAmount) : null,
          shippingCost: quote.shippingCost ? Number(quote.shippingCost) : null,
          currency: quote.currency,

          // Timing
          validUntil: quote.validUntil,
          estimatedLeadTime: leadTimeDisplay,
          submittedAt: quote.submittedAt,
          reviewedAt: quote.reviewedAt,

          // Notes
          supplierNotes: quote.supplierNotes,
          internalNotes: quote.internalNotes,

          // Document
          quoteDocumentUrl: quote.quoteDocumentUrl,

          // Terms
          paymentTerms: quote.paymentTerms,
          shippingTerms: quote.shippingTerms,

          // Supplier info
          supplier: sRFQ.supplier || {
            id: null,
            name: sRFQ.vendorName || sRFQ.vendorEmail || 'Unknown Supplier',
            email: sRFQ.vendorEmail,
            phone: sRFQ.vendorPhone,
            logo: null
          },

          // RFQ info
          rfq: {
            id: sRFQ.rfq.id,
            rfqNumber: sRFQ.rfq.rfqNumber,
            title: sRFQ.rfq.title
          },

          // Line items with mismatch info
          lineItems: lineItemDetails,
          lineItemsCount: lineItemDetails.length,

          // Mismatch summary
          hasMismatches: mismatches.length > 0,
          mismatches
        })
      }
    }

    // Sort by submittedAt desc
    transformedQuotes.sort((a, b) => {
      if (!a.submittedAt) return 1
      if (!b.submittedAt) return -1
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    })

    // Calculate stats
    const stats = {
      total: transformedQuotes.length,
      pending: transformedQuotes.filter(q => q.status === 'PENDING').length,
      submitted: transformedQuotes.filter(q => q.status === 'SUBMITTED').length,
      accepted: transformedQuotes.filter(q => q.status === 'ACCEPTED').length,
      rejected: transformedQuotes.filter(q => q.status === 'REJECTED').length,
      withMismatches: transformedQuotes.filter(q => q.hasMismatches).length
    }

    return NextResponse.json({ quotes: transformedQuotes, stats })

  } catch (error) {
    console.error('Error fetching project supplier quotes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier quotes' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/projects/[id]/procurement/supplier-quotes
 * Update supplier quote status (approve/decline)
 */
export async function PATCH(
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
    const userId = (session.user as any).id
    const body = await request.json()
    const { quoteId, action, internalNotes } = body

    if (!quoteId || !action) {
      return NextResponse.json(
        { error: 'quoteId and action are required' },
        { status: 400 }
      )
    }

    if (!['approve', 'decline', 'request_revision'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve, decline, or request_revision' },
        { status: 400 }
      )
    }

    // Verify quote exists and belongs to project in this org
    const quote = await prisma.supplierQuote.findFirst({
      where: { id: quoteId },
      include: {
        lineItems: {
          include: {
            rfqLineItem: {
              select: { id: true, roomFFEItemId: true }
            }
          }
        },
        supplierRFQ: {
          select: {
            id: true,
            supplierId: true,
            vendorName: true,  // For one-time vendors
            supplier: { select: { id: true, name: true } },
            rfq: {
              select: { projectId: true, orgId: true }
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

    // Map action to status
    const statusMap: Record<string, string> = {
      approve: 'ACCEPTED',
      decline: 'REJECTED',
      request_revision: 'REVISION_REQUESTED'
    }

    const newStatus = statusMap[action]
    const now = new Date()

    // Update quote
    const updatedQuote = await prisma.supplierQuote.update({
      where: { id: quoteId },
      data: {
        status: newStatus as any,
        reviewedAt: now,
        reviewedById: userId,
        ...(action === 'approve' && {
          acceptedAt: now,
          acceptedById: userId
        }),
        ...(internalNotes && { internalNotes })
      }
    })

    // Update related SupplierRFQ response status
    if (action === 'approve' || action === 'decline') {
      await prisma.supplierRFQ.update({
        where: { id: quote.supplierRFQId },
        data: {
          responseStatus: action === 'approve' ? 'SUBMITTED' : 'DECLINED'
        }
      })
    }

    // When quote is APPROVED, auto-fill trade prices on the RoomFFEItems
    if (action === 'approve') {
      const supplierName = quote.supplierRFQ.supplier?.name || quote.supplierRFQ.vendorName || 'Supplier'

      for (const lineItem of quote.lineItems) {
        const roomFFEItemId = lineItem.rfqLineItem?.roomFFEItemId
        if (roomFFEItemId && lineItem.unitPrice) {
          // Update the RoomFFEItem with trade price and lead time
          await prisma.roomFFEItem.update({
            where: { id: roomFFEItemId },
            data: {
              tradePrice: lineItem.unitPrice,
              tradePriceCurrency: lineItem.currency || 'CAD',
              ...(lineItem.leadTime ? { leadTime: lineItem.leadTime } : {}),
              // Update supplier info if not already set
              ...(quote.supplierRFQ.supplierId ? { supplierId: quote.supplierRFQ.supplierId } : {}),
              supplierName: supplierName
            }
          })

          // Create activity for the price approval
          await prisma.itemActivity.create({
            data: {
              itemId: roomFFEItemId,
              type: 'QUOTE_APPROVED',
              title: 'Quote Approved',
              description: `Quote from ${supplierName} approved at $${Number(lineItem.unitPrice).toLocaleString()} per unit`,
              actorName: (session.user as any).name || 'Team Member',
              actorType: 'user',
              metadata: {
                quoteId: quote.id,
                approvedPrice: lineItem.unitPrice,
                supplierId: quote.supplierRFQ.supplierId,
                approvedById: userId
              }
            }
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      quote: {
        id: updatedQuote.id,
        status: updatedQuote.status
      }
    })

  } catch (error) {
    console.error('Error updating supplier quote:', error)
    return NextResponse.json(
      { error: 'Failed to update supplier quote' },
      { status: 500 }
    )
  }
}
