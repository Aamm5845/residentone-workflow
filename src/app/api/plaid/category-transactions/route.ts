import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Get transactions for a specific category
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
    const category = searchParams.get('category')
    const month = searchParams.get('month') // Optional YYYY-MM format
    const months = parseInt(searchParams.get('months') || '12')

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }

    // Build date filter
    let startDate: Date
    let endDate: Date | undefined

    if (month) {
      // Specific month filter
      const [year, monthNum] = month.split('-').map(Number)
      startDate = new Date(year, monthNum - 1, 1)
      endDate = new Date(year, monthNum, 0, 23, 59, 59, 999) // Last day of month
    } else {
      // Past N months
      startDate = new Date()
      startDate.setMonth(startDate.getMonth() - months)
    }

    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        aiCategory: category === 'Uncategorized' ? null : category,
        date: endDate ? { gte: startDate, lte: endDate } : { gte: startDate },
        amount: { gt: 0 }, // Only expenses
      },
      orderBy: { date: 'desc' },
      take: 100,
      include: {
        bankAccount: {
          select: {
            name: true,
          },
        },
      },
    })

    // Also handle uncategorized
    let uncategorizedTransactions: typeof transactions = []
    if (category === 'Uncategorized') {
      uncategorizedTransactions = await prisma.bankTransaction.findMany({
        where: {
          bankAccount: {
            plaidItem: {
              orgId: session.user.orgId,
            },
          },
          aiCategory: null,
          date: endDate ? { gte: startDate, lte: endDate } : { gte: startDate },
          amount: { gt: 0 },
        },
        orderBy: { date: 'desc' },
        take: 100,
        include: {
          bankAccount: {
            select: {
              name: true,
            },
          },
        },
      })
    }

    const allTransactions = category === 'Uncategorized' ? uncategorizedTransactions : transactions

    const formattedTransactions = allTransactions.map((txn) => ({
      id: txn.id,
      date: txn.date.toISOString().split('T')[0],
      name: txn.merchantName || txn.name,
      amount: Number(txn.amount),
      category: txn.aiCategory || 'Uncategorized',
      accountName: txn.bankAccount.name,
      isBusinessExpense: txn.isBusinessExpense,
    }))

    const total = formattedTransactions.reduce((sum, txn) => sum + txn.amount, 0)

    return NextResponse.json({
      transactions: formattedTransactions,
      total,
      count: formattedTransactions.length,
    })
  } catch (error: any) {
    console.error('Category transactions error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}
