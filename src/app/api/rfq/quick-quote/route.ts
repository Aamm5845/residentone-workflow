import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rfq/quick-quote
 * Quick quote - sends RFQ directly to linked suppliers without multi-step wizard
 * 
 * Expected body:
 * {
 *   projectId: string,
 *   itemIds: string[],          // RoomFFEItem IDs
 *   overrideSupplierIds?: string[], // Optional: override auto-detected suppliers
 *   message?: string            // Optional message to include
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, itemIds, overrideSupplierIds, message } = body

    if (!projectId || !itemIds?.length) {
      return NextResponse.json(
        { error: 'Project ID and at least one item ID required' },
        { status: 400 }
      )
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Get items with their supplier info
    const items = await prisma.roomFFEItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        name: true,
        description: true,
        quantity: true,
        unitType: true,
        supplierName: true,
        brand: true,
        images: true,
        thumbnailUrl: true,
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
        }
      }
    })

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid items found' }, { status: 400 })
    }

    // Verify items belong to the project
    const projectCheck = items.every(item => 
      item.section?.instance?.room?.projectId === projectId
    )
    if (!projectCheck) {
      return NextResponse.json(
        { error: 'Some items do not belong to the specified project' },
        { status: 400 }
      )
    }

    // Get all suppliers for the org
    const allSuppliers = await prisma.supplier.findMany({
      where: { orgId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        contactName: true
      }
    })

    // Match items to suppliers by name (case-insensitive)
    let supplierIds: string[] = []
    
    if (overrideSupplierIds?.length) {
      // User chose to override
      supplierIds = overrideSupplierIds
    } else {
      // Auto-detect from item supplierName
      const matchedSupplierIds = new Set<string>()
      
      for (const item of items) {
        if (item.supplierName) {
          const normalizedName = item.supplierName.toLowerCase().trim()
          const matchedSupplier = allSuppliers.find(s => 
            s.name.toLowerCase().trim() === normalizedName ||
            s.name.toLowerCase().includes(normalizedName) ||
            normalizedName.includes(s.name.toLowerCase())
          )
          if (matchedSupplier) {
            matchedSupplierIds.add(matchedSupplier.id)
          }
        }
      }
      
      supplierIds = Array.from(matchedSupplierIds)
    }

    if (supplierIds.length === 0) {
      // No suppliers matched - return info for UI to show supplier selection
      return NextResponse.json({
        needsSupplierSelection: true,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          supplierName: item.supplierName,
          brand: item.brand
        })),
        availableSuppliers: allSuppliers,
        message: 'No matching suppliers found for item supplier names. Please select suppliers.'
      })
    }

    // Get project info
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create RFQ
    const rfqNumber = await generateRFQNumber(orgId)
    
    const rfq = await prisma.rFQ.create({
      data: {
        orgId,
        projectId,
        rfqNumber,
        title: `Quote Request - ${items.length} item(s)`,
        description: message || null,
        status: 'DRAFT',
        createdById: userId,
        updatedById: userId,
        lineItems: {
          create: items.map((item, index) => ({
            roomFFEItemId: item.id,
            itemName: item.name,
            itemDescription: item.description || '',
            quantity: item.quantity || 1,
            unitType: item.unitType || 'units',
            order: index
          }))
        }
      },
      include: {
        project: { select: { id: true, name: true } },
        lineItems: {
          include: {
            roomFFEItem: {
              select: {
                id: true,
                name: true,
                description: true,
                brand: true,
                images: true,
                thumbnailUrl: true
              }
            }
          }
        }
      }
    })

    // Create SupplierRFQ records and send emails
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const results: Array<{ supplierId: string; email: string; success: boolean; error?: string }> = []

    for (const supplierId of supplierIds) {
      const supplier = allSuppliers.find(s => s.id === supplierId)
      if (!supplier) continue

      const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

      const supplierRFQ = await prisma.supplierRFQ.create({
        data: {
          rfqId: rfq.id,
          supplierId,
          tokenExpiresAt,
          sentAt: new Date()
        }
      })

      const portalUrl = `${baseUrl}/supplier-portal/${supplierRFQ.accessToken}`

      try {
        await sendEmail({
          to: supplier.email,
          subject: `Request for Quote: ${rfq.title} - ${project.name}`,
          html: generateQuickQuoteEmail({
            rfq,
            items,
            supplier,
            portalUrl,
            message
          })
        })

        results.push({
          supplierId: supplier.id,
          email: supplier.email,
          success: true
        })

        await prisma.supplierAccessLog.create({
          data: {
            supplierRFQId: supplierRFQ.id,
            action: 'EMAIL_SENT',
            metadata: { sentBy: userId }
          }
        })
      } catch (emailError: any) {
        results.push({
          supplierId: supplier.id,
          email: supplier.email,
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

      // Update items to QUOTING status
      await prisma.roomFFEItem.updateMany({
        where: { id: { in: itemIds } },
        data: { specStatus: 'QUOTING' }
      })

      await prisma.rFQActivity.create({
        data: {
          rfqId: rfq.id,
          type: 'SENT',
          message: `Quick quote sent to ${successCount} supplier(s)`,
          userId,
          metadata: { results }
        }
      })
    }

    return NextResponse.json({
      success: successCount > 0,
      rfqId: rfq.id,
      rfqNumber: rfq.rfqNumber,
      sent: successCount,
      failed: results.length - successCount,
      results
    })

  } catch (error) {
    console.error('Error creating quick quote:', error)
    return NextResponse.json(
      { error: 'Failed to create quick quote' },
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

function generateQuickQuoteEmail({
  rfq,
  items,
  supplier,
  portalUrl,
  message
}: {
  rfq: any
  items: any[]
  supplier: any
  portalUrl: string
  message?: string
}) {
  const brandColor = '#10B981'

  const itemsList = items.map(item => {
    const imageUrl = item.thumbnailUrl || (item.images && item.images[0]) || null
    return `
    <tr>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
        ${imageUrl ? `<img src="${imageUrl}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #e5e7eb;" />` : `<div style="width: 60px; height: 60px; background: #f3f4f6; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 10px;">No image</div>`}
      </td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
        <strong style="color: #1f2937;">${item.name}</strong>
        ${item.description ? `<br/><span style="color: #6b7280; font-size: 13px;">${item.description.substring(0, 100)}${item.description.length > 100 ? '...' : ''}</span>` : ''}
        ${item.brand ? `<br/><span style="color: #9ca3af; font-size: 12px;">Brand: ${item.brand}</span>` : ''}
      </td>
      <td style="padding: 12px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; text-align: center;">
        <strong style="color: #1f2937;">${item.quantity || 1}</strong>
        <br/><span style="color: #6b7280; font-size: 12px;">${item.unitType || 'units'}</span>
      </td>
    </tr>
  `}).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Request for Quote</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
      <div style="background: ${brandColor}; padding: 30px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Request for Quote</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${rfq.rfqNumber}</p>
      </div>

      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p>Dear ${supplier.contactName || supplier.name},</p>

        <p>We are requesting a quote for the following items:</p>

        ${message ? `
        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">${message}</p>
        </div>
        ` : ''}

        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb; width: 70px;">Image</th>
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item Details</th>
              <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #e5e7eb; width: 80px;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
        </table>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalUrl}" style="display: inline-block; background: ${brandColor}; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            Submit Your Quote
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; text-align: center;">
          Click the button above to submit your quote. This link will expire in 30 days.
        </p>
      </div>

      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>This is an automated message from Meisner Interiors.</p>
      </div>
    </body>
    </html>
  `
}

