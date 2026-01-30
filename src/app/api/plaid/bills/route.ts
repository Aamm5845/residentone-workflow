import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

interface BillPrediction {
  name: string
  amount: number
  dueDate: Date
  category: string
  isOverdue: boolean
  daysUntilDue: number
  lastPaid: Date | null
  frequency: 'weekly' | 'monthly' | 'yearly'
  confidence: 'high' | 'medium' | 'low'
}

// GET - Predict upcoming bills based on transaction history
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

    // Group by merchant and find patterns
    const merchantData: Record<string, {
      name: string
      amounts: number[]
      dates: Date[]
      category: string
    }> = {}

    for (const txn of transactions) {
      const key = (txn.merchantName || txn.name).toLowerCase().trim()
      if (!merchantData[key]) {
        merchantData[key] = {
          name: txn.merchantName || txn.name,
          amounts: [],
          dates: [],
          category: txn.aiCategory || 'Other',
        }
      }
      merchantData[key].amounts.push(Number(txn.amount))
      merchantData[key].dates.push(txn.date)
    }

    const now = new Date()
    const predictions: BillPrediction[] = []

    // Analyze each merchant for recurring patterns
    for (const [, data] of Object.entries(merchantData)) {
      if (data.dates.length < 2) continue

      // Sort dates descending
      const sortedDates = data.dates.sort((a, b) => b.getTime() - a.getTime())
      const lastPaid = sortedDates[0]

      // Calculate average gap between payments
      let totalGap = 0
      for (let i = 0; i < sortedDates.length - 1; i++) {
        totalGap += (sortedDates[i].getTime() - sortedDates[i + 1].getTime()) / (1000 * 60 * 60 * 24)
      }
      const avgGap = totalGap / (sortedDates.length - 1)

      // Determine frequency
      let frequency: 'weekly' | 'monthly' | 'yearly'
      let confidence: 'high' | 'medium' | 'low'

      if (avgGap < 10) {
        frequency = 'weekly'
        confidence = avgGap > 5 && avgGap < 9 ? 'high' : 'medium'
      } else if (avgGap > 25 && avgGap < 35) {
        frequency = 'monthly'
        confidence = avgGap > 27 && avgGap < 32 ? 'high' : 'medium'
      } else if (avgGap > 350 && avgGap < 380) {
        frequency = 'yearly'
        confidence = 'medium'
      } else {
        // Not a regular pattern
        continue
      }

      // Filter for bill-like categories
      const billCategories = ['Utilities', 'Insurance', 'Subscriptions', 'Professional Services', 'Healthcare']
      if (!billCategories.includes(data.category) && confidence !== 'high') {
        continue
      }

      // Calculate next due date
      const nextDue = new Date(lastPaid)
      if (frequency === 'weekly') nextDue.setDate(nextDue.getDate() + 7)
      else if (frequency === 'monthly') nextDue.setMonth(nextDue.getMonth() + 1)
      else nextDue.setFullYear(nextDue.getFullYear() + 1)

      // Calculate days until due
      const daysUntilDue = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const isOverdue = daysUntilDue < 0

      // Calculate average amount
      const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length

      // Only include bills that are due within the next 30 days or are overdue
      if (daysUntilDue <= 30) {
        predictions.push({
          name: data.name,
          amount: avgAmount,
          dueDate: nextDue,
          category: data.category,
          isOverdue,
          daysUntilDue,
          lastPaid,
          frequency,
          confidence,
        })
      }
    }

    // Sort by due date (overdue first, then upcoming)
    predictions.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue) return 1
      return a.daysUntilDue - b.daysUntilDue
    })

    // Calculate summary
    const overdueBills = predictions.filter(b => b.isOverdue)
    const upcomingBills = predictions.filter(b => !b.isOverdue)
    const dueSoon = upcomingBills.filter(b => b.daysUntilDue <= 7)

    return NextResponse.json({
      bills: predictions,
      summary: {
        totalBills: predictions.length,
        overdueCount: overdueBills.length,
        overdueAmount: overdueBills.reduce((sum, b) => sum + b.amount, 0),
        dueSoonCount: dueSoon.length,
        dueSoonAmount: dueSoon.reduce((sum, b) => sum + b.amount, 0),
        upcomingAmount: upcomingBills.reduce((sum, b) => sum + b.amount, 0),
      },
    })
  } catch (error: any) {
    console.error('Bills prediction error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to predict bills' },
      { status: 500 }
    )
  }
}
