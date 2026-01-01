// Send invoice to client via email
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const { id: projectId, invoiceId } = await params
    const body = await request.json()
    const { email, subject, message } = body

    // Fetch invoice with org info
    const invoice = await prisma.clientQuote.findFirst({
      where: {
        id: invoiceId,
        projectId,
        orgId
      },
      include: {
        lineItems: true,
        project: {
          select: {
            name: true,
            client: {
              select: {
                name: true,
                email: true
              }
            },
            organization: {
              select: {
                name: true,
                businessName: true,
                businessEmail: true,
                businessPhone: true,
                logoUrl: true
              }
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const clientEmail = email || invoice.clientEmail || invoice.project.client?.email
    if (!clientEmail) {
      return NextResponse.json({ error: 'No client email address provided' }, { status: 400 })
    }

    // Generate invoice link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const invoiceLink = `${baseUrl}/client/invoice/${invoice.accessToken}`

    // Build email content
    const orgName = invoice.project.organization?.businessName || invoice.project.organization?.name || 'Your Designer'
    const clientName = invoice.clientName || invoice.project.client?.name || 'Client'

    const emailSubject = subject || `Invoice ${invoice.quoteNumber} from ${orgName}`
    const personalMessage = message || ''

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <!-- Header -->
            <div style="background: #1a1a1a; padding: 32px; text-align: center;">
              ${invoice.project.organization?.logoUrl
                ? `<img src="${invoice.project.organization.logoUrl}" alt="${orgName}" style="height: 40px; margin-bottom: 16px;">`
                : `<h1 style="color: white; margin: 0; font-size: 24px;">${orgName}</h1>`
              }
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
              <h2 style="margin: 0 0 8px 0; color: #1a1a1a;">Invoice ${invoice.quoteNumber}</h2>
              <p style="color: #666; margin: 0 0 24px 0;">${invoice.title}</p>

              <p style="color: #333; line-height: 1.6;">Hi ${clientName},</p>

              ${personalMessage ? `<p style="color: #333; line-height: 1.6;">${personalMessage}</p>` : ''}

              <p style="color: #333; line-height: 1.6;">
                Please find attached your invoice for ${invoice.project.name}.
                You can view the details and make a payment using the button below.
              </p>

              <!-- Invoice Summary -->
              <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 24px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #666; padding: 4px 0;">Items</td>
                    <td style="text-align: right; color: #333;">${invoice.lineItems.length} item${invoice.lineItems.length !== 1 ? 's' : ''}</td>
                  </tr>
                  <tr>
                    <td style="color: #666; padding: 4px 0;">Subtotal</td>
                    <td style="text-align: right; color: #333;">$${Number(invoice.subtotal).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  ${invoice.gstAmount ? `
                  <tr>
                    <td style="color: #666; padding: 4px 0;">GST (5%)</td>
                    <td style="text-align: right; color: #333;">$${Number(invoice.gstAmount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  ` : ''}
                  ${invoice.qstAmount ? `
                  <tr>
                    <td style="color: #666; padding: 4px 0;">QST (9.975%)</td>
                    <td style="text-align: right; color: #333;">$${Number(invoice.qstAmount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  ` : ''}
                  <tr style="border-top: 1px solid #ddd;">
                    <td style="color: #1a1a1a; font-weight: 600; padding: 12px 0 4px 0;">Total Due</td>
                    <td style="text-align: right; color: #1a1a1a; font-weight: 600; font-size: 18px;">$${Number(invoice.totalAmount).toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${invoiceLink}" style="display: inline-block; background: #1a1a1a; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 500;">
                  View Invoice & Pay
                </a>
              </div>

              ${invoice.validUntil ? `
              <p style="color: #666; font-size: 14px; text-align: center;">
                Valid until ${new Date(invoice.validUntil).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              ` : ''}
            </div>

            <!-- Footer -->
            <div style="background: #f9f9f9; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                ${orgName}
                ${invoice.project.organization?.businessEmail ? ` • ${invoice.project.organization.businessEmail}` : ''}
                ${invoice.project.organization?.businessPhone ? ` • ${invoice.project.organization.businessPhone}` : ''}
              </p>
              <p style="color: #999; font-size: 12px; margin: 8px 0 0 0;">
                Items will be ordered upon payment confirmation.
              </p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email
    if (process.env.RESEND_API_KEY) {
      const trackingId = `${invoiceId}-${Date.now()}`

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'invoices@resend.dev',
        to: clientEmail,
        subject: emailSubject,
        html: emailHtml,
        headers: {
          'X-Entity-Ref-ID': trackingId
        }
      })

      // Log email
      await prisma.clientQuoteEmailLog.create({
        data: {
          clientQuoteId: invoiceId,
          to: clientEmail,
          subject: emailSubject,
          htmlContent: emailHtml,
          trackingPixelId: trackingId
        }
      })
    }

    // Update invoice status
    await prisma.clientQuote.update({
      where: { id: invoiceId },
      data: {
        status: 'SENT_TO_CLIENT',
        sentToClientAt: new Date(),
        sentById: userId,
        clientEmail: clientEmail // Update client email if provided
      }
    })

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: invoiceId,
        type: 'SENT',
        message: `Invoice sent to ${clientEmail}`,
        userId: userId
      }
    })

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${clientEmail}`,
      invoiceLink
    })
  } catch (error) {
    console.error('Error sending invoice:', error)
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 })
  }
}
