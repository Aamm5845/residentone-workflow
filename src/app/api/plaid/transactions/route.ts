import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getTransactions } from '@/lib/plaid-service'

// GET - Fetch transactions for all connected accounts
export async function GET(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only OWNER can access financial features
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    // Get all active Plaid items
    const plaidItems = await prisma.plaidItem.findMany({
      where: {
        orgId: session.user.orgId,
        status: 'ACTIVE',
      },
      include: {
        bankAccounts: {
          where: { isActive: true },
        },
      },
    })

    if (plaidItems.length === 0) {
      return NextResponse.json({ transactions: [], message: 'No connected bank accounts' })
    }

    // Fetch transactions from all items
    const allTransactions: any[] = []

    for (const item of plaidItems) {
      try {
        const { transactions } = await getTransactions(
          item.accessToken,
          startDateStr,
          endDateStr
        )

        // Add institution info to each transaction
        const enrichedTransactions = transactions.map((txn) => {
          const account = item.bankAccounts.find(
            (acc) => acc.accountId === txn.account_id
          )
          return {
            id: txn.transaction_id,
            accountId: txn.account_id,
            accountName: account?.name || 'Unknown Account',
            accountMask: account?.mask,
            institutionName: item.institutionName,
            amount: txn.amount,
            date: txn.date,
            name: txn.name,
            merchantName: txn.merchant_name,
            category: txn.category,
            pending: txn.pending,
            paymentChannel: txn.payment_channel,
            isoCurrencyCode: txn.iso_currency_code || 'CAD',
          }
        })

        allTransactions.push(...enrichedTransactions)
      } catch (error: any) {
        console.error(`Failed to fetch transactions for item ${item.id}:`, error.message)
        // Continue with other items
      }
    }

    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      transactions: allTransactions,
      dateRange: {
        start: startDateStr,
        end: endDateStr,
      },
      count: allTransactions.length,
    })
  } catch (error: any) {
    console.error('Get transactions error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get transactions' },
      { status: 500 }
    )
  }
}
