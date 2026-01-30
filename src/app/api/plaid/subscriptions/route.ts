import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { detectSubscriptions } from '@/lib/openai-service'

// GET - Detect subscriptions from transaction history
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    // Get transactions from the last 6 months
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        date: { gte: sixMonthsAgo },
        amount: { gt: 0 }, // Only expenses
      },
      select: {
        merchantName: true,
        name: true,
        amount: true,
        date: true,
        aiCategory: true,
      },
      orderBy: { date: 'desc' },
    })

    // Convert for subscription detection
    const txnData = transactions.map(t => ({
      merchantName: t.merchantName,
      name: t.name,
      amount: Number(t.amount),
      date: t.date,
    }))

    const subscriptions = await detectSubscriptions(txnData)

    // Sort by next expected date
    subscriptions.sort((a, b) => a.nextExpected.getTime() - b.nextExpected.getTime())

    // Calculate totals
    const monthlyTotal = subscriptions
      .filter(s => s.frequency === 'monthly')
      .reduce((sum, s) => sum + s.amount, 0)

    const yearlyTotal = subscriptions
      .filter(s => s.frequency === 'yearly')
      .reduce((sum, s) => sum + s.amount, 0)

    const nonEssentialMonthly = subscriptions
      .filter(s => !s.isEssential && s.frequency === 'monthly')
      .reduce((sum, s) => sum + s.amount, 0)

    return NextResponse.json({
      subscriptions,
      summary: {
        total: subscriptions.length,
        monthlyTotal,
        yearlyTotal,
        annualCost: monthlyTotal * 12 + yearlyTotal,
        potentialSavings: nonEssentialMonthly * 12,
        essentialCount: subscriptions.filter(s => s.isEssential).length,
        nonEssentialCount: subscriptions.filter(s => !s.isEssential).length,
      },
    })
  } catch (error: any) {
    console.error('Subscription detection error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to detect subscriptions' },
      { status: 500 }
    )
  }
}
