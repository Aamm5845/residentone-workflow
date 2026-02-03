import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    const body = await request.json()
    const { amount, method, reference, notes, paidAt } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 })
    }

    // Get invoice
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already fully paid' }, { status: 400 })
    }

    if (invoice.status === 'VOID' || invoice.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Cannot record payment on a void or cancelled invoice' }, { status: 400 })
    }

    // Get method label for display
    const methodLabels: Record<string, string> = {
      CREDIT_CARD: 'Credit Card',
      BANK_TRANSFER: 'Bank Transfer',
      E_TRANSFER: 'Interac e-Transfer',
      CHECK: 'Check',
      CASH: 'Cash',
      OTHER: 'Other',
    }

    const paymentMethod = method || 'OTHER'
    const methodLabel = methodLabels[paymentMethod] || 'Other'

    // Calculate new amounts
    const paymentAmount = Math.min(Number(amount), Number(invoice.balanceDue))
    const newAmountPaid = Number(invoice.amountPaid) + paymentAmount
    const newBalanceDue = Number(invoice.totalAmount) - newAmountPaid
    const isFullyPaid = newBalanceDue <= 0

    // Create payment record and update invoice
    await prisma.$transaction(async (tx) => {
      // Create payment record
      await tx.billingInvoicePayment.create({
        data: {
          billingInvoiceId: invoice.id,
          amount: paymentAmount,
          method: paymentMethod,
          status: 'COMPLETED',
          reference: reference || `MANUAL-${Date.now()}`,
          notes: notes || undefined,
          paidAt: paidAt ? new Date(paidAt) : new Date(),
        }
      })

      // Update invoice
      await tx.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          paidInFullAt: isFullyPaid ? new Date() : undefined,
        }
      })

      // Create activity log
      await tx.billingInvoiceActivity.create({
        data: {
          billingInvoiceId: invoice.id,
          type: 'PAYMENT_RECEIVED',
          message: `Manual payment of $${paymentAmount.toFixed(2)} recorded via ${methodLabel}`,
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: `Payment of $${paymentAmount.toFixed(2)} recorded successfully`,
      newStatus: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
      newBalanceDue,
    })
  } catch (error) {
    console.error('Error recording payment:', error)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}
