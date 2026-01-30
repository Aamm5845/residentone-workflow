import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateFinancialInsights } from '@/lib/openai-service'

// GET - Get AI-powered financial insights
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    // Get transactions from the last 2 months
    const twoMonthsAgo = new Date()
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        date: { gte: twoMonthsAgo },
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

    // Calculate totals for last month
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const lastMonthTxns = transactions.filter(t => t.date >= oneMonthAgo)

    let totalIncome = 0
    let totalExpenses = 0
    const categoryTotals: Record<string, number> = {}

    for (const txn of lastMonthTxns) {
      const amount = Number(txn.amount)
      if (amount < 0) {
        totalIncome += Math.abs(amount)
      } else {
        totalExpenses += amount
        const cat = txn.aiCategory || 'Other'
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amount
      }
    }

    // Get top categories
    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount }))

    // Detect recurring charges (simplified - group by merchant)
    const merchantCounts: Record<string, { count: number; total: number }> = {}
    for (const txn of transactions) {
      const key = (txn.merchantName || txn.name).toLowerCase()
      if (!merchantCounts[key]) merchantCounts[key] = { count: 0, total: 0 }
      merchantCounts[key].count++
      merchantCounts[key].total += Number(txn.amount)
    }

    const recurringCharges = Object.entries(merchantCounts)
      .filter(([, data]) => data.count >= 2 && data.total > 0)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        amount: data.total / data.count,
        frequency: 'monthly',
      }))

    // Generate AI insights
    const insights = await generateFinancialInsights({
      totalIncome,
      totalExpenses,
      topCategories,
      recurringCharges,
      upcomingBills: [], // Will be enhanced later
    })

    // Sort by priority
    insights.sort((a, b) => a.priority - b.priority)

    return NextResponse.json({
      insights,
      summary: {
        totalIncome,
        totalExpenses,
        netCashflow: totalIncome - totalExpenses,
        topCategories,
        transactionCount: lastMonthTxns.length,
      },
    })
  } catch (error: any) {
    console.error('Insights error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
