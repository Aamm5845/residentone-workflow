import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getClientBaseUrl } from '@/lib/get-base-url'
import { wrapEmailHtml } from '@/lib/meeting-emails'

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

    // Build email body (matching meeting email style)
    const validUntilStr = proposal.validUntil
      ? new Date(proposal.validUntil).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : ''

    const body = `
      <p style="font-size: 16px; color: #1e293b; margin: 0 0 6px; font-weight: 600;">Hi ${proposal.clientName},</p>
      <p style="font-size: 15px; color: #475569; margin: 0 0 20px; line-height: 1.6;">
        Thank you for choosing <strong style="color: #1e293b;">${companyName}</strong> — we've put together a design proposal for <strong style="color: #1e293b;">${proposal.project.name}</strong>. Please take a moment to review the details.
      </p>

      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin: 20px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #1e293b;">${proposal.title}</p>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 100px; vertical-align: top;">Proposal</td>
            <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${proposal.proposalNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">Project</td>
            <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${proposal.project.name}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">Prepared for</td>
            <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${proposal.clientName}</td>
          </tr>
          ${validUntilStr ? `
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">Valid until</td>
            <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${validUntilStr}</td>
          </tr>` : ''}
        </table>
      </div>

      <div style="text-align: center; margin: 24px 0 4px;">
        <a href="${proposalUrl}"
           style="display: inline-block; background: #1e293b; color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.01em;">
          View & Sign Proposal
        </a>
      </div>

      <p style="font-size: 13px; color: #94a3b8; margin: 16px 0 0; line-height: 1.5; text-align: center;">
        If you have any questions, don't hesitate to reach out — we're happy to walk you through everything.
      </p>`

    const html = wrapEmailHtml(body, 'Design Proposal', `Proposal from ${companyName}`)

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
