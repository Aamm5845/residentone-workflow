import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { getBaseUrl } from '@/lib/get-base-url'
import { generateSupplierQuoteEmailTemplate } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

interface SupplierQuoteRequest {
  projectId: string
  items: Array<{
    id: string
    supplierId?: string
    supplierName?: string
    overrideSupplier?: boolean  // Force resend even if already sent
  }>
  message?: string
  responseDeadline?: string  // ISO date string
  includeSpecSheet?: boolean  // Include spec sheet & documents in portal
  includeNotes?: boolean  // Include item notes in portal
  shippingAddress?: {  // Custom shipping address (if different from project)
    street?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
  }
  attachments?: Array<{  // Files uploaded with the RFQ
    name: string
    url: string
    size: number
  }>
}

/**
 * POST /api/rfq/supplier-quote
 *
 * Send quote requests to suppliers for selected items.
 * Features:
 * - Groups items by supplier automatically
 * - Tracks which items have been sent to which suppliers
 * - Prevents duplicate sends unless override is specified
 * - Creates activity records for each item
 * - Sends professional emails with item images and project details
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: SupplierQuoteRequest = await request.json()
    const { projectId, items, message, responseDeadline, includeSpecSheet = true, includeNotes = true, shippingAddress, attachments } = body

    if (!projectId || !items?.length) {
      return NextResponse.json(
        { error: 'Project ID and at least one item required' },
        { status: 400 }
      )
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Get project details
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: {
        id: true,
        name: true,
        address: true,
        client: { select: { name: true } }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all items with details
    const itemIds = items.map(i => i.id)
    const dbItems = await prisma.roomFFEItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        name: true,
        description: true,
        brand: true,
        sku: true,
        quantity: true,
        unitType: true,
        supplierName: true,
        images: true,
        tradePrice: true,
        color: true,
        finish: true,
        material: true,
        leadTime: true,
        width: true,
        height: true,
        depth: true,
        section: {
          select: {
            name: true,
            instance: {
              select: {
                room: {
                  select: {
                    id: true,
                    name: true,
                    projectId: true
                  }
                }
              }
            }
          }
        },
        quoteRequests: {
          where: { status: 'SENT' },
          select: { supplierId: true, vendorEmail: true }
        },
        documents: {
          where: { visibleToSupplier: true },
          select: { id: true }
        }
      }
    })

    // Check if any item has documents visible to supplier
    const hasDocuments = dbItems.some(item => item.documents && item.documents.length > 0)

    // Check if any item has notes
    const hasNotes = dbItems.some(item => item.notes && item.notes.trim().length > 0)

    // Get all suppliers
    const allSuppliers = await prisma.supplier.findMany({
      where: { orgId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        contactName: true,
        logo: true
      }
    })

    // Build supplier-to-items mapping
    const supplierItemsMap = new Map<string, {
      supplier: typeof allSuppliers[0] | null
      vendorEmail?: string
      vendorName?: string
      items: typeof dbItems
      alreadySentItems: string[]
    }>()

    for (const item of dbItems) {
      const requestItem = items.find(i => i.id === item.id)
      if (!requestItem) continue

      let supplierId = requestItem.supplierId
      let supplierName = requestItem.supplierName || item.supplierName

      // Try to match supplier by name if no supplierId provided
      if (!supplierId && supplierName) {
        const normalizedName = supplierName.toLowerCase().trim()
        const matchedSupplier = allSuppliers.find(s =>
          s.name.toLowerCase().trim() === normalizedName ||
          s.name.toLowerCase().includes(normalizedName) ||
          normalizedName.includes(s.name.toLowerCase())
        )
        if (matchedSupplier) {
          supplierId = matchedSupplier.id
        }
      }

      const mapKey = supplierId || `vendor:${supplierName || 'unknown'}`

      if (!supplierItemsMap.has(mapKey)) {
        const supplier = supplierId ? allSuppliers.find(s => s.id === supplierId) || null : null
        supplierItemsMap.set(mapKey, {
          supplier,
          vendorEmail: !supplier ? (requestItem as any).vendorEmail : undefined,
          vendorName: !supplier ? (supplierName || undefined) : undefined,
          items: [],
          alreadySentItems: []
        })
      }

      const entry = supplierItemsMap.get(mapKey)!

      // Check if already sent to this supplier
      const alreadySent = item.quoteRequests.some(qr =>
        (supplierId && qr.supplierId === supplierId) ||
        (!supplierId && qr.vendorEmail === (requestItem as any).vendorEmail)
      )

      if (alreadySent && !requestItem.overrideSupplier) {
        entry.alreadySentItems.push(item.id)
      } else {
        entry.items.push(item)
      }
    }

    // Filter out entries with no items to send
    const entriesToSend = Array.from(supplierItemsMap.entries())
      .filter(([_, entry]) => entry.items.length > 0)

    if (entriesToSend.length === 0) {
      // All items already sent
      const allAlreadySent = Array.from(supplierItemsMap.values())
        .flatMap(e => e.alreadySentItems)

      return NextResponse.json({
        success: false,
        message: 'All selected items have already been sent for quotes to these suppliers',
        alreadySentItemIds: allAlreadySent,
        needsConfirmation: true
      })
    }

    const deadline = responseDeadline ? new Date(responseDeadline) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    // Check if there's an existing open RFQ for this project we can reuse
    // Only create a new RFQ if there are truly new items (not resends)
    const hasNewItems = entriesToSend.some(([_, entry]) =>
      entry.items.some(item => {
        const requestItem = items.find(i => i.id === item.id)
        return !requestItem?.overrideSupplier // New items don't have overrideSupplier
      })
    )

    let rfq: any

    if (hasNewItems) {
      // Create new RFQ for new items
      const rfqNumber = await generateRFQNumber(orgId)
      rfq = await prisma.rFQ.create({
        data: {
          orgId,
          projectId,
          rfqNumber,
          title: `Quote Request - ${project.name}`,
          description: message || null,
          status: 'DRAFT',
          responseDeadline: deadline,
          createdById: userId,
          updatedById: userId,
          lineItems: {
            create: dbItems.map((item, index) => ({
              roomFFEItemId: item.id,
              itemName: item.name,
              itemDescription: item.description || '',
              quantity: item.quantity || 1,
              unitType: item.unitType || 'units',
              order: index,
              specifications: {
                brand: item.brand,
                sku: item.sku,
                color: item.color,
                finish: item.finish,
                material: item.material,
                dimensions: {
                  width: item.width,
                  height: item.height,
                  depth: item.depth
                }
              }
            }))
          }
        }
      })
    } else {
      // For resends only, find or create a minimal RFQ
      // Try to find existing RFQ for this project
      const existingRfq = await prisma.rFQ.findFirst({
        where: {
          projectId,
          orgId,
          status: { in: ['SENT', 'DRAFT', 'PENDING'] }
        },
        orderBy: { createdAt: 'desc' }
      })

      if (existingRfq) {
        rfq = existingRfq
      } else {
        const rfqNumber = await generateRFQNumber(orgId)
        rfq = await prisma.rFQ.create({
          data: {
            orgId,
            projectId,
            rfqNumber,
            title: `Quote Request - ${project.name}`,
            description: message || null,
            status: 'DRAFT',
            responseDeadline: deadline,
            createdById: userId,
            updatedById: userId
          }
        })
      }
    }

    // Create RFQDocument records for uploaded attachments
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        await prisma.rFQDocument.create({
          data: {
            orgId,
            rfqId: rfq.id,
            type: 'SPEC_SHEET',
            title: attachment.name,
            fileName: attachment.name,
            fileUrl: attachment.url,
            fileSize: attachment.size,
            mimeType: attachment.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
            visibleToSupplier: true,
            visibleToClient: false,
            uploadedById: userId
          }
        })
      }
    }

    const baseUrl = getBaseUrl()
    const results: Array<{
      supplierId?: string
      supplierName: string
      email: string
      itemCount: number
      success: boolean
      error?: string
    }> = []

    // Send to each supplier
    for (const [_, entry] of entriesToSend) {
      const { supplier, vendorEmail, vendorName, items: supplierItems } = entry
      const email = supplier?.email || vendorEmail

      if (!email) {
        results.push({
          supplierId: supplier?.id,
          supplierName: supplier?.name || vendorName || 'Unknown',
          email: '',
          itemCount: supplierItems.length,
          success: false,
          error: 'No email address'
        })
        continue
      }

      // Check if there's an existing SupplierRFQ for this supplier we can reuse
      let supplierRFQ = await prisma.supplierRFQ.findFirst({
        where: {
          rfqId: rfq.id,
          OR: [
            { supplierId: supplier?.id || undefined },
            { vendorEmail: !supplier ? email : undefined }
          ].filter(c => Object.values(c)[0] !== undefined)
        }
      })

      if (!supplierRFQ) {
        // Create new SupplierRFQ record only if doesn't exist
        supplierRFQ = await prisma.supplierRFQ.create({
          data: {
            rfqId: rfq.id,
            supplierId: supplier?.id || null,
            vendorName: vendorName || null,
            vendorEmail: !supplier ? email : null,
            tokenExpiresAt: deadline,
            sentAt: new Date(),
            shippingAddress: shippingAddress || null,
            includeSpecSheet: includeSpecSheet,
            includeNotes: includeNotes
          }
        })
      } else {
        // Update existing record with new sent time and shipping address
        supplierRFQ = await prisma.supplierRFQ.update({
          where: { id: supplierRFQ.id },
          data: {
            sentAt: new Date(),
            tokenExpiresAt: deadline,
            shippingAddress: shippingAddress || supplierRFQ.shippingAddress,
            includeSpecSheet: includeSpecSheet,
            includeNotes: includeNotes
          }
        })
      }

      const portalUrl = `${baseUrl}/supplier-portal/${supplierRFQ.accessToken}`

      try {
        // Send professional email using shared template
        await sendEmail({
          to: email,
          subject: `Quote Request ${rfq.rfqNumber}: ${project.name}`,
          html: generateSupplierQuoteEmailTemplate({
            rfqNumber: rfq.rfqNumber,
            projectName: project.name,
            projectAddress: project.address,
            clientName: project.client.name,
            supplierName: supplier?.contactName || supplier?.name || vendorName || 'Valued Supplier',
            items: supplierItems,
            portalUrl,
            message,
            deadline,
            includeSpecSheet: includeSpecSheet && hasDocuments,
            includeNotes: includeNotes && hasNotes,
            isPreview: false
          })
        })

        // Create or update ItemQuoteRequest records for each item
        // Note: We don't create ItemActivity here - ItemQuoteRequest is shown in activity timeline
        for (const item of supplierItems) {
          // Check if there's an existing ItemQuoteRequest for this item+supplier
          const existingRequest = await prisma.itemQuoteRequest.findFirst({
            where: {
              itemId: item.id,
              OR: [
                { supplierId: supplier?.id || undefined },
                { vendorEmail: !supplier ? email : undefined }
              ].filter(c => Object.values(c)[0] !== undefined)
            }
          })

          if (existingRequest) {
            // Update existing request (resend)
            await prisma.itemQuoteRequest.update({
              where: { id: existingRequest.id },
              data: {
                status: 'SENT',
                sentAt: new Date(),
                sentById: userId,
                supplierRfqId: supplierRFQ.id
              }
            })
          } else {
            // Create new request
            await prisma.itemQuoteRequest.create({
              data: {
                itemId: item.id,
                supplierId: supplier?.id || null,
                rfqId: rfq.id,
                supplierRfqId: supplierRFQ.id,
                vendorEmail: !supplier ? email : null,
                vendorName: !supplier ? vendorName : null,
                status: 'SENT',
                sentById: userId
              }
            })
          }

          // Update item status to RFQ_SENT
          await prisma.roomFFEItem.update({
            where: { id: item.id },
            data: { specStatus: 'RFQ_SENT' }
          })
        }

        // Log access
        await prisma.supplierAccessLog.create({
          data: {
            supplierRFQId: supplierRFQ.id,
            action: 'EMAIL_SENT',
            metadata: { sentBy: userId, itemCount: supplierItems.length }
          }
        })

        results.push({
          supplierId: supplier?.id,
          supplierName: supplier?.name || vendorName || email,
          email,
          itemCount: supplierItems.length,
          success: true
        })
      } catch (emailError: any) {
        results.push({
          supplierId: supplier?.id,
          supplierName: supplier?.name || vendorName || email,
          email,
          itemCount: supplierItems.length,
          success: false,
          error: emailError.message
        })
      }
    }

    // Update RFQ status
    const successCount = results.filter(r => r.success).length
    if (successCount > 0) {
      await prisma.rFQ.update({
        where: { id: rfq.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          sentById: userId
        }
      })

      await prisma.rFQActivity.create({
        data: {
          rfqId: rfq.id,
          type: 'SENT',
          message: `Quote request sent to ${successCount} supplier(s)`,
          userId,
          metadata: { results }
        }
      })
    }

    // Calculate skipped items
    const skippedItems = Array.from(supplierItemsMap.values())
      .flatMap(e => e.alreadySentItems)

    return NextResponse.json({
      success: successCount > 0,
      rfqId: rfq.id,
      rfqNumber: rfq.rfqNumber,
      sent: successCount,
      failed: results.length - successCount,
      skippedAlreadySent: skippedItems.length,
      results,
      skippedItemIds: skippedItems
    })

  } catch (error) {
    console.error('Error sending supplier quotes:', error)
    return NextResponse.json(
      { error: 'Failed to send quote requests' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/rfq/supplier-quote/preview
 *
 * Preview what will be sent - groups items by supplier and checks for already sent
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const itemIdsParam = searchParams.get('itemIds')

    if (!projectId || !itemIdsParam) {
      return NextResponse.json(
        { error: 'Project ID and item IDs required' },
        { status: 400 }
      )
    }

    const itemIds = itemIdsParam.split(',')
    const orgId = (session.user as any).orgId

    // Get project
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get items with their supplier info and quote request history
    const items = await prisma.roomFFEItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        name: true,
        description: true,
        brand: true,
        sku: true,
        quantity: true,
        unitType: true,
        supplierName: true,
        images: true,
        tradePrice: true,
        specStatus: true,
        notes: true,
        documents: {
          where: { visibleToSupplier: true },
          select: {
            id: true,
            title: true,
            fileName: true,
            fileUrl: true,
            type: true,
            mimeType: true
          }
        },
        section: {
          select: {
            name: true,
            instance: {
              select: {
                room: { select: { name: true } }
              }
            }
          }
        },
        quoteRequests: {
          select: {
            id: true,
            supplierId: true,
            vendorEmail: true,
            vendorName: true,
            status: true,
            sentAt: true,
            supplier: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    })

    // Get all suppliers
    const suppliers = await prisma.supplier.findMany({
      where: { orgId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        contactName: true,
        logo: true
      }
    })

    // Group items by matched supplier
    const supplierGroups = new Map<string, {
      supplier: typeof suppliers[0] | null
      supplierName: string
      items: Array<{
        item: typeof items[0]
        alreadySent: boolean
        previousRequest?: typeof items[0]['quoteRequests'][0]
      }>
    }>()

    for (const item of items) {
      let matchedSupplier: typeof suppliers[0] | null = null

      if (item.supplierName) {
        const normalizedName = item.supplierName.toLowerCase().trim()
        matchedSupplier = suppliers.find(s =>
          s.name.toLowerCase().trim() === normalizedName ||
          s.name.toLowerCase().includes(normalizedName) ||
          normalizedName.includes(s.name.toLowerCase())
        ) || null
      }

      const key = matchedSupplier?.id || `unmatched:${item.supplierName || 'no-supplier'}`

      if (!supplierGroups.has(key)) {
        supplierGroups.set(key, {
          supplier: matchedSupplier,
          supplierName: matchedSupplier?.name || item.supplierName || 'No Supplier',
          items: []
        })
      }

      // Check if already sent
      const previousRequest = item.quoteRequests.find(qr =>
        matchedSupplier ? qr.supplierId === matchedSupplier.id : qr.vendorEmail === item.supplierName
      )

      supplierGroups.get(key)!.items.push({
        item,
        alreadySent: !!previousRequest && previousRequest.status === 'SENT',
        previousRequest
      })
    }

    return NextResponse.json({
      project,
      supplierGroups: Array.from(supplierGroups.entries()).map(([key, group]) => ({
        key,
        ...group
      })),
      availableSuppliers: suppliers,
      summary: {
        totalItems: items.length,
        readyToSend: Array.from(supplierGroups.values())
          .flatMap(g => g.items)
          .filter(i => !i.alreadySent).length,
        alreadySent: Array.from(supplierGroups.values())
          .flatMap(g => g.items)
          .filter(i => i.alreadySent).length,
        noSupplier: Array.from(supplierGroups.entries())
          .filter(([key]) => key.startsWith('unmatched:'))
          .flatMap(([_, g]) => g.items).length
      }
    })

  } catch (error) {
    console.error('Error getting quote preview:', error)
    return NextResponse.json(
      { error: 'Failed to get preview' },
      { status: 500 }
    )
  }
}

async function generateRFQNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `RFQ-${year}-`

  const lastRFQ = await prisma.rFQ.findFirst({
    where: {
      orgId,
      rfqNumber: { startsWith: prefix }
    },
    orderBy: { rfqNumber: 'desc' }
  })

  let nextNumber = 1
  if (lastRFQ?.rfqNumber) {
    const lastNumber = parseInt(lastRFQ.rfqNumber.replace(prefix, ''), 10)
    if (!isNaN(lastNumber)) {
      nextNumber = lastNumber + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`
}
