import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'
import { getBaseUrl } from '@/lib/get-base-url'

export const dynamic = 'force-dynamic'

/**
 * POST /api/rfq/[id]/send
 * Send RFQ to selected suppliers
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

    const { id } = await params
    const body = await request.json()
    const { supplierIds, oneTimeVendors, message } = body

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Get RFQ with details
    const rfq = await prisma.rFQ.findFirst({
      where: { id, orgId },
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
                images: true,
                section: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        supplierRFQs: {
          include: {
            supplier: true
          }
        }
      }
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    if (rfq.lineItems.length === 0) {
      return NextResponse.json(
        { error: 'RFQ must have at least one line item' },
        { status: 400 }
      )
    }

    const results: Array<{ supplierId?: string; email: string; success: boolean; error?: string }> = []
    const baseUrl = getBaseUrl()

    // Add or update supplier RFQs for selected suppliers
    if (supplierIds?.length) {
      for (const supplierId of supplierIds) {
        const supplier = await prisma.supplier.findFirst({
          where: { id: supplierId, orgId, isActive: true }
        })

        if (!supplier) {
          results.push({
            supplierId,
            email: '',
            success: false,
            error: 'Supplier not found or inactive'
          })
          continue
        }

        // Create or update SupplierRFQ
        let supplierRFQ = await prisma.supplierRFQ.findFirst({
          where: { rfqId: id, supplierId }
        })

        const tokenExpiresAt = rfq.responseDeadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

        if (!supplierRFQ) {
          supplierRFQ = await prisma.supplierRFQ.create({
            data: {
              rfqId: id,
              supplierId,
              tokenExpiresAt,
              sentAt: new Date()
            }
          })
        } else {
          await prisma.supplierRFQ.update({
            where: { id: supplierRFQ.id },
            data: {
              sentAt: new Date(),
              tokenExpiresAt
            }
          })
        }

        // Send email to supplier
        const portalUrl = `${baseUrl}/supplier-portal/${supplierRFQ.accessToken}`

        try {
          await sendEmail({
            to: supplier.email,
            subject: `Quote Request ${rfq.rfqNumber}: ${rfq.title} - ${rfq.project.name}`,
            html: generateRFQEmail({
              rfq,
              supplier,
              portalUrl,
              message,
              deadline: rfq.responseDeadline
            })
          })

          results.push({
            supplierId: supplier.id,
            email: supplier.email,
            success: true
          })

          // Log access
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
    }

    // Handle one-time vendors
    if (oneTimeVendors?.length) {
      for (const vendor of oneTimeVendors) {
        if (!vendor.email) {
          results.push({
            email: '',
            success: false,
            error: 'Vendor email is required'
          })
          continue
        }

        const tokenExpiresAt = rfq.responseDeadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        const supplierRFQ = await prisma.supplierRFQ.create({
          data: {
            rfqId: id,
            vendorName: vendor.name || null,
            vendorEmail: vendor.email,
            vendorPhone: vendor.phone || null,
            vendorCompany: vendor.company || null,
            tokenExpiresAt,
            sentAt: new Date()
          }
        })

        const portalUrl = `${baseUrl}/supplier-portal/${supplierRFQ.accessToken}`

        try {
          await sendEmail({
            to: vendor.email,
            subject: `Quote Request ${rfq.rfqNumber}: ${rfq.title} - ${rfq.project.name}`,
            html: generateRFQEmail({
              rfq,
              vendor,
              portalUrl,
              message,
              deadline: rfq.responseDeadline
            })
          })

          results.push({
            email: vendor.email,
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
            email: vendor.email,
            success: false,
            error: emailError.message
          })
        }
      }
    }

    // Update RFQ status
    const successCount = results.filter(r => r.success).length
    if (successCount > 0) {
      await prisma.rFQ.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          sentById: userId,
          updatedById: userId
        }
      })

      await prisma.rFQActivity.create({
        data: {
          rfqId: id,
          type: 'SENT',
          message: `RFQ sent to ${successCount} supplier(s)`,
          userId,
          metadata: { results }
        }
      })

      // Update linked RoomFFEItems to QUOTING status
      const roomFFEItemIds = rfq.lineItems
        .filter((item: any) => item.roomFFEItemId)
        .map((item: any) => item.roomFFEItemId)
      
      if (roomFFEItemIds.length > 0) {
        await prisma.roomFFEItem.updateMany({
          where: { id: { in: roomFFEItemIds } },
          data: { specStatus: 'QUOTING' }
        })
      }
    }

    return NextResponse.json({
      success: successCount > 0,
      sent: successCount,
      failed: results.length - successCount,
      results
    })
  } catch (error) {
    console.error('Error sending RFQ:', error)
    return NextResponse.json(
      { error: 'Failed to send RFQ' },
      { status: 500 }
    )
  }
}

function generateRFQEmail({
  rfq,
  supplier,
  vendor,
  portalUrl,
  message,
  deadline
}: {
  rfq: any
  supplier?: any
  vendor?: any
  portalUrl: string
  message?: string
  deadline?: Date | null
}) {
  const recipientName = supplier?.contactName || vendor?.name || 'Valued Supplier'
  const brandColor = '#10B981'

  // Simple compact item list
  const itemsHtml = rfq.lineItems.map((item: any) => 
    `<tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>${item.itemName}</strong>${item.roomFFEItem?.brand ? ` (${item.roomFFEItem.brand})` : ''}</td><td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${item.quantity} ${item.unitType || 'units'}</td></tr>`
  ).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Quote Request</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.4; color: #333; max-width: 550px; margin: 0 auto; padding: 10px;">
<div style="background: ${brandColor}; padding: 15px 20px; border-radius: 6px 6px 0 0;">
<h2 style="color: white; margin: 0;">Quote Request - ${rfq.rfqNumber}</h2>
</div>
<div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px;">
<p style="margin: 0 0 10px 0;">Hi ${recipientName},</p>
<p style="margin: 0 0 15px 0;"><strong>${rfq.title}</strong> - ${rfq.project.name}</p>
${message ? `<p style="background: #fef3c7; padding: 10px; border-radius: 4px; margin: 0 0 15px 0;"><em>${message}</em></p>` : ''}
<table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0;">
<tr style="background: #f3f4f6;"><th style="padding: 8px; text-align: left; border: 1px solid #e5e7eb;">Item</th><th style="padding: 8px; text-align: center; border: 1px solid #e5e7eb; width: 80px;">Qty</th></tr>
${itemsHtml}
</table>
<div style="text-align: center;">
<a href="${portalUrl}" style="display: inline-block; background: ${brandColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">Submit Quote</a>
</div>
<p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 20px 0 0 0;">Please respond by ${deadline ? new Date(deadline).toLocaleDateString() : 'your earliest convenience'}</p>
</div>
</body>
</html>`
}
