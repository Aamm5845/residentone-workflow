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

    // Parse optional body for custom email
    let customEmail: string | undefined
    try {
      const body = await request.json()
      customEmail = body.email
    } catch {
      // No body or invalid JSON is fine
    }

    // Get invoice with payments and project info
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
      include: {
        project: {
          select: { name: true },
        },
        payments: {
          where: { status: 'COMPLETED' },
          orderBy: { paidAt: 'desc' },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.payments.length === 0) {
      return NextResponse.json({ error: 'No payments recorded on this invoice' }, { status: 400 })
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
        businessAddress: true,
        businessCity: true,
        businessProvince: true,
        businessPostal: true,
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

    // Format date
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-CA', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    }

    // Get payment method label
    const getMethodLabel = (method: string) => {
      const labels: Record<string, string> = {
        CREDIT_CARD: 'Credit Card',
        BANK_TRANSFER: 'Bank Transfer',
        E_TRANSFER: 'Interac e-Transfer',
        CHECK: 'Check',
        CASH: 'Cash',
        OTHER: 'Other',
      }
      return labels[method] || method
    }

    // Generate payment rows
    const paymentsHtml = invoice.payments.map(payment => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #475569;">
          ${formatDate(payment.paidAt || payment.createdAt)}
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #475569;">
          ${getMethodLabel(payment.method)}
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600; text-align: right;">
          ${formatCurrency(Number(payment.amount))}
        </td>
      </tr>
    `).join('')

    // Build email HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Receipt from ${companyName}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #334155 0%, #475569 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              ${org?.logoUrl ? `
                <div style="background: white; display: inline-block; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px;">
                  <img src="${org.logoUrl}" alt="${companyName}" style="height: 40px; max-width: 180px; object-fit: contain;" />
                </div>
              ` : `
                <h1 style="color: white; margin: 0; font-size: 24px;">${companyName}</h1>
              `}
            </div>

            <!-- Content -->
            <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px;">
              <!-- Thank You Message -->
              <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 64px; height: 64px; background-color: #dcfce7; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 24px;">Payment Received</h2>
                <p style="color: #64748b; margin: 0;">Thank you for your payment!</p>
              </div>

              <!-- Invoice Info -->
              <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="color: #64748b; padding: 4px 0;">Invoice Number</td>
                    <td style="color: #1e293b; font-weight: 600; text-align: right; padding: 4px 0;">${invoice.invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; padding: 4px 0;">Project</td>
                    <td style="color: #1e293b; text-align: right; padding: 4px 0;">${invoice.project.name}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; padding: 4px 0;">Invoice Total</td>
                    <td style="color: #1e293b; text-align: right; padding: 4px 0;">${formatCurrency(Number(invoice.totalAmount))}</td>
                  </tr>
                </table>
              </div>

              <!-- Payment Details -->
              <h3 style="color: #1e293b; font-size: 16px; margin: 0 0 16px; font-weight: 600;">Payment Details</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #f8fafc;">
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Date</th>
                    <th style="padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Method</th>
                    <th style="padding: 12px 16px; text-align: right; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${paymentsHtml}
                </tbody>
              </table>

              <!-- Summary -->
              <div style="background-color: ${Number(invoice.balanceDue) <= 0 ? '#dcfce7' : '#fef3c7'}; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="color: #64748b; margin: 0 0 8px; font-size: 14px;">
                  ${Number(invoice.balanceDue) <= 0 ? 'Total Paid' : 'Remaining Balance'}
                </p>
                <p style="color: ${Number(invoice.balanceDue) <= 0 ? '#16a34a' : '#d97706'}; margin: 0; font-size: 28px; font-weight: 700;">
                  ${formatCurrency(Number(invoice.balanceDue) <= 0 ? Number(invoice.amountPaid) : Number(invoice.balanceDue))}
                </p>
                ${Number(invoice.balanceDue) <= 0 ? `
                  <p style="color: #16a34a; margin: 8px 0 0; font-size: 14px; font-weight: 600;">
                    ✓ Paid in Full
                  </p>
                ` : ''}
              </div>

              <!-- View Invoice Link -->
              <div style="text-align: center; margin-top: 24px;">
                <a href="${invoiceUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #334155 0%, #475569 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  View Invoice
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 20px; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0;">This receipt was sent by ${companyName}</p>
              ${org?.businessEmail ? `<p style="margin: 8px 0 0;">Contact: <a href="mailto:${org.businessEmail}" style="color: #60a5fa; text-decoration: none;">${org.businessEmail}</a></p>` : ''}
              ${org?.businessAddress ? `
                <p style="margin: 8px 0 0;">
                  ${org.businessAddress}${org.businessCity ? `, ${org.businessCity}` : ''}${org.businessProvince ? `, ${org.businessProvince}` : ''} ${org.businessPostal || ''}
                </p>
              ` : ''}
            </div>
          </div>
        </body>
      </html>
    `

    // Determine recipient
    const recipientEmail = customEmail || invoice.clientEmail

    // Send email
    const emailSent = await sendEmail({
      to: recipientEmail,
      subject: `Payment Receipt - ${invoice.invoiceNumber} from ${companyName}`,
      html,
    })

    if (!emailSent) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    // Log activity
    await prisma.billingInvoiceActivity.create({
      data: {
        billingInvoiceId: id,
        type: 'RECEIPT_SENT',
        message: `Payment receipt sent to ${recipientEmail}`,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Receipt sent to ${recipientEmail}`,
    })
  } catch (error) {
    console.error('Error sending receipt:', error)
    return NextResponse.json({ error: 'Failed to send receipt' }, { status: 500 })
  }
}
