// Send payment reminder for an invoice
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email-service'

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
    const { message } = body

    // Fetch invoice with payment info
    const invoice = await prisma.clientQuote.findFirst({
      where: {
        id: invoiceId,
        projectId,
        orgId: orgId
      },
      include: {
        payments: {
          where: {
            status: { in: ['PAID', 'PARTIAL'] }
          }
        },
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

    const clientEmail = invoice.clientEmail || invoice.project.client?.email
    if (!clientEmail) {
      return NextResponse.json({ error: 'No client email address' }, { status: 400 })
    }

    // Calculate balance
    const totalAmount = Number(invoice.totalAmount) || 0
    const paidAmount = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const balance = totalAmount - paidAmount

    if (balance <= 0) {
      return NextResponse.json({ error: 'Invoice is fully paid' }, { status: 400 })
    }

    // Generate invoice link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const invoiceLink = `${baseUrl}/client/invoice/${invoice.accessToken}`

    const orgName = invoice.project.organization?.businessName || invoice.project.organization?.name || 'Your Designer'
    const clientName = invoice.clientName || invoice.project.client?.name || 'Client'

    const isOverdue = invoice.validUntil && new Date(invoice.validUntil) < new Date()

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
            <div style="background: ${isOverdue ? '#dc2626' : '#f59e0b'}; padding: 32px; text-align: center;">
              ${invoice.project.organization?.logoUrl
                ? `<img src="${invoice.project.organization.logoUrl}" alt="${orgName}" style="height: 40px; margin-bottom: 16px; filter: brightness(0) invert(1);">`
                : ''
              }
              <h1 style="color: white; margin: 0; font-size: 20px;">
                ${isOverdue ? 'Payment Overdue' : 'Payment Reminder'}
              </h1>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
              <p style="color: #333; line-height: 1.6;">Hi ${clientName},</p>

              <p style="color: #333; line-height: 1.6;">
                This is a friendly reminder that ${paidAmount > 0 ? 'a balance remains' : 'payment is pending'} on Invoice <strong>${invoice.quoteNumber}</strong> for ${invoice.title}.
              </p>

              ${message ? `<p style="color: #333; line-height: 1.6; background: #f9f9f9; padding: 16px; border-radius: 8px; border-left: 4px solid #1a1a1a;">${message}</p>` : ''}

              <!-- Balance Summary -->
              <div style="background: ${isOverdue ? '#fef2f2' : '#fffbeb'}; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid ${isOverdue ? '#fecaca' : '#fde68a'};">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #666; padding: 4px 0;">Invoice Total</td>
                    <td style="text-align: right; color: #333;">$${totalAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  ${paidAmount > 0 ? `
                  <tr>
                    <td style="color: #666; padding: 4px 0;">Amount Paid</td>
                    <td style="text-align: right; color: #16a34a;">-$${paidAmount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</td>
                  </tr>
                  ` : ''}
                  <tr style="border-top: 1px solid ${isOverdue ? '#fecaca' : '#fde68a'};">
                    <td style="color: ${isOverdue ? '#dc2626' : '#d97706'}; font-weight: 600; padding: 12px 0 4px 0;">
                      ${isOverdue ? 'Overdue Balance' : 'Balance Due'}
                    </td>
                    <td style="text-align: right; color: ${isOverdue ? '#dc2626' : '#d97706'}; font-weight: 600; font-size: 20px;">
                      $${balance.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </table>
              </div>

              ${isOverdue && invoice.validUntil ? `
              <p style="color: #dc2626; font-size: 14px; text-align: center; margin-bottom: 24px;">
                This invoice was due on ${new Date(invoice.validUntil).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
              ` : ''}

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${invoiceLink}" style="display: inline-block; background: #1a1a1a; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 500;">
                  View Invoice & Pay Now
                </a>
              </div>

              <p style="color: #666; font-size: 14px; text-align: center;">
                If you've already sent payment, please disregard this reminder.
              </p>
            </div>

            <!-- Footer -->
            <div style="background: #f9f9f9; padding: 24px 32px; text-align: center; border-top: 1px solid #eee;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                ${orgName}
                ${invoice.project.organization?.businessEmail ? ` • ${invoice.project.organization.businessEmail}` : ''}
                ${invoice.project.organization?.businessPhone ? ` • ${invoice.project.organization.businessPhone}` : ''}
              </p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email using centralized email service
    const trackingId = `reminder-${invoiceId}-${Date.now()}`
    const emailSubject = `${isOverdue ? 'Payment Overdue' : 'Payment Reminder'}: Invoice ${invoice.quoteNumber}${invoice.title ? ` - ${invoice.title}` : ''}`

    try {
      await sendEmail({
        to: clientEmail,
        subject: emailSubject,
        html: emailHtml
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
    } catch (emailError: any) {
      console.error('Email send error:', emailError)
      return NextResponse.json({
        error: emailError.message || 'Failed to send reminder email',
        details: emailError.message
      }, { status: 500 })
    }

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: invoiceId,
        type: 'REMINDER_SENT',
        message: `Payment reminder sent to ${clientEmail}`,
        userId: userId,
        metadata: {
          balance,
          isOverdue
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: `Reminder sent to ${clientEmail}`
    })
  } catch (error) {
    console.error('Error sending reminder:', error)
    return NextResponse.json({ error: 'Failed to send reminder' }, { status: 500 })
  }
}
