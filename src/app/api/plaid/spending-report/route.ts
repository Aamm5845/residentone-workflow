import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { SPENDING_CATEGORIES } from '@/lib/openai-service'

// GET - Get spending report by category
export async function GET(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || 'month' // week, month, year

    // Calculate date range based on period
    const end = endDate ? new Date(endDate) : new Date()
    let start: Date

    if (startDate) {
      start = new Date(startDate)
    } else {
      start = new Date(end)
      switch (period) {
        case 'week':
          start.setDate(start.getDate() - 7)
          break
        case 'year':
          start.setFullYear(start.getFullYear() - 1)
          break
        case 'month':
        default:
          start.setMonth(start.getMonth() - 1)
      }
    }

    // Get all transactions in date range (expenses only - positive amounts)
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        date: {
          gte: start,
          lte: end,
        },
        amount: { gt: 0 }, // Expenses only
      },
      select: {
        amount: true,
        aiCategory: true,
        date: true,
        isBusinessExpense: true,
      },
    })

    // Calculate totals by category
    const categoryTotals: Record<string, number> = {}
    let totalExpenses = 0
    let businessExpenses = 0

    for (const t of transactions) {
      const amount = Number(t.amount)
      const category = t.aiCategory || 'Uncategorized'

      categoryTotals[category] = (categoryTotals[category] || 0) + amount
      totalExpenses += amount

      if (t.isBusinessExpense) {
        businessExpenses += amount
      }
    }

    // Sort categories by amount
    const sortedCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
        transactionCount: transactions.filter(
          (t) => (t.aiCategory || 'Uncategorized') === category
        ).length,
      }))
      .sort((a, b) => b.amount - a.amount)

    // Get income for the period
    const incomeTransactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        date: {
          gte: start,
          lte: end,
        },
        amount: { lt: 0 }, // Income (negative amounts in Plaid)
      },
      select: {
        amount: true,
      },
    })

    const totalIncome = incomeTransactions.reduce(
      (sum, t) => sum + Math.abs(Number(t.amount)),
      0
    )

    // Daily spending trend
    const dailySpending: Record<string, number> = {}
    for (const t of transactions) {
      const dateKey = t.date.toISOString().split('T')[0]
      dailySpending[dateKey] = (dailySpending[dateKey] || 0) + Number(t.amount)
    }

    const spendingTrend = Object.entries(dailySpending)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        totalExpenses,
        totalIncome,
        netFlow: totalIncome - totalExpenses,
        businessExpenses,
        transactionCount: transactions.length,
      },
      byCategory: sortedCategories,
      spendingTrend,
      uncategorizedCount: transactions.filter((t) => !t.aiCategory).length,
    })
  } catch (error: any) {
    console.error('Spending report error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    )
  }
}
