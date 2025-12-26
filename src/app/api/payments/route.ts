import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/payments
 * Get all payments for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)

    const clientQuoteId = searchParams.get('clientQuoteId')
    const status = searchParams.get('status')
    const method = searchParams.get('method')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = { orgId }

    if (clientQuoteId) {
      where.clientQuoteId = clientQuoteId
    }

    if (status) {
      where.status = status
    }

    if (method) {
      where.method = method
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          clientQuote: {
            select: {
              id: true,
              quoteNumber: true,
              title: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  client: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          },
          createdBy: {
            select: { id: true, name: true }
          },
          confirmedBy: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.payment.count({ where })
    ])

    return NextResponse.json({
      payments,
      total,
      limit,
      offset
    })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/payments
 * Record a new payment
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      clientQuoteId,
      amount,
      method,
      paidAt,
      checkNumber,
      wireReference,
      notes
    } = body

    if (!clientQuoteId) {
      return NextResponse.json({ error: 'Client quote ID is required' }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    if (!method) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    // Verify client quote belongs to org
    const clientQuote = await prisma.clientQuote.findFirst({
      where: { id: clientQuoteId, orgId },
      include: {
        payments: true
      }
    })

    if (!clientQuote) {
      return NextResponse.json({ error: 'Client quote not found' }, { status: 404 })
    }

    // Calculate total already paid
    const totalPaid = clientQuote.payments
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)

    const quoteTotal = parseFloat(clientQuote.totalAmount?.toString() || clientQuote.subtotal?.toString() || '0')
    const newTotal = totalPaid + parseFloat(amount)

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        orgId,
        clientQuoteId,
        amount,
        currency: 'CAD',
        method,
        status: 'PAID',
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        confirmedAt: new Date(),
        confirmedById: userId,
        checkNumber: checkNumber || null,
        wireReference: wireReference || null,
        notes: notes || null,
        createdById: userId
      },
      include: {
        clientQuote: {
          select: { id: true, quoteNumber: true }
        }
      }
    })

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId,
        type: 'PAYMENT_RECEIVED',
        message: `Payment of $${parseFloat(amount).toFixed(2)} received via ${method}`,
        userId,
        metadata: { paymentId: payment.id, amount, method }
      }
    })

    // Check if fully paid
    if (newTotal >= quoteTotal) {
      // Update any pending orders to payment received
      await prisma.order.updateMany({
        where: {
          projectId: clientQuote.projectId,
          status: 'PENDING_PAYMENT'
        },
        data: {
          status: 'PAYMENT_RECEIVED'
        }
      })
    }

    return NextResponse.json({
      payment,
      summary: {
        totalPaid: newTotal,
        quoteTotal,
        remainingBalance: Math.max(0, quoteTotal - newTotal),
        fullyPaid: newTotal >= quoteTotal
      }
    })
  } catch (error) {
    console.error('Error recording payment:', error)
    return NextResponse.json(
      { error: 'Failed to record payment' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/payments
 * Update payment status (confirm, refund, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, action, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const payment = await prisma.payment.findFirst({
      where: { id, orgId }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    let updateData: any = {}

    if (action === 'confirm') {
      updateData = {
        status: 'PAID',
        confirmedAt: new Date(),
        confirmedById: userId
      }
    } else if (action === 'refund') {
      updateData = {
        status: 'REFUNDED',
        notes: notes ? `${payment.notes || ''}\nRefund: ${notes}`.trim() : payment.notes
      }
    } else if (action === 'cancel') {
      updateData = {
        status: 'CANCELLED',
        notes: notes ? `${payment.notes || ''}\nCancelled: ${notes}`.trim() : payment.notes
      }
    } else if (action === 'reconcile') {
      updateData = {
        reconciled: true,
        reconciledAt: new Date(),
        reconciledById: userId,
        reconciledNotes: notes || null
      }
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: updateData
    })

    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: payment.clientQuoteId,
        type: `PAYMENT_${action.toUpperCase()}`,
        message: `Payment ${action}${notes ? `: ${notes}` : ''}`,
        userId
      }
    })

    return NextResponse.json({ payment: updated })
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json(
      { error: 'Failed to update payment' },
      { status: 500 }
    )
  }
}
