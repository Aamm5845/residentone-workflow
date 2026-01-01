import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyDMNChecksum } from '@/lib/nuvei'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/nuvei
 * Handle Nuvei Direct Merchant Notifications (DMN) for Interac e-Transfer
 *
 * Nuvei sends these notifications when:
 * - Payment is approved
 * - Payment is pending
 * - Payment is declined
 */
export async function POST(request: NextRequest) {
  try {
    // Nuvei sends form-urlencoded data
    const formData = await request.formData()
    const params: Record<string, string> = {}

    formData.forEach((value, key) => {
      params[key] = value.toString()
    })

    console.log('[Nuvei Webhook] Received DMN:', {
      Status: params.Status,
      ppp_status: params.ppp_status,
      TransactionID: params.PPP_TransactionID,
      customField1: params.customField1, // invoiceId
      customField2: params.customField2, // quoteNumber
    })

    // Verify checksum (optional but recommended)
    // const isValid = verifyDMNChecksum(params)
    // if (!isValid) {
    //   console.error('[Nuvei Webhook] Invalid checksum')
    //   return NextResponse.json({ error: 'Invalid checksum' }, { status: 400 })
    // }

    const {
      Status,
      ppp_status,
      PPP_TransactionID,
      customField1: invoiceId,
      customField2: quoteNumber,
      totalAmount,
      currency,
      email,
      first_name,
      last_name,
    } = params

    // Find the invoice
    if (!invoiceId) {
      console.warn('[Nuvei Webhook] No invoiceId in DMN')
      return NextResponse.json({ received: true })
    }

    const invoice = await prisma.clientQuote.findUnique({
      where: { id: invoiceId },
      include: {
        payments: true,
        project: {
          select: { id: true }
        }
      }
    })

    if (!invoice) {
      console.warn(`[Nuvei Webhook] Invoice not found: ${invoiceId}`)
      return NextResponse.json({ received: true })
    }

    // Handle based on status
    if (Status === 'APPROVED' || ppp_status === 'OK') {
      await handlePaymentApproved({
        invoice,
        transactionId: PPP_TransactionID,
        amount: parseFloat(totalAmount) || 0,
        customerEmail: email,
        customerName: `${first_name || ''} ${last_name || ''}`.trim(),
      })
    } else if (Status === 'PENDING') {
      await handlePaymentPending({
        invoice,
        transactionId: PPP_TransactionID,
      })
    } else if (Status === 'DECLINED' || ppp_status === 'FAIL') {
      await handlePaymentDeclined({
        invoice,
        transactionId: PPP_TransactionID,
        reason: params.Reason || params.reason || 'Payment declined',
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Nuvei Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Also support GET for Nuvei verification pings
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

interface PaymentParams {
  invoice: {
    id: string
    orgId: string
    quoteNumber: string
    projectId: string
    totalAmount: any
    subtotal: any
    payments: any[]
    project: { id: string }
  }
  transactionId: string
  amount?: number
  customerEmail?: string
  customerName?: string
  reason?: string
}

async function handlePaymentApproved(params: PaymentParams) {
  const { invoice, transactionId, amount, customerEmail, customerName } = params

  console.log(`[Nuvei Webhook] Payment approved: ${transactionId} for invoice ${invoice.quoteNumber}`)

  // Check if payment already exists
  const existingPayment = await prisma.payment.findFirst({
    where: {
      clientQuoteId: invoice.id,
      nuveiTransactionId: transactionId,
    }
  })

  if (existingPayment) {
    console.log(`[Nuvei Webhook] Payment already recorded: ${existingPayment.id}`)
    return
  }

  // Calculate payment amount
  const paymentAmount = amount || parseFloat(invoice.totalAmount?.toString() || invoice.subtotal?.toString() || '0')

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      orgId: invoice.orgId,
      clientQuoteId: invoice.id,
      amount: paymentAmount,
      method: 'E_TRANSFER',
      status: 'PAID',
      paidAt: new Date(),
      confirmedAt: new Date(),
      notes: `Interac e-Transfer via Nuvei`,
      nuveiTransactionId: transactionId,
    }
  })

  // Update invoice status
  await prisma.clientQuote.update({
    where: { id: invoice.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    }
  })

  // Log activity
  await prisma.clientQuoteActivity.create({
    data: {
      clientQuoteId: invoice.id,
      type: 'PAYMENT_COMPLETED',
      message: `Payment of $${paymentAmount.toFixed(2)} received via Interac e-Transfer${customerName ? ` from ${customerName}` : ''}`
    }
  })

  // Update related orders to payment received status
  await prisma.order.updateMany({
    where: {
      projectId: invoice.projectId,
      status: 'PENDING_PAYMENT'
    },
    data: {
      status: 'PAYMENT_RECEIVED'
    }
  })

  console.log(`[Nuvei Webhook] Payment ${payment.id} created and invoice marked as paid`)
}

async function handlePaymentPending(params: Pick<PaymentParams, 'invoice' | 'transactionId'>) {
  const { invoice, transactionId } = params

  console.log(`[Nuvei Webhook] Payment pending: ${transactionId} for invoice ${invoice.quoteNumber}`)

  // Log activity
  await prisma.clientQuoteActivity.create({
    data: {
      clientQuoteId: invoice.id,
      type: 'STATUS_CHANGE',
      message: `Interac e-Transfer payment initiated (pending bank authorization)`
    }
  })
}

async function handlePaymentDeclined(params: Pick<PaymentParams, 'invoice' | 'transactionId' | 'reason'>) {
  const { invoice, transactionId, reason } = params

  console.log(`[Nuvei Webhook] Payment declined: ${transactionId} for invoice ${invoice.quoteNumber}`)

  // Log activity
  await prisma.clientQuoteActivity.create({
    data: {
      clientQuoteId: invoice.id,
      type: 'PAYMENT_FAILED',
      message: `Interac e-Transfer payment declined: ${reason}`
    }
  })
}
