import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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
            subject: `Request for Quote: ${rfq.title} - ${rfq.project.name}`,
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
            subject: `Request for Quote: ${rfq.title} - ${rfq.project.name}`,
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
  const companyName = supplier?.name || vendor?.company || ''

  const itemsList = rfq.lineItems.map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.itemName}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.quantity} ${item.unitType || 'units'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.roomFFEItem?.section?.name || item.roomFFEItem?.brand || '-'}</td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Request for Quote</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Request for Quote</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${rfq.rfqNumber}</p>
      </div>

      <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
        <p>Dear ${recipientName}${companyName ? ` at ${companyName}` : ''},</p>

        <p>You have been invited to submit a quote for the following project:</p>

        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2 style="margin: 0 0 10px 0; color: #1f2937; font-size: 18px;">${rfq.title}</h2>
          <p style="margin: 0; color: #6b7280;">Project: ${rfq.project.name}</p>
          ${deadline ? `<p style="margin: 10px 0 0 0; color: #dc2626;">Response Deadline: ${new Date(deadline).toLocaleDateString()}</p>` : ''}
        </div>

        ${message ? `
        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">${message}</p>
        </div>
        ` : ''}

        ${rfq.description ? `<p>${rfq.description}</p>` : ''}

        <h3 style="color: #374151; margin-top: 25px;">Items Requested (${rfq.lineItems.length})</h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Quantity</th>
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #e5e7eb;">Category</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
        </table>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            View RFQ & Submit Quote
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          Click the button above to view full item specifications and submit your quote.
          This link is unique to you and will expire ${deadline ? `on ${new Date(deadline).toLocaleDateString()}` : 'in 30 days'}.
        </p>
      </div>

      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </body>
    </html>
  `
}
