import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { generateBudgetQuoteEmailTemplate } from '@/lib/email-templates'
import { getBaseUrl } from '@/lib/get-base-url'

export const dynamic = 'force-dynamic'

/**
 * POST /api/budget-quotes/[id]/send
 * Send budget quote to client via email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Verify budget quote exists and belongs to org
    const budgetQuote = await prisma.budgetQuote.findFirst({
      where: { id, orgId },
      include: {
        project: {
          select: { id: true, name: true }
        },
        org: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            businessName: true
          }
        }
      }
    })

    if (!budgetQuote) {
      return NextResponse.json({ error: 'Budget quote not found' }, { status: 404 })
    }

    // Fetch item details
    const items = await prisma.roomFFEItem.findMany({
      where: {
        id: { in: budgetQuote.itemIds }
      },
      select: {
        id: true,
        name: true,
        section: {
          select: { name: true }
        }
      }
    })

    // Get client name from email
    const clientName = email.split('@')[0].replace(/[._-]/g, ' ')
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    // Build portal URL
    const baseUrl = getBaseUrl()
    const portalUrl = `${baseUrl}/budget-quote/${budgetQuote.token}`

    // Generate email
    const companyName = budgetQuote.org.businessName || budgetQuote.org.name
    const emailHtml = generateBudgetQuoteEmailTemplate({
      budgetQuoteNumber: `BQ-${budgetQuote.id.slice(-6).toUpperCase()}`,
      clientName,
      projectName: budgetQuote.project.name,
      companyName,
      companyLogo: budgetQuote.org.logoUrl || undefined,
      title: budgetQuote.title,
      items: items.map(item => ({
        name: item.name,
        categoryName: item.section?.name
      })),
      estimatedTotal: parseFloat(budgetQuote.estimatedTotal.toString()),
      includeTax: budgetQuote.includeTax,
      includedServices: budgetQuote.includedServices || [],
      validUntil: budgetQuote.expiresAt,
      portalUrl
    })

    // Send email
    await sendEmail({
      to: email,
      subject: `Budget Estimate: ${budgetQuote.title} - ${budgetQuote.project.name}`,
      html: emailHtml
    })

    // Update budget quote
    const updated = await prisma.budgetQuote.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentToEmail: email,
        clientEmail: email
      }
    })

    // Update items to BUDGET_SENT status
    if (budgetQuote.itemIds.length > 0) {
      await prisma.roomFFEItem.updateMany({
        where: {
          id: { in: budgetQuote.itemIds }
        },
        data: {
          status: 'BUDGET_SENT'
        }
      })
    }

    return NextResponse.json({
      success: true,
      budgetQuote: updated,
      publicUrl: portalUrl
    })
  } catch (error) {
    console.error('Error sending budget quote:', error)
    return NextResponse.json(
      { error: 'Failed to send budget quote' },
      { status: 500 }
    )
  }
}
