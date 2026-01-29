import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Get all transactions from database with filters
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
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const accountId = searchParams.get('accountId') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type') || 'all' // all, income, expense
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {
      bankAccount: {
        plaidItem: {
          orgId: session.user.orgId,
        },
      },
    }

    // Date filter
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { merchantName: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Category filter
    if (category) {
      where.aiCategory = category
    }

    // Account filter
    if (accountId) {
      where.bankAccount = {
        ...where.bankAccount,
        accountId: accountId,
      }
    }

    // Type filter (income vs expense)
    if (type === 'income') {
      where.amount = { lt: 0 } // Negative = money in (Plaid convention)
    } else if (type === 'expense') {
      where.amount = { gt: 0 } // Positive = money out
    }

    // Get transactions
    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        include: {
          bankAccount: {
            select: {
              name: true,
              mask: true,
              type: true,
              plaidItem: {
                select: {
                  institutionName: true,
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.bankTransaction.count({ where }),
    ])

    // Format response
    const formattedTransactions = transactions.map((t) => ({
      id: t.id,
      transactionId: t.transactionId,
      amount: Number(t.amount),
      date: t.date.toISOString(),
      name: t.name,
      merchantName: t.merchantName,
      category: t.category,
      aiCategory: t.aiCategory,
      aiSubCategory: t.aiSubCategory,
      isBusinessExpense: t.isBusinessExpense,
      pending: t.pending,
      paymentChannel: t.paymentChannel,
      accountName: t.bankAccount.name,
      accountMask: t.bankAccount.mask,
      accountType: t.bankAccount.type,
      institutionName: t.bankAccount.plaidItem.institutionName,
    }))

    return NextResponse.json({
      transactions: formattedTransactions,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    })
  } catch (error: any) {
    console.error('Get all transactions error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get transactions' },
      { status: 500 }
    )
  }
}
