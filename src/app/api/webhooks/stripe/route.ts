import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripeService } from '@/lib/stripe-service'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// Disable body parsing, we need raw body for signature verification
export const config = {
  api: {
    bodyParser: false
  }
}

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      )
    }

    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(body, signature)

    if (!event) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`)

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentSucceeded(paymentIntent)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailed(paymentIntent)
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleRefund(charge)
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        await handleDispute(dispute)
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Stripe Webhook] Payment succeeded: ${paymentIntent.id}`)

  // Find the payment record
  const payment = await prisma.payment.findFirst({
    where: { stripePaymentId: paymentIntent.id }
  })

  if (!payment) {
    console.warn(`[Stripe Webhook] Payment not found for intent: ${paymentIntent.id}`)
    return
  }

  // Already processed
  if (payment.status === 'PAID') {
    console.log(`[Stripe Webhook] Payment already marked as paid: ${payment.id}`)
    return
  }

  // Get charge info for receipt
  let chargeId: string | undefined
  let receiptUrl: string | undefined

  if (paymentIntent.latest_charge) {
    chargeId = typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge.id
  }

  // Update payment record
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      confirmedAt: new Date(),
      stripeChargeId: chargeId
    }
  })

  // Log activity
  await prisma.clientQuoteActivity.create({
    data: {
      clientQuoteId: payment.clientQuoteId,
      type: 'PAYMENT_COMPLETED',
      message: `Payment of $${parseFloat(payment.amount.toString()).toFixed(2)} confirmed by Stripe webhook`
    }
  })

  // Check if quote is fully paid and update orders
  const quote = await prisma.clientQuote.findUnique({
    where: { id: payment.clientQuoteId },
    include: {
      payments: {
        where: { status: 'PAID' }
      }
    }
  })

  if (quote) {
    const totalPaid = quote.payments.reduce(
      (sum, p) => sum + parseFloat(p.amount.toString()),
      0
    )
    const quoteTotal = parseFloat(
      quote.totalAmount?.toString() || quote.subtotal?.toString() || '0'
    )

    if (totalPaid >= quoteTotal) {
      await prisma.order.updateMany({
        where: {
          projectId: quote.projectId,
          status: 'PENDING_PAYMENT'
        },
        data: {
          status: 'PAYMENT_RECEIVED'
        }
      })
    }
  }

  console.log(`[Stripe Webhook] Payment ${payment.id} marked as paid`)
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[Stripe Webhook] Payment failed: ${paymentIntent.id}`)

  const payment = await prisma.payment.findFirst({
    where: { stripePaymentId: paymentIntent.id }
  })

  if (!payment) {
    console.warn(`[Stripe Webhook] Payment not found for intent: ${paymentIntent.id}`)
    return
  }

  // Update payment record
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'FAILED',
      notes: paymentIntent.last_payment_error?.message || 'Payment failed'
    }
  })

  // Log activity
  await prisma.clientQuoteActivity.create({
    data: {
      clientQuoteId: payment.clientQuoteId,
      type: 'PAYMENT_FAILED',
      message: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`
    }
  })

  console.log(`[Stripe Webhook] Payment ${payment.id} marked as failed`)
}

async function handleRefund(charge: Stripe.Charge) {
  console.log(`[Stripe Webhook] Refund processed for charge: ${charge.id}`)

  const payment = await prisma.payment.findFirst({
    where: { stripeChargeId: charge.id }
  })

  if (!payment) {
    console.warn(`[Stripe Webhook] Payment not found for charge: ${charge.id}`)
    return
  }

  // Calculate refund amount
  const refundedAmount = charge.amount_refunded / 100 // Convert from cents

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: charge.refunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      notes: `Refunded $${refundedAmount.toFixed(2)}`
    }
  })

  await prisma.clientQuoteActivity.create({
    data: {
      clientQuoteId: payment.clientQuoteId,
      type: 'PAYMENT_REFUNDED',
      message: `$${refundedAmount.toFixed(2)} refunded`
    }
  })

  console.log(`[Stripe Webhook] Payment ${payment.id} refund processed`)
}

async function handleDispute(dispute: Stripe.Dispute) {
  console.log(`[Stripe Webhook] Dispute created: ${dispute.id}`)

  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id

  if (!chargeId) return

  const payment = await prisma.payment.findFirst({
    where: { stripeChargeId: chargeId }
  })

  if (!payment) {
    console.warn(`[Stripe Webhook] Payment not found for disputed charge: ${chargeId}`)
    return
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'DISPUTED',
      notes: `Dispute: ${dispute.reason || 'Unknown reason'}`
    }
  })

  await prisma.clientQuoteActivity.create({
    data: {
      clientQuoteId: payment.clientQuoteId,
      type: 'PAYMENT_DISPUTED',
      message: `Payment disputed: ${dispute.reason || 'Unknown reason'}`
    }
  })

  console.log(`[Stripe Webhook] Payment ${payment.id} marked as disputed`)
}
