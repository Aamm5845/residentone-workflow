// Record payment for an invoice
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Get payment history for an invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = (session.user as any).orgId

    const { id: projectId, invoiceId } = await params

    const invoice = await prisma.clientQuote.findFirst({
      where: {
        id: invoiceId,
        projectId,
        orgId
      },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            confirmedBy: {
              select: { name: true }
            },
            createdBy: {
              select: { name: true }
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const totalAmount = Number(invoice.totalAmount) || 0
    const paidAmount = invoice.payments
      .filter(p => p.status === 'PAID' || p.status === 'PARTIAL')
      .reduce((sum, p) => sum + Number(p.amount), 0)

    return NextResponse.json({
      payments: invoice.payments.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        method: p.method,
        status: p.status,
        paidAt: p.paidAt,
        confirmedAt: p.confirmedAt,
        confirmedBy: p.confirmedBy?.name,
        createdBy: p.createdBy.name,
        stripePaymentId: p.stripePaymentId,
        checkNumber: p.checkNumber,
        wireReference: p.wireReference,
        notes: p.notes,
        createdAt: p.createdAt
      })),
      summary: {
        totalAmount,
        paidAmount,
        balance: totalAmount - paidAmount
      }
    })
  } catch (error) {
    console.error('Error fetching payment history:', error)
    return NextResponse.json({ error: 'Failed to fetch payment history' }, { status: 500 })
  }
}

// POST - Record a new payment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const { id: projectId, invoiceId } = await params
    const body = await request.json()

    const {
      amount,
      method, // CREDIT_CARD, WIRE_TRANSFER, CHECK, ACH_BANK_TRANSFER, CASH, OTHER
      paidAt,
      reference, // check number, wire reference, etc.
      notes
    } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 })
    }

    if (!method) {
      return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
    }

    const invoice = await prisma.clientQuote.findFirst({
      where: {
        id: invoiceId,
        projectId,
        orgId
      },
      include: {
        payments: {
          where: {
            status: { in: ['PAID', 'PARTIAL'] }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const totalAmount = Number(invoice.totalAmount) || 0
    const currentPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const balance = totalAmount - currentPaid

    if (amount > balance) {
      return NextResponse.json({
        error: `Payment amount ($${amount.toFixed(2)}) exceeds balance ($${balance.toFixed(2)})`
      }, { status: 400 })
    }

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        orgId,
        clientQuoteId: invoiceId,
        amount,
        currency: 'CAD',
        method,
        status: 'PAID',
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        confirmedAt: new Date(),
        confirmedById: userId,
        checkNumber: method === 'CHECK' ? reference : null,
        wireReference: method === 'WIRE_TRANSFER' ? reference : null,
        notes,
        createdById: userId
      }
    })

    // Check if fully paid
    const newPaidAmount = currentPaid + amount
    const isFullyPaid = newPaidAmount >= totalAmount

    // Update invoice status if needed
    if (isFullyPaid) {
      await prisma.clientQuote.update({
        where: { id: invoiceId },
        data: {
          status: 'APPROVED', // Using APPROVED as "PAID" status
          clientDecision: 'PAID',
          clientDecidedAt: new Date()
        }
      })
    }

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: invoiceId,
        type: 'PAYMENT_RECEIVED',
        message: `Payment of $${amount.toFixed(2)} recorded via ${method.replace('_', ' ').toLowerCase()}${isFullyPaid ? ' - Invoice fully paid' : ''}`,
        userId: userId,
        metadata: {
          paymentId: payment.id,
          amount,
          method,
          reference,
          isFullyPaid
        }
      }
    })

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        method: payment.method,
        status: payment.status
      },
      invoiceStatus: isFullyPaid ? 'PAID' : 'PARTIAL',
      newBalance: totalAmount - newPaidAmount
    })
  } catch (error) {
    console.error('Error recording payment:', error)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}
