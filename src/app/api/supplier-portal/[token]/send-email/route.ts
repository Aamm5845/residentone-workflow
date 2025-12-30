import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/supplier-portal/[token]/send-email
 *
 * Send quote by email from supplier portal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { message, attachmentUrl, attachmentName } = body

    // Verify the token and get supplier RFQ
    const supplierRFQ = await prisma.supplierRFQ.findFirst({
      where: {
        accessToken: token,
        tokenExpiresAt: { gte: new Date() }
      },
      include: {
        rfq: {
          include: {
            project: {
              select: {
                name: true,
                client: { select: { name: true } }
              }
            },
            lineItems: {
              include: {
                roomFFEItem: {
                  select: {
                    name: true,
                    quantity: true,
                    brand: true,
                    sku: true,
                    images: true
                  }
                }
              }
            }
          }
        },
        supplier: {
          select: {
            name: true,
            email: true,
            contactName: true
          }
        }
      }
    })

    if (!supplierRFQ) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    const supplierName = supplierRFQ.supplier?.name || supplierRFQ.vendorName || 'Supplier'
    const supplierEmail = supplierRFQ.supplier?.email || supplierRFQ.vendorEmail
    const rfqNumber = supplierRFQ.rfq.rfqNumber
    const projectName = supplierRFQ.rfq.project.name

    // Build email content
    const itemsList = supplierRFQ.rfq.lineItems
      .map((item, idx) => `${idx + 1}. ${item.itemName} (Qty: ${item.quantity})`)
      .join('\n')

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Quote Submission - ${rfqNumber}</h2>
        <p>Hello,</p>
        <p>Please find the quote from <strong>${supplierName}</strong> for project <strong>${projectName}</strong>.</p>

        ${message ? `
        <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0; color: #374151;"><strong>Message from supplier:</strong></p>
          <p style="margin: 8px 0 0; color: #4b5563;">${message}</p>
        </div>
        ` : ''}

        <h3 style="color: #374151; margin-top: 24px;">Items Quoted:</h3>
        <pre style="background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 14px; overflow-x: auto;">${itemsList}</pre>

        ${attachmentUrl ? `
        <p style="margin-top: 16px;">
          <a href="${attachmentUrl}" style="display: inline-block; background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
            Download Quote Document
          </a>
        </p>
        ` : ''}

        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
          This quote was submitted via the Meisner Interiors supplier portal.<br />
          Reference: ${rfqNumber}
        </p>
      </div>
    `

    // Send email to internal team
    await sendEmail({
      to: 'shaya@meisnerinteriors.com',
      subject: `Quote Received: ${rfqNumber} - ${supplierName} for ${projectName}`,
      html: emailHtml
    })

    // Log the email send action
    await prisma.supplierAccessLog.create({
      data: {
        supplierRFQId: supplierRFQ.id,
        action: 'EMAIL_SENT_BY_SUPPLIER',
        metadata: {
          hasMessage: !!message,
          hasAttachment: !!attachmentUrl
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Quote sent by email successfully'
    })

  } catch (error) {
    console.error('Error sending supplier email:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
