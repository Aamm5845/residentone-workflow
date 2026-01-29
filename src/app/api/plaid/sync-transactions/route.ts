import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getTransactions } from '@/lib/plaid-service'
import { categorizeTransactions } from '@/lib/openai-service'

// POST - Sync transactions from Plaid, store in database, and auto-categorize
export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { days = 90 } = await request.json().catch(() => ({}))

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

    let syncedCount = 0
    let newCount = 0
    const newTransactionIds: string[] = []

    for (const item of plaidItems) {
      try {
        const { transactions } = await getTransactions(
          item.accessToken,
          startDateStr,
          endDateStr
        )

        for (const txn of transactions) {
          // Find the bank account
          const bankAccount = item.bankAccounts.find(
            (acc) => acc.accountId === txn.account_id
          )

          if (!bankAccount) continue

          // Check if transaction already exists
          const existing = await prisma.bankTransaction.findUnique({
            where: { transactionId: txn.transaction_id },
          })

          if (existing) {
            // Update existing
            await prisma.bankTransaction.update({
              where: { transactionId: txn.transaction_id },
              data: {
                amount: txn.amount,
                name: txn.name,
                merchantName: txn.merchant_name,
                category: txn.category || [],
                pending: txn.pending,
                paymentChannel: txn.payment_channel,
              },
            })
            syncedCount++
          } else {
            // Create new
            const newTxn = await prisma.bankTransaction.create({
              data: {
                bankAccountId: bankAccount.id,
                transactionId: txn.transaction_id,
                amount: txn.amount,
                date: new Date(txn.date),
                name: txn.name,
                merchantName: txn.merchant_name,
                category: txn.category || [],
                pending: txn.pending,
                paymentChannel: txn.payment_channel,
              },
            })
            syncedCount++
            newCount++
            newTransactionIds.push(newTxn.id)
          }
        }

        // Update last synced time
        await prisma.plaidItem.update({
          where: { id: item.id },
          data: { lastSyncedAt: new Date() },
        })
      } catch (error: any) {
        console.error(`Failed to sync transactions for item ${item.id}:`, error.message)
      }
    }

    // Auto-categorize new transactions with AI
    let categorizedCount = 0
    if (newTransactionIds.length > 0 && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
      try {
        const uncategorized = await prisma.bankTransaction.findMany({
          where: {
            id: { in: newTransactionIds },
            aiCategory: null,
          },
          select: {
            id: true,
            name: true,
            merchantName: true,
            amount: true,
            category: true,
          },
        })

        if (uncategorized.length > 0) {
          const categorized = await categorizeTransactions(
            uncategorized.map((t) => ({
              id: t.id,
              name: t.name,
              merchantName: t.merchantName,
              amount: Number(t.amount),
              plaidCategories: t.category,
            }))
          )

          for (const cat of categorized) {
            await prisma.bankTransaction.update({
              where: { id: cat.id },
              data: {
                aiCategory: cat.aiCategory,
                aiSubCategory: cat.aiSubCategory,
                isBusinessExpense: cat.isBusinessExpense,
                aiCategorizedAt: new Date(),
              },
            })
            categorizedCount++
          }
        }
      } catch (error: any) {
        console.error('Auto-categorization failed:', error.message)
        // Continue anyway - transactions are synced, just not categorized
      }
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      new: newCount,
      categorized: categorizedCount,
      dateRange: { start: startDateStr, end: endDateStr },
    })
  } catch (error: any) {
    console.error('Sync transactions error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to sync transactions' },
      { status: 500 }
    )
  }
}
