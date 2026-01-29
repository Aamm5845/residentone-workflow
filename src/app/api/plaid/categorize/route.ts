import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { categorizeTransactions } from '@/lib/openai-service'

// POST - Categorize uncategorized transactions using AI
export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { all = false } = await request.json().catch(() => ({}))

    // Get transactions that need categorization
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        ...(all ? {} : { aiCategory: null }),
      },
      select: {
        id: true,
        name: true,
        merchantName: true,
        amount: true,
        category: true,
      },
      take: 200, // Process up to 200 at a time
    })

    if (transactions.length === 0) {
      return NextResponse.json({
        success: true,
        categorized: 0,
        message: 'No transactions to categorize',
      })
    }

    // Categorize using AI
    const categorized = await categorizeTransactions(
      transactions.map((t) => ({
        id: t.id,
        name: t.name,
        merchantName: t.merchantName,
        amount: Number(t.amount),
        plaidCategories: t.category,
      }))
    )

    // Update transactions with AI categories
    let updatedCount = 0
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
      updatedCount++
    }

    return NextResponse.json({
      success: true,
      categorized: updatedCount,
      total: transactions.length,
    })
  } catch (error: any) {
    console.error('Categorize transactions error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to categorize transactions' },
      { status: 500 }
    )
  }
}
