import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// POST - Update transaction category manually (AI will learn from this)
export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { transactionId, category, isBusinessExpense } = await request.json()

    if (!transactionId || !category) {
      return NextResponse.json({ error: 'Transaction ID and category required' }, { status: 400 })
    }

    // Get the transaction to verify ownership
    const transaction = await prisma.bankTransaction.findFirst({
      where: {
        id: transactionId,
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
      },
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Update the transaction
    const updated = await prisma.bankTransaction.update({
      where: { id: transactionId },
      data: {
        aiCategory: category,
        isBusinessExpense: isBusinessExpense ?? transaction.isBusinessExpense,
        aiCategorizedAt: new Date(),
      },
    })

    // Store the manual override for AI learning
    // Find similar transactions (same merchant) and offer to update them too
    const merchantName = transaction.merchantName || transaction.name
    const similarCount = await prisma.bankTransaction.count({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        OR: [
          { merchantName: { equals: merchantName, mode: 'insensitive' } },
          { name: { contains: merchantName.split(' ')[0], mode: 'insensitive' } },
        ],
        id: { not: transactionId },
        aiCategory: { not: category },
      },
    })

    return NextResponse.json({
      success: true,
      transaction: {
        id: updated.id,
        aiCategory: updated.aiCategory,
        isBusinessExpense: updated.isBusinessExpense,
      },
      similarCount, // Number of similar transactions that could be updated
    })
  } catch (error: any) {
    console.error('Update category error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update category' },
      { status: 500 }
    )
  }
}

// PUT - Batch update similar transactions to same category
export async function PUT(request: Request) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const { merchantName, category, isBusinessExpense } = await request.json()

    if (!merchantName || !category) {
      return NextResponse.json({ error: 'Merchant name and category required' }, { status: 400 })
    }

    // Update all transactions with this merchant
    const result = await prisma.bankTransaction.updateMany({
      where: {
        bankAccount: {
          plaidItem: {
            orgId: session.user.orgId,
          },
        },
        OR: [
          { merchantName: { equals: merchantName, mode: 'insensitive' } },
          { name: { contains: merchantName.split(' ')[0], mode: 'insensitive' } },
        ],
      },
      data: {
        aiCategory: category,
        isBusinessExpense: isBusinessExpense ?? false,
        aiCategorizedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      updated: result.count,
    })
  } catch (error: any) {
    console.error('Batch update category error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to batch update' },
      { status: 500 }
    )
  }
}
