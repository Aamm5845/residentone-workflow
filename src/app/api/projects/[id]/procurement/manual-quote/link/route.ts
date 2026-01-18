import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface LinkItem {
  specItemId: string
  unitPrice: number
  quantity: number
}

/**
 * POST /api/projects/[id]/procurement/manual-quote/link
 * Manually link a quote document to All Spec items without AI analysis
 * Creates proper RFQ → SupplierRFQ → SupplierQuote chain for traceability
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
    const { fileUrl, fileType, supplierId, supplierName, items } = body as {
      fileUrl: string
      fileType: string
      supplierId: string
      supplierName: string
      items: LinkItem[]
    }

    if (!fileUrl || !supplierId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'fileUrl, supplierId, and items are required' },
        { status: 400 }
      )
    }

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, orgId },
      select: { id: true, name: true }
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Get the spec items to verify they exist
    const specItemIds = items.map(i => i.specItemId)
    const specItems = await prisma.roomFFEItem.findMany({
      where: {
        id: { in: specItemIds },
        isSpecItem: true,
        section: {
          instance: {
            room: { projectId }
          }
        }
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        sku: true,
        modelNumber: true,
        brand: true
      }
    })

    if (specItems.length !== items.length) {
      return NextResponse.json(
        { error: 'Some spec items were not found' },
        { status: 400 }
      )
    }

    // Create item map for quick lookup
    const specItemMap = new Map(specItems.map(s => [s.id, s]))
    const itemPriceMap = new Map(items.map(i => [i.specItemId, i]))

    // Calculate totals
    let subtotal = 0
    items.forEach(item => {
      subtotal += item.unitPrice * item.quantity
    })

    // Use a transaction to create all records
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create a "Manual Quotes" RFQ for this project
      let rfq = await tx.rFQ.findFirst({
        where: {
          projectId,
          title: { startsWith: '[Manual Quotes]' }
        }
      })

      if (!rfq) {
        rfq = await tx.rFQ.create({
          data: {
            orgId,
            projectId,
            rfqNumber: `MQ-${Date.now()}`,
            title: `[Manual Quotes] ${project.name}`,
            status: 'SENT',
            createdById: userId,
            updatedById: userId
          }
        })
      }

      // 2. Create RFQ line items for items that don't have one yet
      const existingLineItems = await tx.rFQLineItem.findMany({
        where: {
          rfqId: rfq.id,
          roomFFEItemId: { in: specItemIds }
        },
        select: { id: true, roomFFEItemId: true }
      })

      const existingItemIds = new Set(existingLineItems.map(li => li.roomFFEItemId))
      const newLineItemIds: string[] = []

      // Create line items for items that don't exist
      for (const specItem of specItems) {
        if (!existingItemIds.has(specItem.id)) {
          const lineItem = await tx.rFQLineItem.create({
            data: {
              rfqId: rfq.id,
              roomFFEItemId: specItem.id,
              itemName: specItem.name,
              quantity: specItem.quantity,
              specifications: [specItem.sku, specItem.modelNumber, specItem.brand]
                .filter(Boolean)
                .join(' | ') || null
            }
          })
          newLineItemIds.push(lineItem.id)
        }
      }

      // Re-fetch all line items for this RFQ with the spec items we need
      const allLineItems = await tx.rFQLineItem.findMany({
        where: {
          rfqId: rfq.id,
          roomFFEItemId: { in: specItemIds }
        },
        select: { id: true, roomFFEItemId: true }
      })

      const lineItemMap = new Map(allLineItems.map(li => [li.roomFFEItemId!, li.id]))

      // 3. Find or create SupplierRFQ for this supplier
      let supplierRFQ = await tx.supplierRFQ.findFirst({
        where: {
          rfqId: rfq.id,
          supplierId
        }
      })

      if (!supplierRFQ) {
        supplierRFQ = await tx.supplierRFQ.create({
          data: {
            rfqId: rfq.id,
            supplierId,
            accessToken: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            responseStatus: 'SUBMITTED',
            respondedAt: new Date()
          }
        })
      }

      // 4. Create SupplierQuote
      const existingQuotes = await tx.supplierQuote.count({
        where: { supplierRFQId: supplierRFQ.id }
      })

      const quote = await tx.supplierQuote.create({
        data: {
          supplierRFQId: supplierRFQ.id,
          quoteNumber: `MQ-${Date.now()}`,
          version: existingQuotes + 1,
          status: 'ACCEPTED',
          subtotal,
          totalAmount: subtotal,
          currency: 'CAD',
          quoteDocumentUrl: fileUrl,
          submittedAt: new Date(),
          acceptedAt: new Date(),
          acceptedById: userId,
          lineItems: {
            create: items.map(item => ({
              rfqLineItemId: lineItemMap.get(item.specItemId)!,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              totalPrice: item.unitPrice * item.quantity,
              currency: 'CAD',
              itemName: specItemMap.get(item.specItemId)?.name || 'Unknown',
              matchApproved: true,
              matchApprovedAt: new Date(),
              matchApprovedById: userId
            }))
          }
        },
        include: {
          lineItems: true
        }
      })

      // 5. Update RoomFFEItems with trade prices and supplier info
      for (const item of items) {
        await tx.roomFFEItem.update({
          where: { id: item.specItemId },
          data: {
            tradePrice: item.unitPrice,
            supplierId,
            supplierName: supplier.name,
            specStatus: 'QUOTE_RECEIVED',
            updatedById: userId
          }
        })
      }

      // 6. Create activity log
      await tx.rFQActivity.create({
        data: {
          rfqId: rfq.id,
          type: 'QUOTE_RECEIVED',
          message: `Manual quote linked from ${supplier.name} (${items.length} items)`,
          metadata: {
            quoteId: quote.id,
            supplierId,
            supplierName: supplier.name,
            itemCount: items.length,
            total: subtotal,
            isManualLink: true
          },
          userId
        }
      })

      return { rfq, supplierRFQ, quote }
    })

    return NextResponse.json({
      success: true,
      quoteId: result.quote.id,
      rfqId: result.rfq.id,
      itemsLinked: items.length,
      total: subtotal
    })

  } catch (error: any) {
    console.error('[Manual Quote Link] Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to link quote',
      message: error?.message || 'An unexpected error occurred.'
    }, { status: 500 })
  }
}
