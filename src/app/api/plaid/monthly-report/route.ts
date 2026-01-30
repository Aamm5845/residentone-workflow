import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Get monthly spending report
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
    const months = parseInt(searchParams.get('months') || '12')

    // Get transactions for the past N months
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        date: { gte: startDate },
      },
      select: {
        amount: true,
        date: true,
        aiCategory: true,
        isBusinessExpense: true,
      },
      orderBy: { date: 'asc' },
    })

    // Group by month
    const monthlyData: Record<string, {
      month: string
      totalExpenses: number
      totalIncome: number
      businessExpenses: number
      byCategory: Record<string, number>
    }> = {}

    for (const txn of transactions) {
      const monthKey = txn.date.toISOString().slice(0, 7) // YYYY-MM
      const amount = Number(txn.amount)
      const category = txn.aiCategory || 'Uncategorized'

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          totalExpenses: 0,
          totalIncome: 0,
          businessExpenses: 0,
          byCategory: {},
        }
      }

      if (amount > 0) {
        // Expense
        monthlyData[monthKey].totalExpenses += amount
        monthlyData[monthKey].byCategory[category] =
          (monthlyData[monthKey].byCategory[category] || 0) + amount
        if (txn.isBusinessExpense) {
          monthlyData[monthKey].businessExpenses += amount
        }
      } else {
        // Income
        monthlyData[monthKey].totalIncome += Math.abs(amount)
      }
    }

    // Convert to sorted array
    const monthlyReport = Object.values(monthlyData).sort((a, b) =>
      a.month.localeCompare(b.month)
    )

    // Calculate category totals across all months
    const categoryTotals: Record<string, number> = {}
    for (const month of monthlyReport) {
      for (const [cat, amount] of Object.entries(month.byCategory)) {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amount
      }
    }

    // Sort categories by total
    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([category, total]) => ({ category, total }))

    // Calculate totals
    const totals = monthlyReport.reduce(
      (acc, month) => ({
        totalExpenses: acc.totalExpenses + month.totalExpenses,
        totalIncome: acc.totalIncome + month.totalIncome,
        businessExpenses: acc.businessExpenses + month.businessExpenses,
      }),
      { totalExpenses: 0, totalIncome: 0, businessExpenses: 0 }
    )

    // Calculate averages
    const monthCount = monthlyReport.length || 1
    const averages = {
      monthlyExpenses: totals.totalExpenses / monthCount,
      monthlyIncome: totals.totalIncome / monthCount,
      monthlyBusinessExpenses: totals.businessExpenses / monthCount,
    }

    return NextResponse.json({
      months: monthlyReport,
      categories: sortedCategories,
      totals,
      averages,
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        monthCount,
      },
    })
  } catch (error: any) {
    console.error('Monthly report error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    )
  }
}
