import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  parseNBCCanadaCSV,
  matchTransactionsWithPayments,
  generateReconciliationSummary,
  ReconciliationMatch
} from '@/lib/bank-reconciliation'

export const dynamic = 'force-dynamic'

/**
 * POST /api/payments/reconcile
 * Import bank CSV and match with payments
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const action = formData.get('action') as string || 'preview'
    const matchesToApply = formData.get('matches') as string | null

    if (!file && action === 'preview') {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
    }

    if (action === 'apply' && matchesToApply) {
      // Apply reconciliation matches
      const matches = JSON.parse(matchesToApply) as {
        paymentId: string
        transactionDate: string
        transactionAmount: number
        transactionDescription: string
      }[]

      const userId = session.user.id
      const results: { paymentId: string; success: boolean; error?: string }[] = []

      for (const match of matches) {
        try {
          // Verify payment belongs to org
          const payment = await prisma.payment.findFirst({
            where: { id: match.paymentId, orgId }
          })

          if (!payment) {
            results.push({ paymentId: match.paymentId, success: false, error: 'Payment not found' })
            continue
          }

          if (payment.reconciled) {
            results.push({ paymentId: match.paymentId, success: false, error: 'Already reconciled' })
            continue
          }

          // Update payment as reconciled
          await prisma.payment.update({
            where: { id: match.paymentId },
            data: {
              reconciled: true,
              reconciledAt: new Date(),
              reconciledById: userId,
              reconciledNotes: `Bank transaction: ${match.transactionDate} - ${match.transactionDescription} - $${match.transactionAmount.toFixed(2)}`
            }
          })

          // Log activity
          await prisma.clientQuoteActivity.create({
            data: {
              clientQuoteId: payment.clientQuoteId,
              type: 'PAYMENT_RECONCILED',
              message: `Payment reconciled with bank transaction`,
              userId
            }
          })

          results.push({ paymentId: match.paymentId, success: true })
        } catch (error) {
          results.push({
            paymentId: match.paymentId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      return NextResponse.json({
        success: true,
        applied: successCount,
        failed: results.length - successCount,
        results
      })
    }

    // Preview mode - parse CSV and match
    if (!file) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
    }

    const csvContent = await file.text()

    // Parse bank transactions
    let transactions
    try {
      transactions = parseNBCCanadaCSV(csvContent)
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Failed to parse CSV'
      }, { status: 400 })
    }

    if (transactions.length === 0) {
      return NextResponse.json({
        error: 'No valid transactions found in CSV'
      }, { status: 400 })
    }

    // Get unreconciled payments from the last 90 days
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const payments = await prisma.payment.findMany({
      where: {
        orgId,
        status: 'PAID',
        reconciled: false,
        paidAt: { gte: ninetyDaysAgo }
      },
      include: {
        clientQuote: {
          select: {
            quoteNumber: true
          }
        }
      }
    })

    // Match transactions with payments
    const matches = matchTransactionsWithPayments(
      transactions,
      payments.map(p => ({
        id: p.id,
        amount: parseFloat(p.amount.toString()),
        clientQuoteId: p.clientQuoteId,
        quoteNumber: p.clientQuote.quoteNumber,
        method: p.method,
        paidAt: p.paidAt,
        checkNumber: p.checkNumber || undefined,
        wireReference: p.wireReference || undefined
      }))
    )

    // Generate summary
    const summary = generateReconciliationSummary(matches)

    // Format response
    return NextResponse.json({
      success: true,
      summary,
      transactions: transactions.map(t => ({
        date: t.date.toISOString(),
        description: t.description,
        amount: t.amount,
        type: t.type,
        reference: t.reference
      })),
      matches: matches.map(m => ({
        transaction: {
          date: m.transaction.date.toISOString(),
          description: m.transaction.description,
          amount: m.transaction.amount,
          reference: m.transaction.reference
        },
        payment: m.payment ? {
          id: m.payment.id,
          amount: m.payment.amount,
          quoteNumber: m.payment.quoteNumber,
          method: m.payment.method,
          paidAt: m.payment.paidAt?.toISOString()
        } : null,
        matchConfidence: m.matchConfidence,
        matchReason: m.matchReason
      })),
      unreconciledPayments: payments.length - matches.filter(m => m.matchConfidence === 'high').length
    })
  } catch (error) {
    console.error('[Reconciliation] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process reconciliation' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/payments/reconcile
 * Get reconciliation status and unreconciled payments
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const [reconciled, unreconciled, recentReconciliations] = await Promise.all([
      // Count reconciled payments
      prisma.payment.count({
        where: {
          orgId,
          status: 'PAID',
          reconciled: true,
          paidAt: { gte: startDate }
        }
      }),

      // Get unreconciled payments
      prisma.payment.findMany({
        where: {
          orgId,
          status: 'PAID',
          reconciled: false,
          paidAt: { gte: startDate }
        },
        include: {
          clientQuote: {
            select: {
              quoteNumber: true,
              title: true,
              project: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: { paidAt: 'desc' }
      }),

      // Get recent reconciliations
      prisma.payment.findMany({
        where: {
          orgId,
          reconciled: true,
          reconciledAt: { gte: startDate }
        },
        include: {
          clientQuote: {
            select: { quoteNumber: true }
          },
          reconciledBy: {
            select: { name: true }
          }
        },
        orderBy: { reconciledAt: 'desc' },
        take: 20
      })
    ])

    const totalUnreconciledAmount = unreconciled.reduce(
      (sum, p) => sum + parseFloat(p.amount.toString()),
      0
    )

    return NextResponse.json({
      summary: {
        reconciled,
        unreconciled: unreconciled.length,
        totalUnreconciledAmount,
        periodDays: days
      },
      unreconciledPayments: unreconciled.map(p => ({
        id: p.id,
        amount: parseFloat(p.amount.toString()),
        method: p.method,
        paidAt: p.paidAt,
        checkNumber: p.checkNumber,
        wireReference: p.wireReference,
        quote: {
          number: p.clientQuote.quoteNumber,
          title: p.clientQuote.title,
          project: p.clientQuote.project.name
        }
      })),
      recentReconciliations: recentReconciliations.map(p => ({
        id: p.id,
        amount: parseFloat(p.amount.toString()),
        quoteNumber: p.clientQuote.quoteNumber,
        reconciledAt: p.reconciledAt,
        reconciledBy: p.reconciledBy?.name,
        notes: p.reconciledNotes
      }))
    })
  } catch (error) {
    console.error('[Reconciliation] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get reconciliation status' },
      { status: 500 }
    )
  }
}
