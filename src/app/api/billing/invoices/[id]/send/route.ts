import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getClientBaseUrl } from '@/lib/get-base-url'

interface AuthSession {
  user: {
    id: string
    orgId: string
    role: string
  }
}

// Helper to check billing access
async function canAccessBilling(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canSeeBilling: true },
  })
  return user?.role === 'OWNER' || user?.canSeeBilling === true
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    // Parse optional body for custom email settings
    let customEmail: string | undefined
    let customSubject: string | undefined
    let customMessage: string | undefined
    try {
      const body = await request.json()
      customEmail = body.email
      customSubject = body.subject
      customMessage = body.message
    } catch {
      // No body or invalid JSON is fine
    }

    // Get invoice with project info
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
      include: {
        project: {
          select: { name: true },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Cannot send paid or void invoices
    if (['PAID', 'VOID'].includes(invoice.status)) {
      return NextResponse.json({
        error: `Cannot send a ${invoice.status.toLowerCase()} invoice`
      }, { status: 400 })
    }

    // Get organization for branding
    const org = await prisma.organization.findFirst({
      where: { id: session.user.orgId },
      select: {
        name: true,
        businessName: true,
        logoUrl: true,
        businessEmail: true,
        businessPhone: true,
      },
    })

    const companyName = org?.businessName || org?.name || 'Our Company'
    const baseUrl = getClientBaseUrl()
    const invoiceUrl = `${baseUrl}/client/billing-invoice/${invoice.accessToken}`

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
      }).format(amount)
    }

    // Get invoice type label
    const typeLabels: Record<string, string> = {
      STANDARD: 'Invoice',
      DEPOSIT: 'Deposit Invoice',
      MILESTONE: 'Milestone Invoice',
      HOURLY: 'Time & Materials Invoice',
      FINAL: 'Final Invoice',
    }
    const typeLabel = typeLabels[invoice.type] || 'Invoice'

    // Format due date
    const formattedDueDate = invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString('en-CA', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      : 'Upon Receipt'

    // Build email HTML with fully inline styles for maximum email client compatibility
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${typeLabel} from ${companyName}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f1f5f9;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">

                  <!-- Header -->
                  <tr>
                    <td style="background-color: #334155; padding: 32px 40px; text-align: center;">
                      ${org?.logoUrl ? `
                        <div style="background-color: #ffffff; display: inline-block; padding: 12px 20px; border-radius: 8px;">
                          <img src="${org.logoUrl}" alt="${companyName}" style="height: 44px; max-width: 200px; display: block;" />
                        </div>
                      ` : `
                        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">${companyName}</h1>
                      `}
                    </td>
                  </tr>

                  <!-- Main Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <!-- Greeting -->
                      <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                        Hi ${invoice.clientName},
                      </p>
                      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                        Please find your ${typeLabel.toLowerCase()} for <strong style="color: #1e293b;">${invoice.project.name}</strong> below.
                      </p>

                      ${customMessage ? `
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                        <tr>
                          <td style="background-color: #f8fafc; border-left: 4px solid #475569; padding: 16px 20px; border-radius: 0 8px 8px 0;">
                            <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${customMessage}</p>
                          </td>
                        </tr>
                      </table>
                      ` : ''}

                      <!-- Invoice Card -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 12px; margin-bottom: 32px;">
                        <tr>
                          <td style="padding: 24px;">
                            <!-- Invoice Header -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px;">
                              <tr>
                                <td>
                                  <p style="color: #64748b; font-size: 12px; font-family: monospace; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px;">${invoice.invoiceNumber}</p>
                                  <p style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0;">${invoice.title}</p>
                                </td>
                              </tr>
                            </table>

                            <!-- Amount Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
                              <tr>
                                <td style="padding: 24px; text-align: center;">
                                  <p style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Amount Due</p>
                                  <p style="color: #1e293b; font-size: 36px; font-weight: 700; margin: 0; letter-spacing: -1px;">${formatCurrency(Number(invoice.balanceDue))}</p>
                                  <p style="color: ${invoice.dueDate && new Date(invoice.dueDate) < new Date() ? '#dc2626' : '#64748b'}; font-size: 14px; margin: 12px 0 0; font-weight: 500;">
                                    Due: ${formattedDueDate}
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- CTA Button -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="text-align: center; padding-bottom: 24px;">
                            <a href="${invoiceUrl}" style="display: inline-block; background-color: #334155; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 8px;">
                              View &amp; Pay Invoice
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="color: #94a3b8; font-size: 13px; text-align: center; margin: 0;">
                        Click the button above to view the full invoice and make a secure payment.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #1e293b; padding: 24px 40px; text-align: center;">
                      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px;">
                        This invoice was sent by <strong style="color: #cbd5e1;">${companyName}</strong>
                      </p>
                      ${org?.businessEmail ? `
                        <p style="margin: 0 0 12px;">
                          <a href="mailto:${org.businessEmail}" style="color: #60a5fa; font-size: 13px; text-decoration: none;">${org.businessEmail}</a>
                        </p>
                      ` : ''}
                      <p style="margin: 0;">
                        <a href="${invoiceUrl}" style="color: #60a5fa; font-size: 12px; text-decoration: none;">View invoice online</a>
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    // Determine recipient and subject
    const recipientEmail = customEmail || invoice.clientEmail
    const emailSubject = customSubject || `${typeLabel} ${invoice.invoiceNumber} from ${companyName}`

    // Send email
    const emailSent = await sendEmail({
      to: recipientEmail,
      subject: emailSubject,
      html,
    })

    if (!emailSent) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    // Update invoice status
    await prisma.billingInvoice.update({
      where: { id },
      data: {
        status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status,
        sentAt: new Date(),
      },
    })

    // Log activity
    await prisma.billingInvoiceActivity.create({
      data: {
        billingInvoiceId: id,
        type: 'SENT',
        message: `Invoice sent to ${recipientEmail}`,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${recipientEmail}`,
    })
  } catch (error) {
    console.error('Error sending invoice:', error)
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 })
  }
}
