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

    // Get proposal with organization info
    const proposal = await prisma.proposal.findFirst({
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

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Cannot send already signed/declined proposals
    if (['SIGNED', 'DECLINED'].includes(proposal.status)) {
      return NextResponse.json({
        error: `Cannot send a proposal that has been ${proposal.status.toLowerCase()}`
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
    const proposalUrl = `${baseUrl}/client/proposal/${proposal.accessToken}`

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
      }).format(amount)
    }

    // Build email HTML
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Proposal from ${companyName}</title>
          <style>
            .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .header { background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; background-color: #f8fafc; }
            .proposal-box {
              background-color: white;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 24px;
              margin: 20px 0;
            }
            .proposal-number {
              font-family: monospace;
              color: #64748b;
              font-size: 14px;
              margin-bottom: 8px;
            }
            .proposal-title {
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
                Hi ${proposal.clientName},
              </p>
              <p style="color: #475569; line-height: 1.6;">
                Please find attached our proposal for <strong>${proposal.project.name}</strong>.
              </p>

              <div class="proposal-box">
                <div class="proposal-number">${proposal.proposalNumber}</div>
                <div class="proposal-title">${proposal.title}</div>

                <div class="amount-box">
                  <div class="amount-label">Total Amount</div>
                  <div class="amount-value">${formatCurrency(Number(proposal.totalAmount))}</div>
                </div>

                ${proposal.validUntil ? `
                  <p style="color: #64748b; font-size: 14px; text-align: center;">
                    Valid until ${new Date(proposal.validUntil).toLocaleDateString('en-CA', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                ` : ''}
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${proposalUrl}" class="button">View & Sign Proposal</a>
              </div>

              <p style="color: #64748b; font-size: 14px; text-align: center;">
                Click the button above to view the full proposal details and sign electronically.
              </p>
            </div>
            <div class="footer">
              <p>This proposal was sent by ${companyName}</p>
              ${org?.businessEmail ? `<p>Contact: <a href="mailto:${org.businessEmail}">${org.businessEmail}</a></p>` : ''}
              <p style="margin-top: 12px;">
                <a href="${proposalUrl}">View proposal online</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `

    // Send email
    const emailSent = await sendEmail({
      to: proposal.clientEmail,
      subject: `Proposal ${proposal.proposalNumber} from ${companyName}`,
      html,
    })

    if (!emailSent) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    // Update proposal status
    await prisma.proposal.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    })

    // Log activity
    await prisma.proposalActivity.create({
      data: {
        proposalId: id,
        type: 'SENT',
        message: `Proposal sent to ${proposal.clientEmail}`,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Proposal sent to ${proposal.clientEmail}`,
    })
  } catch (error) {
    console.error('Error sending proposal:', error)
    return NextResponse.json({ error: 'Failed to send proposal' }, { status: 500 })
  }
}
