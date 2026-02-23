import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getClientBaseUrl } from '@/lib/get-base-url'

interface SendInvoiceEmailOptions {
  customEmail?: string
  customSubject?: string
  customMessage?: string
}

/**
 * Send an invoice email to the client and update invoice status.
 * Reusable from both the invoice send API route and auto-send on proposal signing.
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  orgId: string,
  options?: SendInvoiceEmailOptions
): Promise<boolean> {
  // Get invoice with project info
  const invoice = await prisma.billingInvoice.findFirst({
    where: {
      id: invoiceId,
      orgId,
    },
    include: {
      project: {
        select: { name: true },
      },
    },
  })

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  // Cannot send paid or void invoices
  if (['PAID', 'VOID'].includes(invoice.status)) {
    throw new Error(`Cannot send a ${invoice.status.toLowerCase()} invoice`)
  }

  // Get organization for branding
  const org = await prisma.organization.findFirst({
    where: { id: orgId },
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

  const customMessage = options?.customMessage

  // Build email HTML
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
  const recipientEmail = options?.customEmail || invoice.clientEmail
  const emailSubject = options?.customSubject || `${typeLabel} ${invoice.invoiceNumber} from ${companyName}`

  // Send email
  const emailSent = await sendEmail({
    to: recipientEmail,
    subject: emailSubject,
    html,
  })

  if (!emailSent) {
    throw new Error('Failed to send email')
  }

  // Update invoice status
  await prisma.billingInvoice.update({
    where: { id: invoiceId },
    data: {
      status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status,
      sentAt: new Date(),
    },
  })

  // Log activity
  await prisma.billingInvoiceActivity.create({
    data: {
      billingInvoiceId: invoiceId,
      type: 'SENT',
      message: `Invoice sent to ${recipientEmail}`,
    },
  })

  return true
}
