import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/budget-quotes/public/[token]
 * Public endpoint - Get budget quote data for client portal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const budgetQuote = await prisma.budgetQuote.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        org: {
          select: {
            id: true,
            name: true,
            logoUrl: true
          }
        }
      }
    })

    if (!budgetQuote) {
      return NextResponse.json({ error: 'Budget quote not found' }, { status: 404 })
    }

    // Fetch item details with quantity and pricing info
    const items = await prisma.roomFFEItem.findMany({
      where: {
        id: { in: budgetQuote.itemIds }
      },
      select: {
        id: true,
        name: true,
        quantity: true,
        rrp: true,
        rrpCurrency: true,
        thumbnailUrl: true,
        images: true,
        section: {
          select: {
            name: true
          }
        }
      }
    })

    // Calculate USD total from items with USD currency
    const usdTotal = items
      .filter(item => item.rrpCurrency === 'USD' && item.rrp)
      .reduce((sum, item) => sum + (parseFloat(item.rrp?.toString() || '0') * (item.quantity || 1)), 0)

    // Transform items for client view (include price for section totals)
    const clientItems = items.map(item => {
      // Safely get first image from images array
      let thumbnail = item.thumbnailUrl || null
      if (!thumbnail && item.images && Array.isArray(item.images) && item.images.length > 0) {
        thumbnail = item.images[0] as string
      }
      return {
        id: item.id,
        name: item.name,
        quantity: item.quantity || 1,
        price: item.rrp ? parseFloat(item.rrp.toString()) : null,
        currency: item.rrpCurrency || 'CAD',
        thumbnail,
        categoryName: item.section?.name || 'Items'
      }
    })

    // Return client-safe data
    return NextResponse.json({
      id: budgetQuote.id,
      title: budgetQuote.title,
      description: budgetQuote.description,
      projectName: budgetQuote.project.name,
      clientName: budgetQuote.clientEmail?.split('@')[0] || 'Client',
      companyName: budgetQuote.org.name,
      companyLogo: budgetQuote.org.logoUrl,
      estimatedTotal: parseFloat(budgetQuote.estimatedTotal.toString()),
      estimatedTotalUSD: usdTotal > 0 ? usdTotal : null,
      currency: budgetQuote.currency,
      includeTax: budgetQuote.includeTax,
      includedServices: budgetQuote.includedServices || [],
      status: budgetQuote.status,
      expiresAt: budgetQuote.expiresAt?.toISOString() || null,
      clientApproved: budgetQuote.clientApproved,
      clientApprovedAt: budgetQuote.clientApprovedAt?.toISOString() || null,
      clientQuestion: budgetQuote.clientQuestion,
      items: clientItems
    })

  } catch (error) {
    console.error('Error fetching budget quote:', error)
    return NextResponse.json(
      { error: 'Failed to fetch budget quote' },
      { status: 500 }
    )
  }
}
