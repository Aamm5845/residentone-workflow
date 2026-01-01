import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

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
                images: true
              }
            }
          }
        }
      }
    })

    // Create SupplierRFQ records and send emails
    const baseUrl = getBaseUrl()
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
          subject: `Quote Request ${rfq.rfqNumber}: ${rfq.title} - ${project.name}`,
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

      // Update items to RFQ_SENT status
      await prisma.roomFFEItem.updateMany({
        where: { id: { in: itemIds } },
        data: { specStatus: 'RFQ_SENT' }
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
    const imageUrl = (item.images && item.images[0]) || null
    // Create a simple item row - images may be blocked by email clients
    return `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; width: 70px;">
        ${imageUrl ? `<img src="${imageUrl}" alt="${item.name}" width="50" height="50" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />` : `<span style="color: #9ca3af; font-size: 10px;">[No img]</span>`}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle;">
        <strong>${item.name}</strong>${item.brand ? ` - ${item.brand}` : ''}
      </td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; text-align: center; width: 60px;">
        <strong>${item.quantity || 1}</strong> ${item.unitType || 'units'}
      </td>
    </tr>
  `}).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Quote Request</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.4; color: #333; max-width: 550px; margin: 0 auto; padding: 10px;">
<div style="background: ${brandColor}; padding: 15px 20px; border-radius: 6px 6px 0 0;">
<h2 style="color: white; margin: 0;">Quote Request - ${rfq.rfqNumber}</h2>
</div>
<div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px;">
<p style="margin: 0 0 15px 0;">Hi ${supplier.contactName || supplier.name},</p>
<p style="margin: 0 0 15px 0;">Please provide a quote for:</p>
${message ? `<p style="background: #fef3c7; padding: 10px; border-radius: 4px; margin: 0 0 15px 0;"><em>${message}</em></p>` : ''}
<table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
<tr style="background: #f3f4f6;"><th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Item</th><th style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; width: 60px;">Qty</th></tr>
${items.map(item => `<tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>${item.name}</strong>${item.brand ? ` (${item.brand})` : ''}</td><td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td></tr>`).join('')}
</table>
<div style="text-align: center;">
<a href="${portalUrl}" style="display: inline-block; background: ${brandColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Submit Quote</a>
</div>
<p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 20px 0 0 0;">Please respond at your earliest convenience</p>
</div>
</body>
</html>`
}

