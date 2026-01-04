import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/budget-quotes/public/[token]/view
 * Mark budget quote as viewed by client
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const budgetQuote = await prisma.budgetQuote.findUnique({
      where: { token }
    })

    if (!budgetQuote) {
      return NextResponse.json({ error: 'Budget quote not found' }, { status: 404 })
    }

    // Only update if not already viewed
    if (budgetQuote.status === 'SENT') {
      await prisma.budgetQuote.update({
        where: { token },
        data: {
          status: 'VIEWED',
          viewedAt: new Date()
        }
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error marking budget quote as viewed:', error)
    return NextResponse.json(
      { error: 'Failed to update budget quote' },
      { status: 500 }
    )
  }
}
