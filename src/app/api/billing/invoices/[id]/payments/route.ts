import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for recording a payment
const recordPaymentSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  method: z.enum(['CREDIT_CARD', 'WIRE_TRANSFER', 'CHECK', 'E_TRANSFER', 'CASH', 'OTHER']),
  paidAt: z.string().optional(),
  stripePaymentId: z.string().optional(),
  checkNumber: z.string().optional(),
  wireReference: z.string().optional(),
  eTransferRef: z.string().optional(),
  proofDocumentUrl: z.string().optional(),
  notes: z.string().optional(),
})

interface AuthSession {
  user: {
    id: string
    orgId: string
    role: string
  }
}

// Helper to check billing access
async function canAccessBilling(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canSeeBilling: true },
  })
  return user?.role === 'OWNER' || user?.canSeeBilling === true
}

// GET - List payments for an invoice
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await context.params
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    // Verify invoice belongs to org
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id: invoiceId,
        orgId: session.user.orgId,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const payments = await prisma.billingPayment.findMany({
      where: { billingInvoiceId: invoiceId },
      orderBy: { paidAt: 'desc' },
      include: {
        confirmedBy: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(payments.map(p => ({
      ...p,
      amount: Number(p.amount),
    })))
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Record a new payment
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await context.params
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = recordPaymentSchema.parse(body)

    // Verify invoice belongs to org
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id: invoiceId,
        orgId: session.user.orgId,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Cannot add payment to void or cancelled invoice
    if (['VOID', 'CANCELLED'].includes(invoice.status)) {
      return NextResponse.json({
        error: 'Cannot add payment to a void or cancelled invoice'
      }, { status: 400 })
    }

    // Check payment doesn't exceed balance
    const currentBalance = Number(invoice.balanceDue)
    if (validatedData.amount > currentBalance) {
      return NextResponse.json({
        error: `Payment amount exceeds balance due (${currentBalance.toFixed(2)})`
      }, { status: 400 })
    }

    // Create payment
    const payment = await prisma.billingPayment.create({
      data: {
        billingInvoiceId: invoiceId,
        amount: validatedData.amount,
        method: validatedData.method,
        status: 'CONFIRMED',
        paidAt: validatedData.paidAt ? new Date(validatedData.paidAt) : new Date(),
        confirmedAt: new Date(),
        confirmedById: session.user.id,
        stripePaymentId: validatedData.stripePaymentId,
        checkNumber: validatedData.checkNumber,
        wireReference: validatedData.wireReference,
        eTransferRef: validatedData.eTransferRef,
        proofDocumentUrl: validatedData.proofDocumentUrl,
        notes: validatedData.notes,
      },
    })

    // Update invoice totals
    const newAmountPaid = Number(invoice.amountPaid) + validatedData.amount
    const newBalanceDue = Number(invoice.totalAmount) - newAmountPaid
    const isPaidInFull = newBalanceDue <= 0

    await prisma.billingInvoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: newAmountPaid,
        balanceDue: Math.max(0, newBalanceDue),
        status: isPaidInFull ? 'PAID' : 'PARTIALLY_PAID',
        paidInFullAt: isPaidInFull ? new Date() : null,
      },
    })

    // Log activity
    await prisma.billingInvoiceActivity.create({
      data: {
        billingInvoiceId: invoiceId,
        type: 'PAYMENT_RECEIVED',
        message: `Payment of $${validatedData.amount.toFixed(2)} received via ${validatedData.method.replace('_', ' ').toLowerCase()}`,
        metadata: {
          paymentId: payment.id,
          amount: validatedData.amount,
          method: validatedData.method,
        },
      },
    })

    return NextResponse.json({
      ...payment,
      amount: Number(payment.amount),
      newBalance: Math.max(0, newBalanceDue),
      isPaidInFull,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error recording payment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
