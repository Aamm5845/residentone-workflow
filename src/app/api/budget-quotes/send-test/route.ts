import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { generateBudgetQuoteEmailTemplate } from '@/lib/email-templates'
import { getBaseUrl } from '@/lib/get-base-url'

export const dynamic = 'force-dynamic'

/**
 * POST /api/budget-quotes/send-test
 * Create a real budget quote and send to test email - works exactly like client would see
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id
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

    // Calculate expiry date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 30))

    // Create a real budget quote in database
    const budgetQuote = await prisma.budgetQuote.create({
      data: {
        orgId,
        projectId,
        title: title || 'Budget Approval',
        description: description || null,
        itemIds: itemIds || [],
        supplierQuoteIds: [],
        estimatedTotal: estimatedTotal || 0,
        markupPercent: null,
        currency: 'CAD',
        includeTax: includeTax ?? true,
        includedServices: [],
        clientEmail: testEmail,
        expiresAt,
        status: 'SENT',
        sentAt: new Date(),
        sentToEmail: testEmail,
        createdById: userId
      }
    })

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

    // Build portal URL with real token
    const baseUrl = getBaseUrl()
    const portalUrl = `${baseUrl}/budget-quote/${budgetQuote.token}`

    // Generate email - exactly like client would see
    const companyName = project.organization?.businessName || project.organization?.name || 'Company'
    const { subject: emailSubject, html: emailHtml } = generateBudgetQuoteEmailTemplate({
      budgetQuoteNumber: `BQ-${budgetQuote.id.slice(-6).toUpperCase()}`,
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
      portalUrl
    })

    // Send email - no test banner, exactly like client sees
    await sendEmail({
      to: testEmail,
      subject: emailSubject,
      html: emailHtml
    })

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      budgetQuoteId: budgetQuote.id,
      portalUrl
    })
  } catch (error) {
    console.error('Error sending test budget quote email:', error)
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    )
  }
}
