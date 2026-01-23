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
                targetUnitPrice: true,
                roomFFEItem: {
                  select: {
                    id: true,
                    images: true,
                    brand: true,
                    sku: true,
                    modelNumber: true
                  }
                }
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
                    targetUnitPrice: true,
                    roomFFEItemId: true,
                    roomFFEItem: {
                      select: {
                        id: true,
                        images: true,
                        brand: true,
                        sku: true,
                        modelNumber: true
                      }
                    }
                  }
                }
              }
            }
          }
        },
        // Include access logs for AI match data
        accessLogs: {
          where: { action: 'AI_MATCH' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            metadata: true,
            createdAt: true
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

          // Get image from roomFFEItem
          const roomFFEItem = rfqItem?.roomFFEItem
          const imageUrl = roomFFEItem?.images?.[0] || null

          // Determine match confidence based on name similarity and other factors
          let matchConfidence: 'high' | 'medium' | 'low' | 'none' = 'none'
          if (rfqItem) {
            // Simple heuristic: if item names match closely, high confidence
            const quotedName = (li.itemName || '').toLowerCase().trim()
            const rfqName = (rfqItem.itemName || '').toLowerCase().trim()
            const quotedSku = (li.supplierSKU || li.supplierModelNumber || '').toLowerCase().trim()
            const rfqSku = (roomFFEItem?.sku || roomFFEItem?.modelNumber || '').toLowerCase().trim()

            if (quotedName === rfqName || (quotedSku && rfqSku && quotedSku === rfqSku)) {
              matchConfidence = 'high'
            } else if (rfqName && quotedName && (rfqName.includes(quotedName) || quotedName.includes(rfqName))) {
              matchConfidence = 'medium'
            } else if (rfqItem.id) {
              matchConfidence = 'low' // Has a match but names don't align well
            }
          }

          lineItemDetails.push({
            id: li.id,
            rfqLineItemId: rfqItem?.id,
            roomFFEItemId: rfqItem?.roomFFEItemId,
            itemName: li.itemName || rfqItem?.itemName || 'Unknown Item',
            itemDescription: rfqItem?.itemDescription,
            brand: roomFFEItem?.brand,
            sku: roomFFEItem?.sku || roomFFEItem?.modelNumber,
            imageUrl,
            requestedQuantity: rfqItem?.quantity || 0,
            quotedQuantity: li.quantity,
            originalQuantity: (li as any).originalQuantity || null,  // If supplier changed qty
            supplierChangedQty: !!(li as any).originalQuantity,  // Flag for easy detection
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
            mismatchReasons,
            // Match verification fields
            matchedRfqItemName: rfqItem?.itemName,
            matchedRfqItemImage: roomFFEItem?.images?.[0] || null,
            matchedRfqItemBrand: roomFFEItem?.brand,
            matchedRfqItemSku: roomFFEItem?.sku || roomFFEItem?.modelNumber,
            matchApproved: (li as any).matchApproved || false,
            matchConfidence
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

        // Get AI match data from access logs
        const aiMatchLog = sRFQ.accessLogs?.[0]
        const aiMatchData = aiMatchLog?.metadata as {
          matched?: number
          partial?: number
          missing?: number
          extra?: number
          totalRequested?: number
          quantityDiscrepancies?: number
          totalDiscrepancy?: boolean
          quoteTotal?: number
          calculatedTotal?: number
          hasShippingFee?: boolean
          shippingFee?: number
          discrepancyMessages?: string[]
          itemDiscrepancies?: Array<{
            itemName: string
            type: string
            requested?: number
            quoted?: number
            details: string
          }>
          // Full extracted data for PDF review
          supplierInfo?: {
            companyName?: string
            quoteNumber?: string
            quoteDate?: string
            validUntil?: string
            subtotal?: number
            shipping?: number
            taxes?: number
            total?: number
            shippingItems?: Array<{
              productName: string
              unitPrice?: number
              totalPrice?: number
            }>
          }
          extractedItems?: Array<{
            productName: string
            productNameOriginal?: string
            sku?: string
            quantity?: number
            unitPrice?: number
            totalPrice?: number
            brand?: string
            description?: string
            leadTime?: string
          }>
          matchResults?: Array<{
            status: 'matched' | 'partial' | 'missing' | 'extra'
            confidence: number
            rfqItem?: {
              id: string
              itemName: string
              quantity: number
              sku?: string
              brand?: string
            }
            extractedItem?: {
              productName: string
              sku?: string
              quantity?: number
              unitPrice?: number
              totalPrice?: number
              brand?: string
              description?: string
              leadTime?: string
            }
            discrepancies?: string[]
            suggestedMatches?: Array<{
              id: string
              itemName: string
              confidence: number
            }>
          }>
          notes?: string
        } | null

        // Build enhanced mismatch list with full item details
        const enhancedMismatches: any[] = []

        // Skip mismatch detection for manual quotes (no AI analysis needed)
        const isManualQuote = sRFQ.rfq.title?.startsWith('[Manual Quotes]') || false

        // Get all RFQ line items for this quote's RFQ to detect missing items
        const rfqLineItems = sRFQ.rfq.lineItems
        const quotedRfqLineItemIds = new Set(quote.lineItems.map(li => li.rfqLineItemId).filter(Boolean))

        // Find missing items (RFQ items not in quote) - skip for manual quotes
        for (const rfqItem of rfqLineItems) {
          if (isManualQuote) break // Skip mismatch detection for manual quotes
          if (!quotedRfqLineItemIds.has(rfqItem.id)) {
            const roomFFEItem = rfqItem.roomFFEItem
            enhancedMismatches.push({
              itemName: rfqItem.itemName,
              reasons: ['This item was requested but NOT included in the supplier\'s quote'],
              type: 'missing',
              severity: 'error',
              // Full item details
              quantity: rfqItem.quantity,
              unitPrice: rfqItem.targetUnitPrice ? Number(rfqItem.targetUnitPrice) : undefined,
              brand: roomFFEItem?.brand,
              sku: roomFFEItem?.sku || roomFFEItem?.modelNumber,
              description: rfqItem.itemDescription,
              imageUrl: roomFFEItem?.images?.[0] || null
            })
          }
        }

        // Find extra items (quote items without RFQ reference or marked as alternate) - skip for manual quotes
        for (const quoteItem of quote.lineItems) {
          if (isManualQuote) break // Skip mismatch detection for manual quotes
          if (!quoteItem.rfqLineItemId) {
            enhancedMismatches.push({
              itemName: quoteItem.itemName || 'Unknown Item',
              reasons: ['This item was added by the supplier but was NOT in the original request'],
              type: 'extra',
              severity: 'warning',
              // Full item details from quote
              quantity: quoteItem.quantity,
              unitPrice: Number(quoteItem.unitPrice),
              totalPrice: Number(quoteItem.totalPrice),
              brand: quoteItem.supplierModelNumber ? undefined : undefined,
              sku: quoteItem.supplierSKU || quoteItem.supplierModelNumber
            })
          }
        }

        // Add quantity mismatches for items that exist in both - skip for manual quotes
        for (const li of quote.lineItems) {
          if (isManualQuote) break // Skip mismatch detection for manual quotes
          const rfqItem = li.rfqLineItem
          if (rfqItem && li.quantity !== rfqItem.quantity) {
            const roomFFEItem = rfqItem.roomFFEItem
            enhancedMismatches.push({
              itemName: rfqItem.itemName,
              reasons: [
                `Requested quantity: ${rfqItem.quantity}`,
                `Quoted quantity: ${li.quantity}`,
                `Difference: ${li.quantity - rfqItem.quantity > 0 ? '+' : ''}${li.quantity - rfqItem.quantity}`
              ],
              type: 'quantity',
              severity: 'warning',
              quantity: li.quantity,
              unitPrice: Number(li.unitPrice),
              totalPrice: Number(li.totalPrice),
              brand: roomFFEItem?.brand,
              sku: roomFFEItem?.sku,
              imageUrl: roomFFEItem?.images?.[0] || null
            })
          }
        }

        // Add price discrepancies (more than 15% above target) - skip for manual quotes
        for (const li of quote.lineItems) {
          if (isManualQuote) break // Skip mismatch detection for manual quotes
          const rfqItem = li.rfqLineItem
          if (rfqItem?.targetUnitPrice && li.unitPrice) {
            const target = Number(rfqItem.targetUnitPrice)
            const quoted = Number(li.unitPrice)
            if (quoted > target * 1.15) { // More than 15% over target
              const diff = ((quoted - target) / target * 100).toFixed(0)
              const roomFFEItem = rfqItem.roomFFEItem
              enhancedMismatches.push({
                itemName: rfqItem.itemName,
                reasons: [
                  `Target price: $${target.toFixed(2)}`,
                  `Quoted price: $${quoted.toFixed(2)}`,
                  `${diff}% above target budget`
                ],
                type: 'price',
                severity: 'warning',
                quantity: li.quantity,
                unitPrice: quoted,
                totalPrice: Number(li.totalPrice),
                brand: roomFFEItem?.brand,
                sku: roomFFEItem?.sku,
                imageUrl: roomFFEItem?.images?.[0] || null
              })
            }
          }
        }

        // NOTE: We no longer show "total discrepancy" as a mismatch because the difference
        // between quote total and sum of line items is typically due to taxes (GST/QST)
        // which are expected and normal. Real mismatches are: extra items, missing items,
        // quantity differences, and price issues.

        // Use enhanced mismatches, fall back to basic mismatches if no enhanced found
        const allMismatches = enhancedMismatches.length > 0 ? enhancedMismatches : mismatches
        const hasAnyMismatches = allMismatches.length > 0

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

          // Deposit
          depositRequired: quote.depositRequired ? Number(quote.depositRequired) : null,
          depositPercent: quote.depositPercent ? Number(quote.depositPercent) : null,

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

          // Mismatch summary (combined local + AI)
          hasMismatches: hasAnyMismatches,
          mismatches: allMismatches,

          // AI match summary data - recalculate based on resolved items (skip for manual quotes)
          aiMatchSummary: (aiMatchData && !isManualQuote) ? (() => {
            // Count resolved extra items
            const matchResults = aiMatchData.matchResults || []
            let resolvedExtras = 0
            let unresolvedExtras = 0
            let matchedCount = 0
            let partialCount = 0
            let missingCount = 0

            for (const result of matchResults) {
              if (result.status === 'extra') {
                if ((result as any).resolved) {
                  resolvedExtras++
                } else {
                  unresolvedExtras++
                }
              } else if (result.status === 'matched') {
                matchedCount++
              } else if (result.status === 'partial') {
                partialCount++
              } else if (result.status === 'missing') {
                missingCount++
              }
            }

            // Use recalculated counts if matchResults exists, otherwise fallback to static counts
            const hasMatchResults = matchResults.length > 0

            return {
              matched: hasMatchResults ? (matchedCount + resolvedExtras) : (aiMatchData.matched || 0),
              partial: hasMatchResults ? partialCount : (aiMatchData.partial || 0),
              missing: hasMatchResults ? missingCount : (aiMatchData.missing || 0),
              extra: hasMatchResults ? unresolvedExtras : (aiMatchData.extra || 0),
              totalRequested: aiMatchData.totalRequested || 0,
              quantityDiscrepancies: aiMatchData.quantityDiscrepancies || 0,
              totalDiscrepancy: aiMatchData.totalDiscrepancy || false,
              // Include resolved count for UI
              resolvedExtras: resolvedExtras
            }
          })() : null,

          // Full AI extracted data for PDF review (skip for manual quotes)
          aiExtractedData: (aiMatchData && !isManualQuote) ? {
            supplierInfo: aiMatchData.supplierInfo || null,
            extractedItems: aiMatchData.extractedItems || [],
            matchResults: aiMatchData.matchResults || [],
            notes: aiMatchData.notes || null
          } : null
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
            supplier: {
              select: {
                id: true,
                name: true,
                markupPercent: true  // Supplier's markup percentage for RRP calculation
              }
            },
            rfq: {
              select: { projectId: true, orgId: true }
            },
            // Include AI match data for PDF quotes
            accessLogs: {
              where: { action: 'AI_MATCH' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { metadata: true }
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

    // When quote is DECLINED, reset item status back to SELECTED
    if (action === 'decline') {
      for (const lineItem of quote.lineItems) {
        const roomFFEItemId = lineItem.rfqLineItem?.roomFFEItemId
        if (roomFFEItemId) {
          await prisma.roomFFEItem.update({
            where: { id: roomFFEItemId },
            data: {
              specStatus: 'SELECTED'  // Reset to SELECTED so they can request quotes again
            }
          })

          // Create activity for the decline
          await prisma.itemActivity.create({
            data: {
              itemId: roomFFEItemId,
              type: 'QUOTE_DECLINED',
              title: 'Quote Declined',
              description: `Quote from ${quote.supplierRFQ.supplier?.name || quote.supplierRFQ.vendorName || 'Supplier'} was declined`,
              actorName: (session.user as any).name || 'Team Member',
              actorType: 'user',
              metadata: {
                quoteId: quote.id,
                declinedById: userId
              }
            }
          })
        }
      }
    }

    // When quote is APPROVED, auto-fill trade prices and RRP on the RoomFFEItems
    if (action === 'approve') {
      const supplierName = quote.supplierRFQ.supplier?.name || quote.supplierRFQ.vendorName || 'Supplier'

      // Get supplier's markup percentage (default to 25% if not set)
      const supplierMarkup = quote.supplierRFQ.supplier?.markupPercent
        ? Number(quote.supplierRFQ.supplier.markupPercent)
        : 25  // Default 25% markup if not configured

      console.log(`[Approve Quote] Processing quote ${quote.id}`)

      // Check for AI match data (for PDF quotes analyzed by AI)
      const aiMatchLog = quote.supplierRFQ.accessLogs?.[0]
      const aiMatchData = aiMatchLog?.metadata as any
      const matchResults = aiMatchData?.matchResults || []

      // Get items to update from AI match results or fall back to line items
      const itemsToUpdate: Array<{
        rfqLineItemId: string
        unitPrice: number
        quantity: number
        leadTime?: string
        currency?: string
      }> = []

      if (matchResults.length > 0) {
        // Use AI match results - these have the approved matches with correct prices
        console.log(`[Approve Quote] Using AI match results (${matchResults.length} items)`)

        for (const match of matchResults) {
          // Only process matched/partial items that have an rfqItem
          if ((match.status === 'matched' || match.status === 'partial') && match.rfqItem?.id) {
            const extractedItem = match.extractedItem || {}
            // Use edited price if available, otherwise use extracted price
            const unitPrice = extractedItem.unitPrice

            if (unitPrice && unitPrice > 0) {
              itemsToUpdate.push({
                rfqLineItemId: match.rfqItem.id,
                unitPrice: unitPrice,
                quantity: extractedItem.quantity || match.rfqItem.quantity || 1,
                leadTime: extractedItem.leadTime,
                currency: 'CAD'
              })
            }
          }
        }
      } else {
        // Fall back to quote line items (for manually entered quotes)
        console.log(`[Approve Quote] Using quote line items (${quote.lineItems.length} items)`)

        for (const lineItem of quote.lineItems) {
          if (lineItem.rfqLineItemId && lineItem.unitPrice) {
            itemsToUpdate.push({
              rfqLineItemId: lineItem.rfqLineItemId,
              unitPrice: Number(lineItem.unitPrice),
              quantity: lineItem.quantity,
              leadTime: lineItem.leadTime || undefined,
              currency: lineItem.currency || 'CAD'
            })
          }
        }
      }

      console.log(`[Approve Quote] ${itemsToUpdate.length} items to update with trade prices`)

      // Fetch all RFQ line items to get the roomFFEItemId mapping
      const rfqLineItemIds = itemsToUpdate.map(item => item.rfqLineItemId).filter(Boolean)
      const rfqLineItems = await prisma.rFQLineItem.findMany({
        where: { id: { in: rfqLineItemIds } },
        select: { id: true, roomFFEItemId: true }
      })
      const rfqLineItemMap = new Map(rfqLineItems.map(li => [li.id, li.roomFFEItemId]))

      console.log(`[Approve Quote] Found ${rfqLineItems.length} RFQ line items with roomFFEItemIds`)

      // Update each item
      for (const item of itemsToUpdate) {
        const roomFFEItemId = rfqLineItemMap.get(item.rfqLineItemId)

        if (roomFFEItemId) {
          const tradePrice = item.unitPrice

          // Calculate RRP with markup: tradePrice * (1 + markupPercent/100)
          const rrp = tradePrice * (1 + supplierMarkup / 100)

          console.log(`[Approve Quote] Updating item ${roomFFEItemId}: tradePrice=$${tradePrice}, rrp=$${rrp}`)

          // Update the RoomFFEItem with trade price, RRP, lead time, and status
          await prisma.roomFFEItem.update({
            where: { id: roomFFEItemId },
            data: {
              specStatus: 'QUOTE_APPROVED',  // Update status from QUOTE_RECEIVED to QUOTE_APPROVED
              tradePrice: tradePrice,
              tradePriceCurrency: item.currency || 'CAD',
              rrp: rrp,  // RRP with markup applied
              rrpCurrency: item.currency || 'CAD',
              ...(item.leadTime ? { leadTime: item.leadTime } : {}),
              // Update supplier info
              ...(quote.supplierRFQ.supplierId ? { supplierId: quote.supplierRFQ.supplierId } : {}),
              supplierName: supplierName
            }
          })

          // Create activity for the price approval
          await prisma.itemActivity.create({
            data: {
              itemId: roomFFEItemId,
              type: 'PRICE_UPDATED',
              title: 'Quote Approved',
              description: `Quote from ${supplierName} approved: Trade $${tradePrice.toLocaleString()}, RRP $${rrp.toLocaleString()} (+${supplierMarkup}% markup)`,
              actorName: (session.user as any).name || 'Team Member',
              actorType: 'user',
              metadata: {
                quoteId: quote.id,
                tradePrice: tradePrice,
                rrp: rrp,
                markupPercent: supplierMarkup,
                supplierId: quote.supplierRFQ.supplierId,
                approvedById: userId
              }
            }
          })
        } else {
          console.log(`[Approve Quote] No roomFFEItemId found for rfqLineItemId ${item.rfqLineItemId}`)
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

/**
 * PUT /api/projects/[id]/procurement/supplier-quotes
 * Update supplier quote line items (fix prices, availability, etc.)
 */
export async function PUT(
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
    const { quoteId, lineItems } = body

    if (!quoteId || !lineItems || !Array.isArray(lineItems)) {
      return NextResponse.json(
        { error: 'quoteId and lineItems array are required' },
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

    // Update each line item
    let newTotal = 0
    for (const item of lineItems) {
      const { lineItemId, unitPrice, quantity, availability, leadTime, notes } = item

      if (!lineItemId) continue

      const totalPrice = unitPrice * quantity
      newTotal += totalPrice

      await prisma.supplierQuoteLineItem.update({
        where: { id: lineItemId },
        data: {
          ...(unitPrice !== undefined && { unitPrice }),
          ...(quantity !== undefined && { quantity }),
          ...(unitPrice !== undefined && quantity !== undefined && { totalPrice }),
          ...(availability !== undefined && { availability }),
          ...(leadTime !== undefined && { leadTime }),
          ...(notes !== undefined && { notes })
        }
      })
    }

    // Update quote total if prices were updated
    if (newTotal > 0) {
      await prisma.supplierQuote.update({
        where: { id: quoteId },
        data: {
          subtotal: newTotal,
          totalAmount: newTotal + Number(quote.shippingCost || 0) + Number(quote.taxAmount || 0)
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Quote line items updated'
    })

  } catch (error) {
    console.error('Error updating quote line items:', error)
    return NextResponse.json(
      { error: 'Failed to update quote line items' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/projects/[id]/procurement/supplier-quotes
 * Delete a declined supplier quote
 */
export async function DELETE(
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
    const { quoteId } = body

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

    // Only allow deleting REJECTED quotes
    if (quote.status !== 'REJECTED') {
      return NextResponse.json(
        { error: 'Only declined quotes can be deleted' },
        { status: 400 }
      )
    }

    // Delete associated line items first
    await prisma.supplierQuoteLineItem.deleteMany({
      where: { supplierQuoteId: quoteId }
    })

    // Delete the quote
    await prisma.supplierQuote.delete({
      where: { id: quoteId }
    })

    return NextResponse.json({
      success: true,
      message: 'Quote deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting supplier quote:', error)
    return NextResponse.json(
      { error: 'Failed to delete supplier quote' },
      { status: 500 }
    )
  }
}
