import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

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
    const { projectId, items, message, responseDeadline, includeSpecSheet = true, includeNotes = true, shippingAddress } = body

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
            shippingAddress: shippingAddress || null
          }
        })
      } else {
        // Update existing record with new sent time and shipping address
        supplierRFQ = await prisma.supplierRFQ.update({
          where: { id: supplierRFQ.id },
          data: {
            sentAt: new Date(),
            tokenExpiresAt: deadline,
            shippingAddress: shippingAddress || supplierRFQ.shippingAddress
          }
        })
      }

      const portalUrl = `${baseUrl}/supplier-portal/${supplierRFQ.accessToken}`

      try {
        // Send professional email
        await sendEmail({
          to: email,
          subject: `Quote Request ${rfq.rfqNumber}: ${project.name}`,
          html: generateProfessionalQuoteEmail({
            project,
            items: supplierItems,
            supplierName: supplier?.contactName || supplier?.name || vendorName || 'Valued Supplier',
            portalUrl,
            message,
            deadline,
            includeSpecSheet: includeSpecSheet && hasDocuments, // Only show if checkbox enabled AND documents exist
            includeNotes: includeNotes && hasNotes // Only show if checkbox enabled AND notes exist
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

          // Update item status to QUOTING
          await prisma.roomFFEItem.update({
            where: { id: item.id },
            data: { specStatus: 'QUOTING' }
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
          select: { id: true }
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

function generateProfessionalQuoteEmail({
  project,
  items,
  supplierName,
  portalUrl,
  message,
  deadline,
  includeSpecSheet = true,
  includeNotes = true
}: {
  project: { name: string; address?: string | null; client: { name: string } }
  items: any[]
  supplierName: string
  portalUrl: string
  message?: string
  deadline: Date
  includeSpecSheet?: boolean
  includeNotes?: boolean
}) {
  const itemRows = items.map(item => {
    const imageUrl = item.images?.[0]
    const specs = [
      item.brand && `Brand: ${item.brand}`,
      item.sku && `SKU: ${item.sku}`,
      item.color && `Color: ${item.color}`,
      item.finish && `Finish: ${item.finish}`,
      item.material && `Material: ${item.material}`,
    ].filter(Boolean).join(' | ')

    return `
      <tr>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top; width: 80px;">
          ${imageUrl
            ? `<img src="${imageUrl}" alt="${item.name}" width="70" height="70" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb;" />`
            : `<div style="width: 70px; height: 70px; background: #f3f4f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 24px;">📦</div>`
          }
        </td>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
          <div style="font-weight: 600; color: #111827; font-size: 15px; margin-bottom: 4px;">${item.name}</div>
          ${item.description ? `<div style="color: #6b7280; font-size: 13px; margin-bottom: 6px;">${item.description}</div>` : ''}
          ${specs ? `<div style="color: #9ca3af; font-size: 12px;">${specs}</div>` : ''}
          ${item.section?.instance?.room?.name ? `<div style="color: #9ca3af; font-size: 11px; margin-top: 4px;">📍 ${item.section.instance.room.name} - ${item.section.name}</div>` : ''}
        </td>
        <td style="padding: 16px; border-bottom: 1px solid #e5e7eb; vertical-align: top; text-align: center; width: 100px;">
          <div style="font-weight: 600; color: #111827; font-size: 16px;">${item.quantity || 1}</div>
          <div style="color: #6b7280; font-size: 12px;">${item.unitType || 'units'}</div>
        </td>
      </tr>
    `
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote Request from Meisner Interiors</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">

  <!-- Header with Meisner Branding -->
  <div style="background: linear-gradient(135deg, #1f2937 0%, #374151 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
    <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Meisner Interiors</p>
    <h1 style="color: white; margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">Quote Request</h1>
    <p style="color: #d1d5db; margin: 0; font-size: 14px;">${project.name}</p>
  </div>

  <!-- Content -->
  <div style="background: white; padding: 32px; border: 1px solid #e5e7eb; border-top: none;">

    <!-- Greeting -->
    <p style="margin: 0 0 20px 0; font-size: 15px;">
      Dear ${supplierName},
    </p>

    <p style="margin: 0 0 24px 0; font-size: 15px; color: #4b5563;">
      <strong>Meisner Interiors</strong> is requesting a quote for the following items for our project. Please review the details below and submit your pricing through our secure portal.
    </p>

    ${message ? `
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 0 0 24px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>Note:</strong> ${message}</p>
    </div>
    ` : ''}

    <!-- Project Info -->
    <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 0 0 24px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px; width: 120px;">Project:</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px; font-weight: 500;">${project.name}</td>
        </tr>
        ${project.address ? `
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Address:</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px;">${project.address}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Client:</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px;">${project.client.name}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Items:</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px; font-weight: 500;">${items.length} item${items.length > 1 ? 's' : ''}</td>
        </tr>
      </table>
    </div>

    <!-- Items Table -->
    <h3 style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">Items Requested</h3>

    <table style="width: 100%; border-collapse: collapse; margin: 0 0 32px 0;">
      <thead>
        <tr style="background: #f9fafb;">
          <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;"></th>
          <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Item Details</th>
          <th style="padding: 12px 16px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    ${includeSpecSheet ? `
    <!-- Spec Sheet Note -->
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0; color: #0369a1; font-size: 14px;">
        <strong>📋 Spec sheets & documents available</strong><br>
        <span style="font-size: 13px; color: #0284c7;">Full specifications and product documents are available in the portal for your review.</span>
      </p>
    </div>
    ` : ''}

    ${includeNotes ? `
    <!-- Notes Available -->
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0; color: #b45309; font-size: 14px;">
        <strong>📝 Item notes included</strong><br>
        <span style="font-size: 13px; color: #d97706;">Specific notes and requirements for each item are available in the portal.</span>
      </p>
    </div>
    ` : ''}

    <!-- CTA Button -->
    <div style="text-align: center; margin: 32px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #1f2937 0%, #374151 100%); color: white; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
        Submit Your Quote
      </a>
    </div>

    <p style="text-align: center; color: #9ca3af; font-size: 11px; margin: 0;">
      Please respond by ${deadline.toLocaleDateString()}
    </p>

  </div>

  <!-- Footer -->
  <div style="padding: 24px; text-align: center; border-radius: 0 0 12px 12px; background: #f9fafb;">
    <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 4px 0;">
      Meisner Interiors
    </p>
    <p style="color: #6b7280; font-size: 13px; margin: 0 0 12px 0;">
      Questions? Reply to this email or contact us directly.
    </p>
    <p style="color: #9ca3af; font-size: 11px; margin: 0;">
      www.meisnerinteriors.com | Powered by StudioFlow
    </p>
  </div>

</body>
</html>`
}
