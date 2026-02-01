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
  accountType?: 'credit_card' | 'loan' | 'line_of_credit' | 'bill'
  // Credit account specific fields
  currentBalance?: number
  creditLimit?: number | null
  rewardsProgram?: string | null
}

// GET - Predict upcoming bills based on transaction history AND credit accounts
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const now = new Date()
    const predictions: BillPrediction[] = []

    // =====================================================
    // PART 1: Get Credit Cards and Lines of Credit directly
    // These are monthly bills by nature!
    // =====================================================
    const creditAccounts = await prisma.bankAccount.findMany({
      where: {
        plaidItem: {
          orgId: session.user.orgId,
          status: 'ACTIVE',
        },
        isActive: true,
        type: {
          in: ['credit', 'loan'],
        },
      },
      select: {
        id: true,
        name: true,
        officialName: true,
        nickname: true,
        type: true,
        subtype: true,
        currentBalance: true,
        creditLimit: true,
        dueDay: true,
        minimumPayment: true,
        rewardsProgram: true,
        plaidItem: {
          select: {
            institutionName: true,
          },
        },
      },
    })

    for (const account of creditAccounts) {
      const balance = Number(account.currentBalance) || 0

      // Skip accounts with no balance (nothing owed)
      if (balance <= 0) continue

      // Determine account type
      const subtype = (account.subtype || '').toLowerCase()
      let accountType: 'credit_card' | 'loan' | 'line_of_credit' = 'credit_card'
      if (subtype.includes('line of credit') || subtype.includes('loc')) {
        accountType = 'line_of_credit'
      } else if (subtype.includes('loan') || subtype.includes('mortgage')) {
        accountType = 'loan'
      }

      // Skip large lines of credit (likely mortgages)
      if (accountType === 'line_of_credit' && balance > 100000) continue

      // Use actual dueDay from account if available, otherwise estimate
      const dueDay = account.dueDay || 15

      // Calculate the next due date based on the actual due day
      const dueDate = new Date(now)
      dueDate.setDate(dueDay)

      // If we're past the due day this month, set to next month
      if (now.getDate() > dueDay) {
        dueDate.setMonth(dueDate.getMonth() + 1)
      }

      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Build display name - prefer nickname if available
      const institutionName = account.plaidItem?.institutionName || ''
      const displayName = account.nickname || account.name || account.officialName ||
        `${institutionName} ${accountType === 'credit_card' ? 'Credit Card' : accountType === 'line_of_credit' ? 'Line of Credit' : 'Loan'}`

      // Use actual minimum payment if available, otherwise calculate estimate
      const minPayment = account.minimumPayment
        ? Number(account.minimumPayment)
        : Math.max(10, balance * 0.025)

      predictions.push({
        name: displayName,
        amount: minPayment,
        dueDate,
        category: accountType === 'credit_card' ? 'Credit Card' : accountType === 'line_of_credit' ? 'Line of Credit' : 'Loan',
        isOverdue: daysUntilDue < 0,
        daysUntilDue,
        lastPaid: null,
        frequency: 'monthly',
        confidence: 'high',
        accountType,
        // Include extra data for the calendar
        currentBalance: balance,
        creditLimit: account.creditLimit ? Number(account.creditLimit) : null,
        rewardsProgram: account.rewardsProgram,
      })
    }

    // =====================================================
    // PART 2: Detect recurring bills from transaction history
    // =====================================================
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
      } else if (avgGap > 20 && avgGap < 40) {
        // Widened range for monthly detection (was 25-35, now 20-40)
        frequency = 'monthly'
        confidence = avgGap > 27 && avgGap < 32 ? 'high' : 'medium'
      } else if (avgGap > 350 && avgGap < 380) {
        frequency = 'yearly'
        confidence = 'medium'
      } else {
        // Not a regular pattern
        continue
      }

      // Expanded bill-like categories - include more types
      const billCategories = [
        'Utilities', 'Insurance', 'Subscriptions', 'Professional Services',
        'Healthcare', 'Bank Fees', 'Transfer', 'Payment', 'Loan',
        'Telecommunications', 'Internet', 'Phone', 'Cable', 'Streaming',
        'Gym', 'Fitness', 'Rent', 'Mortgage'
      ]

      // Check if category matches OR if it's a high confidence recurring payment
      const isBillCategory = billCategories.some(cat =>
        data.category.toLowerCase().includes(cat.toLowerCase())
      )

      // Accept if it's a bill category, or if it's high confidence with 3+ occurrences
      if (!isBillCategory && !(confidence === 'high' && data.dates.length >= 3)) {
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

      // Include bills due within 45 days or overdue (was 30)
      if (daysUntilDue <= 45) {
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
          accountType: 'bill',
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
