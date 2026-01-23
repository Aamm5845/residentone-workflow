import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { sendEmail } from '@/lib/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

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
                streetAddress: true,
                city: true,
                province: true,
                postalCode: true,
                client: {
                  select: {
                    name: true,
                    email: true,
                    phone: true,
                    company: true
                  }
                }
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
                    images: true,
                    color: true,
                    finish: true,
                    material: true,
                    width: true,
                    height: true,
                    depth: true,
                    length: true,
                    modelNumber: true,
                    supplierLink: true,
                    supplierName: true,
                    leadTime: true,
                    section: {
                      select: {
                        name: true
                      }
                    },
                    // Include documents visible to supplier
                    documents: {
                      where: { visibleToSupplier: true },
                      select: {
                        id: true,
                        title: true,
                        fileName: true,
                        fileUrl: true,
                        mimeType: true,
                        type: true
                      }
                    }
                  }
                }
              },
              orderBy: { order: 'asc' }
            },
            // RFQ-level documents (visible to suppliers)
            documents: {
              where: { visibleToSupplier: true },
              select: {
                id: true,
                title: true,
                description: true,
                fileName: true,
                fileUrl: true,
                fileSize: true,
                mimeType: true,
                type: true,
                createdAt: true
              },
              orderBy: { createdAt: 'desc' }
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
          accessCount: { increment: 1 },
          // Update status to VIEWED on first view (if still PENDING)
          ...(isFirstView && supplierRFQ.responseStatus === 'PENDING' && {
            responseStatus: 'VIEWED'
          })
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

    // Get all items sent to this supplier for this project (across all RFQs)
    const projectId = supplierRFQ.rfq.project.id
    const supplierId = supplierRFQ.supplierId
    const vendorEmail = supplierRFQ.vendorEmail

    // Find all SupplierRFQs for this supplier/vendor in this project
    const allSupplierRFQs = await prisma.supplierRFQ.findMany({
      where: {
        rfq: { projectId },
        OR: [
          ...(supplierId ? [{ supplierId }] : []),
          ...(vendorEmail ? [{ vendorEmail }] : [])
        ]
      },
      include: {
        rfq: {
          include: {
            lineItems: {
              include: {
                roomFFEItem: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    brand: true,
                    sku: true,
                    images: true,
                    color: true,
                    finish: true,
                    material: true,
                    section: { select: { name: true } }
                  }
                }
              }
            }
          }
        },
        quotes: {
          orderBy: { version: 'desc' },
          take: 1,
          include: {
            lineItems: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Build list of all items with their quote status
    const allProjectItems = allSupplierRFQs.flatMap(sRfq =>
      sRfq.rfq.lineItems.map(item => {
        const quote = sRfq.quotes[0]
        const quotedLineItem = quote?.lineItems.find(ql => ql.rfqLineItemId === item.id)
        return {
          id: item.id,
          rfqId: sRfq.rfq.id,
          rfqNumber: sRfq.rfq.rfqNumber,
          supplierRfqId: sRfq.id,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unitType: item.unitType,
          category: item.roomFFEItem?.section?.name || 'General',
          roomFFEItem: item.roomFFEItem ? {
            images: item.roomFFEItem.images,
            brand: item.roomFFEItem.brand,
            sku: item.roomFFEItem.sku,
            color: item.roomFFEItem.color,
            finish: item.roomFFEItem.finish,
            material: item.roomFFEItem.material
          } : null,
          // Quote status
          isCurrentRfq: sRfq.id === supplierRFQ.id,
          hasQuote: !!quote,
          quoteStatus: sRfq.responseStatus,
          quotedPrice: quotedLineItem?.unitPrice || null,
          quotedAt: quote?.submittedAt || null
        }
      })
    )

    // Deduplicate items (same roomFFEItemId might appear in multiple RFQs)
    const seenItems = new Set<string>()
    const uniqueItems = allProjectItems.filter(item => {
      const key = item.id
      if (seenItems.has(key)) return false
      seenItems.add(key)
      return true
    })

    // Get custom shipping address if set
    const customShipping = supplierRFQ.shippingAddress as { street?: string; city?: string; province?: string; postalCode?: string; country?: string } | null

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
          id: projectId,
          name: supplierRFQ.rfq.project.name,
          // Use custom shipping if provided, otherwise use project address
          streetAddress: customShipping?.street || supplierRFQ.rfq.project.streetAddress,
          city: customShipping?.city || supplierRFQ.rfq.project.city,
          province: customShipping?.province || supplierRFQ.rfq.project.province,
          postalCode: customShipping?.postalCode || supplierRFQ.rfq.project.postalCode,
          country: customShipping?.country || 'Canada',
          // Only expose client name to suppliers, not contact info
          client: supplierRFQ.rfq.project.client ? {
            name: supplierRFQ.rfq.project.client.name
          } : null,
          // Flag to indicate if using custom shipping
          hasCustomShipping: !!customShipping
        },
        lineItems: supplierRFQ.rfq.lineItems.map(item => ({
          id: item.id,
          itemName: item.itemName,
          itemDescription: item.itemDescription,
          quantity: item.quantity,
          unitType: item.unitType,
          specifications: item.specifications,
          // Only include notes if includeNotes is true
          notes: supplierRFQ.includeNotes ? item.notes : null,
          category: item.roomFFEItem?.section?.name || 'General',
          // Additional item details for spec sheet
          roomFFEItem: item.roomFFEItem ? {
            images: item.roomFFEItem.images,
            brand: item.roomFFEItem.brand,
            sku: item.roomFFEItem.sku,
            color: item.roomFFEItem.color,
            finish: item.roomFFEItem.finish,
            material: item.roomFFEItem.material,
            width: item.roomFFEItem.width,
            height: item.roomFFEItem.height,
            depth: item.roomFFEItem.depth,
            length: item.roomFFEItem.length,
            modelNumber: item.roomFFEItem.modelNumber,
            supplierLink: item.roomFFEItem.supplierLink,
            supplierName: item.roomFFEItem.supplierName,
            leadTime: item.roomFFEItem.leadTime,
            // Only include notes if includeNotes is true
            notes: supplierRFQ.includeNotes ? item.roomFFEItem.notes : null,
            // Only include documents if includeSpecSheet is true
            documents: supplierRFQ.includeSpecSheet ? (item.roomFFEItem.documents || []) : []
          } : null
        })),
        // RFQ-level documents (uploaded by sender, visible to supplier)
        documents: supplierRFQ.rfq.documents || []
      },
      supplier: {
        name: supplierRFQ.supplier?.name || supplierRFQ.vendorName,
        email: supplierRFQ.supplier?.email || supplierRFQ.vendorEmail
      },
      existingQuote: supplierRFQ.quotes[0] || null,
      responseStatus: supplierRFQ.responseStatus,
      // All items sent to this supplier for this project
      allProjectItems: uniqueItems
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
      totalAmount,
      leadTime,
      itemLeadTimes,  // Per-item lead times: { [rfqLineItemId]: 'in-stock' | '2-4-weeks' | ... }
      depositRequired,  // Deposit amount required
      depositPercent,   // Deposit as percentage
      taxAmount,        // Tax amount (GST + QST)
      deliveryFee       // Shipping/delivery fee
    } = body

    const supplierRFQ = await prisma.supplierRFQ.findUnique({
      where: { accessToken: token },
      include: {
        supplier: {
          select: { id: true, name: true }
        },
        rfq: {
          include: {
            lineItems: true,
            project: {
              select: {
                id: true,
                name: true,
                orgId: true
              }
            }
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

      // Validate that submitted line items match RFQ line items
      const rfqLineItemIds = new Set(supplierRFQ.rfq.lineItems.map(item => item.id))
      const submittedLineItemIds = lineItems.map((item: any) => item.rfqLineItemId)

      // Check for invalid rfqLineItemIds
      const invalidIds = submittedLineItemIds.filter((id: string) => !rfqLineItemIds.has(id))
      if (invalidIds.length > 0) {
        return NextResponse.json({
          error: `Invalid line item IDs submitted: ${invalidIds.join(', ')}. These items do not belong to this RFQ.`
        }, { status: 400 })
      }

      // Validate line item prices and quantities
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i]

        // Validate unit price is non-negative
        if (item.unitPrice === undefined || item.unitPrice === null || parseFloat(item.unitPrice) < 0) {
          return NextResponse.json({
            error: `Line item ${i + 1}: Unit price must be a non-negative number`
          }, { status: 400 })
        }

        // Validate quantity is positive
        if (!item.quantity || parseInt(item.quantity) <= 0) {
          return NextResponse.json({
            error: `Line item ${i + 1}: Quantity must be a positive number`
          }, { status: 400 })
        }
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

        // Get lead time: from item directly, from itemLeadTimes map, or from global leadTime
        const itemLeadTime = item.leadTime || itemLeadTimes?.[item.rfqLineItemId] || leadTime || null

        // Get original quantity (from RFQ) - if different from quantity, supplier changed it
        const originalQty = item.originalQuantity || item.quantity

        return {
          rfqLineItemId: item.rfqLineItemId,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          originalQuantity: originalQty !== item.quantity ? originalQty : null,  // Only store if changed
          totalPrice,
          currency: 'CAD',
          availability: item.availability || null,
          leadTimeWeeks: item.leadTimeWeeks || null,
          leadTimeNotes: item.leadTimeNotes || null,
          leadTime: itemLeadTime,
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
          shippingCost: deliveryFee || null,
          taxAmount: taxAmount || null,
          depositRequired: depositRequired || null,
          depositPercent: depositPercent || null,
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

      // Update RoomFFEItem prices with the quoted prices
      // Get the RFQ line items to find the linked RoomFFEItems
      const rfqLineItems = await prisma.rFQLineItem.findMany({
        where: { rfqId: supplierRFQ.rfqId },
        select: { id: true, roomFFEItemId: true }
      })

      // Create a map of rfqLineItemId to roomFFEItemId
      const lineItemMap = new Map(rfqLineItems.map(li => [li.id, li.roomFFEItemId]))

      // Update each RoomFFEItem with the quoted trade price and lead time
      const supplierName = supplierRFQ.supplier?.name || supplierRFQ.vendorName || 'Supplier'
      for (const quoteLineItem of quote.lineItems) {
        const roomFFEItemId = lineItemMap.get(quoteLineItem.rfqLineItemId)
        if (roomFFEItemId) {
          // Get the lead time from the line item or from the global leadTime
          const itemLeadTime = quoteLineItem.leadTime || leadTime || null

          // Update status to QUOTE_RECEIVED but DON'T fill trade price yet
          // Trade price will be filled when quote is APPROVED in the procurement section
          await prisma.roomFFEItem.update({
            where: { id: roomFFEItemId },
            data: {
              specStatus: 'QUOTE_RECEIVED',
              // Note: tradePrice is NOT set here - only set when quote is approved
            }
          })

          // Create activity for the quote
          const leadTimeDisplay = itemLeadTime ? itemLeadTime.replace(/_/g, ' ').replace('WEEKS', 'Weeks') : null
          const priceText = quoteLineItem.unitPrice ? `$${Number(quoteLineItem.unitPrice).toLocaleString()} per unit` : 'price in document'
          const leadTimeText = leadTimeDisplay ? `, Lead: ${leadTimeDisplay}` : ''

          await prisma.itemActivity.create({
            data: {
              itemId: roomFFEItemId,
              type: 'QUOTE_RECEIVED',
              title: 'Quote Received',
              description: `${supplierName} quoted ${priceText}${leadTimeText}${quoteDocumentUrl ? ' (see attached document)' : ''}`,
              actorName: supplierName,
              actorType: 'supplier',
              metadata: {
                quoteId: quote.id,
                quoteAmount: quoteLineItem.unitPrice,
                supplierId: supplierRFQ.supplierId,
                supplierRfqId: supplierRFQ.id,
                quoteDocumentUrl: quoteDocumentUrl || null,
                leadTime: itemLeadTime || null
              }
            }
          })

          // Update ItemQuoteRequest status and link to the quote
          await prisma.itemQuoteRequest.updateMany({
            where: {
              itemId: roomFFEItemId,
              supplierRfqId: supplierRFQ.id
            },
            data: {
              status: 'QUOTED',
              quoteAmount: quoteLineItem.unitPrice,
              quoteId: quote.id,  // Link to the supplier quote
              respondedAt: new Date()
            }
          })
        }
      }

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

      // Send email notification to team about the new quote
      try {
        await sendSupplierQuoteNotification({
          supplierRFQ,
          quote,
          projectName: supplierRFQ.rfq.project?.name || 'Unknown Project',
          rfqNumber: supplierRFQ.rfq.rfqNumber,
          supplierName,
          lineItemsCount: processedLineItems.length,
          totalAmount: finalTotal,
          hasDocument: !!quoteDocumentUrl
        })
      } catch (emailError) {
        // Don't fail the submission if email fails
        console.error('Failed to send quote notification email:', emailError)
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

/**
 * Send email notification to team when supplier submits a quote
 */
async function sendSupplierQuoteNotification(data: {
  supplierRFQ: any
  quote: any
  projectName: string
  rfqNumber: string
  supplierName: string
  lineItemsCount: number
  totalAmount: number
  hasDocument: boolean
}) {
  const { supplierRFQ, quote, projectName, rfqNumber, supplierName, lineItemsCount, totalAmount, hasDocument } = data

  // Only notify Aaron and Shaya when supplier submits a quote
  const notificationEmails = [
    'aaron@meisnerinteriors.com',
    'shaya@meisnerinteriors.com'
  ]

  // Build the review URL - link to project procurement Supplier Quotes tab
  const baseUrl = getBaseUrl()
  const projectId = supplierRFQ.rfq.projectId
  const reviewUrl = `${baseUrl}/projects/${projectId}/procurement?tab=supplier-quotes&quoteId=${quote.id}`

  // Get AI match summary if available (stored in quote metadata or access log)
  const latestAccessLog = await prisma.supplierAccessLog.findFirst({
    where: {
      supplierRFQId: supplierRFQ.id,
      action: 'AI_MATCH'
    },
    orderBy: { createdAt: 'desc' }
  })

  const aiMatchSummary = latestAccessLog?.metadata as {
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
  } | null

  // Build mismatch section for email
  let mismatchHtml = ''
  let hasMismatch = false

  if (aiMatchSummary) {
    const issues: string[] = []

    if (aiMatchSummary.missing && aiMatchSummary.missing > 0) {
      issues.push(`<li style="color: #dc2626;"><strong>${aiMatchSummary.missing} missing item${aiMatchSummary.missing > 1 ? 's' : ''}</strong> - Items we requested but not found in their quote</li>`)
      hasMismatch = true
    }

    if (aiMatchSummary.extra && aiMatchSummary.extra > 0) {
      issues.push(`<li style="color: #f59e0b;"><strong>${aiMatchSummary.extra} extra item${aiMatchSummary.extra > 1 ? 's' : ''}</strong> - Items in their quote we didn't request</li>`)
      hasMismatch = true
    }

    if (aiMatchSummary.quantityDiscrepancies && aiMatchSummary.quantityDiscrepancies > 0) {
      // Build a detailed list of items with quantity mismatches
      let qtyMismatchDetails = ''
      if (aiMatchSummary.itemDiscrepancies && aiMatchSummary.itemDiscrepancies.length > 0) {
        const qtyItems = aiMatchSummary.itemDiscrepancies.filter(d => d.type === 'quantity')
        if (qtyItems.length > 0) {
          qtyMismatchDetails = `
            <table style="width: 100%; margin-top: 8px; border-collapse: collapse; font-size: 13px;">
              <tr style="background-color: #fef3c7;">
                <th style="text-align: left; padding: 6px 8px; border-bottom: 1px solid #f59e0b;">Item</th>
                <th style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #f59e0b;">Requested</th>
                <th style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #f59e0b;">Quoted</th>
              </tr>
              ${qtyItems.map(item => `
                <tr>
                  <td style="padding: 6px 8px; border-bottom: 1px solid #fde68a;">${item.itemName}</td>
                  <td style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #fde68a; color: #059669; font-weight: 500;">${item.requested}</td>
                  <td style="text-align: center; padding: 6px 8px; border-bottom: 1px solid #fde68a; color: #dc2626; font-weight: 500;">${item.quoted}</td>
                </tr>
              `).join('')}
            </table>
          `
        }
      }
      issues.push(`<li style="color: #f59e0b;"><strong>${aiMatchSummary.quantityDiscrepancies} quantity mismatch${aiMatchSummary.quantityDiscrepancies > 1 ? 'es' : ''}</strong> - Quoted quantities differ from requested${qtyMismatchDetails}</li>`)
      hasMismatch = true
    }

    if (aiMatchSummary.totalDiscrepancy) {
      const diff = Math.abs((aiMatchSummary.quoteTotal || 0) - (aiMatchSummary.calculatedTotal || 0))
      issues.push(`<li style="color: #dc2626;"><strong>Total mismatch ($${diff.toFixed(2)})</strong> - Quote total doesn't match line item sum</li>`)
      hasMismatch = true
    }

    if (aiMatchSummary.partial && aiMatchSummary.partial > 0 && !aiMatchSummary.quantityDiscrepancies) {
      issues.push(`<li style="color: #f59e0b;"><strong>${aiMatchSummary.partial} partial match${aiMatchSummary.partial > 1 ? 'es' : ''}</strong> - Items with potential discrepancies</li>`)
      hasMismatch = true
    }

    // Show specific discrepancy messages if any
    if (aiMatchSummary.discrepancyMessages && aiMatchSummary.discrepancyMessages.length > 0) {
      const uniqueMessages = [...new Set(aiMatchSummary.discrepancyMessages)].slice(0, 5)
      issues.push(`<li style="color: #6b7280; font-size: 13px; margin-top: 8px;"><em>Details: ${uniqueMessages.join(', ')}</em></li>`)
    }

    if (issues.length > 0) {
      mismatchHtml = `
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; color: #92400e; font-size: 16px;">⚠️ AI Analysis Found Discrepancies</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${issues.join('')}
          </ul>
          <p style="margin: 12px 0 0 0; font-size: 13px; color: #78350f;">
            Please review the quote to ensure all items are properly matched.
          </p>
        </div>
      `
    }
  }

  // Format currency
  const formattedTotal = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD'
  }).format(totalAmount)

  // Build the email HTML
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">
            New Quote Received
          </h1>
        </div>

        <!-- Content -->
        <div style="padding: 24px;">
          <p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">
            <strong>${supplierName}</strong> has submitted a quote for:
          </p>

          <!-- Quote Details Card -->
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Project</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">${projectName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">RFQ Number</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">${rfqNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Items Quoted</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 500; text-align: right;">${lineItemsCount} item${lineItemsCount > 1 ? 's' : ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Quote Total</td>
                <td style="padding: 8px 0; color: #10b981; font-size: 18px; font-weight: 600; text-align: right;">${formattedTotal}</td>
              </tr>
              ${hasDocument ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Document</td>
                <td style="padding: 8px 0; color: #3b82f6; font-size: 14px; text-align: right;">📎 Quote document attached</td>
              </tr>
              ` : ''}
            </table>
          </div>

          ${mismatchHtml}

          ${!hasMismatch && aiMatchSummary ? `
          <div style="background-color: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #065f46; font-size: 14px;">
              ✅ <strong>All items matched!</strong> The AI analysis found all requested items in the supplier's quote.
            </p>
          </div>
          ` : ''}

          <!-- CTA Button -->
          <div style="text-align: center; margin: 24px 0;">
            <a href="${reviewUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
              Review & Match Quote
            </a>
          </div>

          <p style="margin: 20px 0 0 0; font-size: 13px; color: #9ca3af; text-align: center;">
            Click the button above to review the quote, match items, and accept or request revisions.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            This is an automated notification from your procurement system.
          </p>
        </div>
      </div>
    </body>
    </html>
  `

  // Send to all team members
  const subject = hasMismatch
    ? `⚠️ Quote Received (Review Needed) - ${supplierName} for ${projectName}`
    : `✅ Quote Received - ${supplierName} for ${projectName}`

  for (const email of notificationEmails) {
    try {
      await sendEmail({
        to: email,
        subject,
        html: emailHtml
      })
      console.log(`Quote notification sent to ${email}`)
    } catch (err) {
      console.error(`Failed to send notification to ${email}:`, err)
    }
  }
}
