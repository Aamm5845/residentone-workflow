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

    // Build email HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${typeLabel} from ${companyName}</title>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .header { background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; background-color: #f8fafc; }
            .invoice-box {
              background-color: white;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 24px;
              margin: 20px 0;
            }
            .invoice-number {
              font-family: monospace;
              color: #64748b;
              font-size: 14px;
              margin-bottom: 8px;
            }
            .invoice-title {
              font-size: 20px;
              font-weight: 600;
              color: #1e293b;
              margin-bottom: 16px;
            }
            .amount-box {
              background-color: #f1f5f9;
              border-radius: 6px;
              padding: 16px;
              text-align: center;
              margin: 20px 0;
            }
            .amount-label { color: #64748b; font-size: 14px; margin-bottom: 4px; }
            .amount-value { color: #1e293b; font-size: 28px; font-weight: 700; }
            .due-date { color: #ef4444; font-size: 14px; margin-top: 8px; }
            .button {
              display: inline-block;
              padding: 14px 32px;
              background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              font-size: 16px;
            }
            .footer {
              background-color: #1e293b;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #94a3b8;
              border-radius: 0 0 8px 8px;
            }
            .footer a { color: #60a5fa; text-decoration: none; }
          </style>
        </head>
        <body style="background-color: #f1f5f9; padding: 20px;">
          <div class="container">
            <div class="header">
              <h1>${companyName}</h1>
            </div>
            <div class="content">
              <p style="color: #475569; line-height: 1.6;">
                Hi ${invoice.clientName},
              </p>
              <p style="color: #475569; line-height: 1.6;">
                Please find attached your ${typeLabel.toLowerCase()} for <strong>${invoice.project.name}</strong>.
              </p>

              <div class="invoice-box">
                <div class="invoice-number">${invoice.invoiceNumber}</div>
                <div class="invoice-title">${invoice.title}</div>

                <div class="amount-box">
                  <div class="amount-label">Amount Due</div>
                  <div class="amount-value">${formatCurrency(Number(invoice.balanceDue))}</div>
                  ${invoice.dueDate ? `
                    <div class="due-date">Due by ${new Date(invoice.dueDate).toLocaleDateString('en-CA', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}</div>
                  ` : ''}
                </div>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${invoiceUrl}" class="button">View & Pay Invoice</a>
              </div>

              <p style="color: #64748b; font-size: 14px; text-align: center;">
                Click the button above to view the invoice details and make a payment.
              </p>
            </div>
            <div class="footer">
              <p>This invoice was sent by ${companyName}</p>
              ${org?.businessEmail ? `<p>Contact: <a href="mailto:${org.businessEmail}">${org.businessEmail}</a></p>` : ''}
              <p style="margin-top: 12px;">
                <a href="${invoiceUrl}">View invoice online</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email
    const emailSent = await sendEmail({
      to: invoice.clientEmail,
      subject: `${typeLabel} ${invoice.invoiceNumber} from ${companyName}`,
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
        message: `Invoice sent to ${invoice.clientEmail}`,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${invoice.clientEmail}`,
    })
  } catch (error) {
    console.error('Error sending invoice:', error)
    return NextResponse.json({ error: 'Failed to send invoice' }, { status: 500 })
  }
}
