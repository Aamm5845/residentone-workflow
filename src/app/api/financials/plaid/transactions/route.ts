import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getPlaidClient } from '@/lib/plaid'
import type { BankTransaction } from '@/lib/bank-reconciliation'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, canSeeFinancials: true, orgId: true },
    })

    if (user?.role !== 'OWNER' && !user?.canSeeFinancials) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!user.orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    // Get active Plaid connection
    const connection = await prisma.plaidConnection.findFirst({
      where: {
        orgId: user.orgId,
        status: 'ACTIVE',
      },
    })

    if (!connection) {
      return NextResponse.json({
        transactions: [],
        hasConnection: false,
        message: 'No bank connected',
      })
    }

    const client = getPlaidClient()

    // Use transactionsSync with cursor for incremental updates
    let cursor = connection.transactionsCursor || undefined
    const allTransactions: BankTransaction[] = []
    let hasMore = true

    while (hasMore) {
      const response = await client.transactionsSync({
        access_token: connection.accessToken,
        cursor,
        count: 500,
      })

      const { added, next_cursor, has_more } = response.data

      for (const t of added) {
        allTransactions.push({
          date: new Date(t.date),
          description: t.name || t.merchant_name || '',
          amount: Math.abs(t.amount),
          reference: t.payment_meta?.reference_number || undefined,
          type: t.amount < 0 ? 'credit' : 'debit', // Plaid: negative = money in
          balance: undefined,
          rawData: {
            plaidId: t.transaction_id,
            category: (t.category || []).join(', '),
            merchantName: t.merchant_name || '',
          },
        })
      }

      cursor = next_cursor
      hasMore = has_more
    }

    // Update cursor and last synced time
    await prisma.plaidConnection.update({
      where: { id: connection.id },
      data: {
        transactionsCursor: cursor,
        lastSyncedAt: new Date(),
      },
    })

    return NextResponse.json({
      transactions: allTransactions,
      hasConnection: true,
      institutionName: connection.institutionName,
      lastSyncedAt: connection.lastSyncedAt,
      accounts: connection.accounts,
    })
  } catch (error) {
    console.error('Error fetching Plaid transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
