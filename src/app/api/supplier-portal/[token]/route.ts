import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/supplier-portal/[token]
 * Get RFQ details for supplier (public - uses access token)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const supplierRFQ = await prisma.supplierRFQ.findUnique({
      where: { accessToken: token },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        rfq: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                
              }
            },
            lineItems: {
              include: {
                roomFFEItem: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    brand: true,
                    sku: true,
                    notes: true,
                    thumbnailUrl: true,
                    images: true,
                    section: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              },
              orderBy: { order: 'asc' }
            }
          }
        },
        quotes: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    })

    if (!supplierRFQ) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }

    // Check if token expired
    if (supplierRFQ.tokenExpiresAt && new Date() > supplierRFQ.tokenExpiresAt) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    }

    // Update access tracking
    const headersList = await headers()
    const isFirstView = !supplierRFQ.viewedAt
    const viewedAt = new Date()

    await prisma.$transaction([
      prisma.supplierRFQ.update({
        where: { id: supplierRFQ.id },
        data: {
          viewedAt: supplierRFQ.viewedAt || viewedAt,
          lastAccessedAt: viewedAt,
          accessCount: { increment: 1 }
        }
      }),
      prisma.supplierAccessLog.create({
        data: {
          supplierRFQId: supplierRFQ.id,
          ipAddress: headersList.get('x-forwarded-for') || 'unknown',
          userAgent: headersList.get('user-agent') || 'unknown',
          action: 'VIEW'
        }
      })
    ])

    // On first view, update ItemQuoteRequest status and create activity for each item
    if (isFirstView) {
      const supplierName = supplierRFQ.supplier?.name || supplierRFQ.vendorName || supplierRFQ.vendorEmail || 'Supplier'

      // Find all ItemQuoteRequests linked to this SupplierRFQ
      const itemQuoteRequests = await prisma.itemQuoteRequest.findMany({
        where: { supplierRfqId: supplierRFQ.id }
      })

      // Update each ItemQuoteRequest to VIEWED and create activity
      for (const qr of itemQuoteRequests) {
        await prisma.itemQuoteRequest.update({
          where: { id: qr.id },
          data: { status: 'VIEWED' }
        })

        // Create activity for the view
        await prisma.itemActivity.create({
          data: {
            itemId: qr.itemId,
            type: 'QUOTE_VIEWED',
            title: 'Quote Request Viewed',
            description: `${supplierName} opened the quote request`,
            actorName: supplierName,
            actorType: 'supplier',
            metadata: {
              supplierRfqId: supplierRFQ.id,
              supplierId: supplierRFQ.supplierId,
              viewedAt: viewedAt.toISOString()
            }
          }
        })
      }
    }

    // Return RFQ data (without sensitive info)
    return NextResponse.json({
      rfq: {
        id: supplierRFQ.rfq.id,
        rfqNumber: supplierRFQ.rfq.rfqNumber,
        title: supplierRFQ.rfq.title,
        description: supplierRFQ.rfq.description,
        responseDeadline: supplierRFQ.rfq.responseDeadline,
        validUntil: supplierRFQ.rfq.validUntil,
        project: {
          name: supplierRFQ.rfq.project.name
        },
        lineItems: supplierRFQ.rfq.lineItems.map(item => ({
          id: item.id,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unitType: item.unitType,
          specifications: item.specifications,
          notes: item.notes,
          category: item.roomFFEItem?.section?.name || 'General'
        }))
      },
      supplier: {
        name: supplierRFQ.supplier?.name || supplierRFQ.vendorName,
        email: supplierRFQ.supplier?.email || supplierRFQ.vendorEmail
      },
      existingQuote: supplierRFQ.quotes[0] || null,
      responseStatus: supplierRFQ.responseStatus
    })
  } catch (error) {
    console.error('Error fetching supplier portal data:', error)
    return NextResponse.json(
      { error: 'Failed to load quote request' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/supplier-portal/[token]
 * Submit a quote (public - uses access token)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()

    const {
      action,
      quoteNumber,
      validUntil,
      paymentTerms,
      shippingTerms,
      estimatedLeadTime,
      supplierNotes,
      lineItems,
      declineReason,
      quoteDocumentUrl,
      totalAmount
    } = body

    const supplierRFQ = await prisma.supplierRFQ.findUnique({
      where: { accessToken: token },
      include: {
        rfq: {
          include: {
            lineItems: true
          }
        }
      }
    })

    if (!supplierRFQ) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
    }

    if (supplierRFQ.tokenExpiresAt && new Date() > supplierRFQ.tokenExpiresAt) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
    }

    const headersList = await headers()

    if (action === 'decline') {
      // Supplier declined to quote
      await prisma.$transaction([
        prisma.supplierRFQ.update({
          where: { id: supplierRFQ.id },
          data: {
            responseStatus: 'DECLINED',
            respondedAt: new Date(),
            declineReason: declineReason || null
          }
        }),
        prisma.supplierAccessLog.create({
          data: {
            supplierRFQId: supplierRFQ.id,
            ipAddress: headersList.get('x-forwarded-for') || 'unknown',
            userAgent: headersList.get('user-agent') || 'unknown',
            action: 'DECLINE',
            metadata: { reason: declineReason }
          }
        }),
        prisma.rFQActivity.create({
          data: {
            rfqId: supplierRFQ.rfqId,
            type: 'SUPPLIER_DECLINED',
            message: `Supplier declined to quote${declineReason ? `: ${declineReason}` : ''}`,
            metadata: { supplierRFQId: supplierRFQ.id }
          }
        })
      ])

      return NextResponse.json({ success: true, action: 'declined' })
    }

    if (action === 'submit') {
      // Validate line items
      if (!lineItems?.length) {
        return NextResponse.json({ error: 'Line items are required' }, { status: 400 })
      }

      // Get existing quote to determine version
      const existingQuote = await prisma.supplierQuote.findFirst({
        where: { supplierRFQId: supplierRFQ.id },
        orderBy: { version: 'desc' }
      })

      const version = (existingQuote?.version || 0) + 1

      // Calculate totals
      let subtotal = 0
      const processedLineItems = lineItems.map((item: any) => {
        const totalPrice = parseFloat(item.unitPrice) * parseInt(item.quantity)
        subtotal += totalPrice

        return {
          rfqLineItemId: item.rfqLineItemId,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice,
          currency: 'CAD',
          availability: item.availability || null,
          leadTimeWeeks: item.leadTimeWeeks || null,
          leadTimeNotes: item.leadTimeNotes || null,
          supplierSKU: item.supplierSKU || null,
          supplierModelNumber: item.supplierModelNumber || null,
          alternateProduct: item.alternateProduct || false,
          alternateNotes: item.alternateNotes || null,
          notes: item.notes || null
        }
      })

      // Use provided totalAmount for uploaded quotes, otherwise calculate from line items
      const finalTotal = totalAmount || subtotal

      // Create quote
      const quote = await prisma.supplierQuote.create({
        data: {
          supplierRFQId: supplierRFQ.id,
          quoteNumber: quoteNumber || `SQ-${Date.now()}`,
          version,
          status: 'SUBMITTED',
          subtotal: totalAmount ? null : subtotal,
          totalAmount: finalTotal,
          validUntil: validUntil ? new Date(validUntil) : null,
          paymentTerms: paymentTerms || null,
          shippingTerms: shippingTerms || null,
          estimatedLeadTime: estimatedLeadTime || null,
          supplierNotes: supplierNotes || null,
          quoteDocumentUrl: quoteDocumentUrl || null,
          submittedAt: new Date(),
          lineItems: {
            create: processedLineItems
          }
        },
        include: {
          lineItems: true
        }
      })

      // Update supplier RFQ status
      await prisma.$transaction([
        prisma.supplierRFQ.update({
          where: { id: supplierRFQ.id },
          data: {
            responseStatus: 'SUBMITTED',
            respondedAt: new Date()
          }
        }),
        prisma.supplierAccessLog.create({
          data: {
            supplierRFQId: supplierRFQ.id,
            ipAddress: headersList.get('x-forwarded-for') || 'unknown',
            userAgent: headersList.get('user-agent') || 'unknown',
            action: 'SUBMIT_QUOTE',
            metadata: { quoteId: quote.id, version }
          }
        }),
        prisma.rFQActivity.create({
          data: {
            rfqId: supplierRFQ.rfqId,
            type: 'QUOTE_RECEIVED',
            message: `Quote received from supplier (v${version})`,
            metadata: { quoteId: quote.id, amount: subtotal }
          }
        })
      ])

      // Check if all suppliers have responded
      const allSupplierRFQs = await prisma.supplierRFQ.findMany({
        where: { rfqId: supplierRFQ.rfqId }
      })

      const allResponded = allSupplierRFQs.every(s => s.responseStatus !== 'PENDING')
      if (allResponded) {
        await prisma.rFQ.update({
          where: { id: supplierRFQ.rfqId },
          data: { status: 'FULLY_QUOTED' }
        })
      } else {
        // At least one has responded
        await prisma.rFQ.update({
          where: { id: supplierRFQ.rfqId },
          data: { status: 'PARTIALLY_QUOTED' }
        })
      }

      return NextResponse.json({
        success: true,
        action: 'submitted',
        quote: {
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          version: quote.version,
          totalAmount: quote.totalAmount
        }
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing supplier quote:', error)
    return NextResponse.json(
      { error: 'Failed to process quote' },
      { status: 500 }
    )
  }
}
