import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripeService } from '@/lib/stripe-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/client-portal/[token]/pay
 * Create a Stripe payment intent for a client quote payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { quoteId, amount, applySurcharge = true } = body

    // Validate token
    const accessToken = await prisma.clientAccessToken.findFirst({
      where: {
        token,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        project: {
          include: {
            client: true
          }
        }
      }
    })

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Invalid or expired access link' },
        { status: 401 }
      )
    }

    // Get the client quote
    const quote = await prisma.clientQuote.findFirst({
      where: {
        id: quoteId,
        projectId: accessToken.projectId,
        status: 'APPROVED'
      },
      include: {
        payments: {
          where: { status: 'PAID' }
        }
      }
    })

    if (!quote) {
      return NextResponse.json(
        { error: 'Approved quote not found' },
        { status: 404 }
      )
    }

    // Calculate remaining balance
    const totalPaid = quote.payments.reduce(
      (sum, p) => sum + parseFloat(p.amount.toString()),
      0
    )
    const quoteTotal = parseFloat(quote.totalAmount?.toString() || quote.subtotal?.toString() || '0')
    const remainingBalance = quoteTotal - totalPaid

    if (remainingBalance <= 0) {
      return NextResponse.json(
        { error: 'Quote is already fully paid' },
        { status: 400 }
      )
    }

    // Validate payment amount
    const paymentAmount = amount || remainingBalance
    if (paymentAmount > remainingBalance) {
      return NextResponse.json(
        { error: `Payment amount exceeds remaining balance of $${remainingBalance.toFixed(2)}` },
        { status: 400 }
      )
    }

    // Check if Stripe is configured
    if (!stripeService.isConfigured()) {
      return NextResponse.json(
        { error: 'Payment processing is not configured' },
        { status: 503 }
      )
    }

    // Create payment intent with optional 3% surcharge
    const result = await stripeService.createPaymentIntent({
      amount: paymentAmount,
      currency: 'cad',
      customerEmail: accessToken.project.client?.email,
      customerName: accessToken.project.client?.name,
      description: `Payment for ${quote.quoteNumber} - ${quote.title}`,
      applySurcharge,
      surchargePercent: 3,
      metadata: {
        clientQuoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        projectId: accessToken.projectId,
        projectName: accessToken.project.name,
        accessTokenId: accessToken.id
      }
    })

    // Create pending payment record
    const payment = await prisma.payment.create({
      data: {
        orgId: accessToken.project.orgId,
        clientQuoteId: quote.id,
        amount: result.totalAmount,
        currency: 'CAD',
        method: 'CREDIT_CARD',
        status: 'PENDING',
        stripePaymentId: result.paymentIntentId,
        notes: applySurcharge
          ? `Original amount: $${result.amount.toFixed(2)}, CC surcharge (3%): $${result.surchargeAmount.toFixed(2)}`
          : null,
        metadata: {
          originalAmount: result.amount,
          surchargeAmount: result.surchargeAmount,
          surchargeApplied: applySurcharge
        },
        createdById: accessToken.createdById
      }
    })

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: quote.id,
        type: 'PAYMENT_INITIATED',
        message: `Payment of $${result.totalAmount.toFixed(2)} initiated via Stripe${applySurcharge ? ' (includes 3% CC fee)' : ''}`
      }
    })

    return NextResponse.json({
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      paymentId: payment.id,
      amount: result.amount,
      surchargeAmount: result.surchargeAmount,
      totalAmount: result.totalAmount,
      publishableKey: stripeService.getPublishableKey()
    })
  } catch (error) {
    console.error('[ClientPortal] Payment Error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/client-portal/[token]/pay
 * Confirm payment completion
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { paymentIntentId, paymentId } = body

    // Validate token
    const accessToken = await prisma.clientAccessToken.findFirst({
      where: {
        token,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Invalid or expired access link' },
        { status: 401 }
      )
    }

    // Verify payment with Stripe
    const confirmation = await stripeService.confirmPayment(paymentIntentId)

    if (!confirmation.success) {
      return NextResponse.json(
        { error: 'Payment not confirmed', status: confirmation.status },
        { status: 400 }
      )
    }

    // Update payment record
    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        confirmedAt: new Date(),
        stripeChargeId: confirmation.chargeId,
        metadata: {
          receiptUrl: confirmation.receiptUrl
        }
      },
      include: {
        clientQuote: true
      }
    })

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: payment.clientQuoteId,
        type: 'PAYMENT_COMPLETED',
        message: `Payment of $${parseFloat(payment.amount.toString()).toFixed(2)} completed via credit card`
      }
    })

    // Check if quote is fully paid
    const allPayments = await prisma.payment.findMany({
      where: {
        clientQuoteId: payment.clientQuoteId,
        status: 'PAID'
      }
    })

    const totalPaid = allPayments.reduce(
      (sum, p) => sum + parseFloat(p.amount.toString()),
      0
    )
    const quoteTotal = parseFloat(
      payment.clientQuote.totalAmount?.toString() ||
      payment.clientQuote.subtotal?.toString() ||
      '0'
    )

    const fullyPaid = totalPaid >= quoteTotal

    // Update orders if fully paid
    if (fullyPaid) {
      await prisma.order.updateMany({
        where: {
          projectId: payment.clientQuote.projectId,
          status: 'PENDING_PAYMENT'
        },
        data: {
          status: 'PAYMENT_RECEIVED'
        }
      })
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      receiptUrl: confirmation.receiptUrl,
      fullyPaid,
      totalPaid,
      remainingBalance: Math.max(0, quoteTotal - totalPaid)
    })
  } catch (error) {
    console.error('[ClientPortal] Payment Confirmation Error:', error)
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}
