import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { generateBudgetQuoteEmailTemplate } from '@/lib/email-templates'
import { getBaseUrl } from '@/lib/get-base-url'

export const dynamic = 'force-dynamic'

/**
 * POST /api/budget-quotes/send-test
 * Send a test budget quote email without creating the quote in DB
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const body = await request.json()
    const {
      testEmail,
      projectId,
      title,
      description,
      itemIds,
      estimatedTotal,
      estimatedTotalUSD,
      includeTax,
      expiresInDays
    } = body

    if (!testEmail) {
      return NextResponse.json({ error: 'Test email is required' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Get project and org info
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            businessName: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch item details
    const items = await prisma.roomFFEItem.findMany({
      where: {
        id: { in: itemIds || [] }
      },
      select: {
        id: true,
        name: true,
        section: {
          select: { name: true }
        }
      }
    })

    // Get client name from test email
    const clientName = testEmail.split('@')[0].replace(/[._-]/g, ' ')
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    // Generate a fake token for the test
    const fakeToken = 'TEST-' + Math.random().toString(36).substring(2, 10).toUpperCase()

    // Build portal URL (test URL that won't work)
    const baseUrl = getBaseUrl()
    const portalUrl = `${baseUrl}/budget-quote/${fakeToken}`

    // Calculate expiry date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 30))

    // Generate email
    const companyName = project.organization?.businessName || project.organization?.name || 'Company'
    const { subject: emailSubject, html: emailHtml } = generateBudgetQuoteEmailTemplate({
      budgetQuoteNumber: `BQ-TEST-${Date.now().toString(36).toUpperCase()}`,
      clientName,
      projectName: project.name,
      companyName,
      companyLogo: project.organization?.logoUrl || undefined,
      title: title || 'Budget Approval',
      items: items.map(item => ({
        name: item.name,
        categoryName: item.section?.name
      })),
      estimatedTotal: estimatedTotal || 0,
      estimatedTotalUSD: estimatedTotalUSD || undefined,
      includeTax: includeTax ?? true,
      includedServices: [],
      validUntil: expiresAt,
      portalUrl,
      isTest: true // Add test indicator
    })

    // Modify subject to indicate test
    const testSubject = `[TEST] ${emailSubject}`

    // Add test banner to email with the portal URL visible
    const testBanner = `
      <div style="background-color: #FEF3C7; border: 2px solid #F59E0B; padding: 12px; margin-bottom: 15px; border-radius: 6px; text-align: center;">
        <strong style="color: #92400E; font-size: 13px;">⚠️ TEST EMAIL - This is a preview</strong>
        <div style="margin-top: 8px; padding: 8px; background: white; border-radius: 4px;">
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Portal Link (for testing):</div>
          <a href="${portalUrl}" style="font-size: 12px; color: #1e40af; word-break: break-all;">${portalUrl}</a>
        </div>
      </div>
    `

    let testHtml = emailHtml.replace(
      /<body([^>]*)>/,
      `<body$1>${testBanner}`
    )

    // Send test email
    await sendEmail({
      to: testEmail,
      subject: testSubject,
      html: testHtml
    })

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${testEmail}`
    })
  } catch (error) {
    console.error('Error sending test budget quote email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}
