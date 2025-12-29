import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripeService } from '@/lib/stripe-service'
import { calculateCCSurcharge } from '@/lib/tax-utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/quote/[token]/payment
 * Create a Stripe payment intent for credit card payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Check if Stripe is configured
    if (!stripeService.isConfigured()) {
      return NextResponse.json(
        { error: 'Payment processing is not configured' },
        { status: 503 }
      )
    }

    // Find the quote
    const quote = await prisma.clientQuote.findUnique({
      where: { accessToken: token },
      include: {
        project: {
          select: {
            name: true,
            client: {
              select: { name: true, email: true }
            }
          }
        },
        payments: {
          where: { status: 'PAID' }
        }
      }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Check if quote is expired
    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      return NextResponse.json({ error: 'Quote has expired' }, { status: 400 })
    }

    // Check if already paid
    const paidAmount = quote.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const remainingAmount = Number(quote.totalAmount) - paidAmount

    if (remainingAmount <= 0) {
      return NextResponse.json({ error: 'Quote is already paid' }, { status: 400 })
    }

    // Calculate CC surcharge
    const surchargePercent = Number(quote.ccSurchargePercent) || 3
    const { surcharge, total: totalWithSurcharge } = calculateCCSurcharge(remainingAmount, surchargePercent)

    // Create payment intent
    const result = await stripeService.createPaymentIntent({
      amount: remainingAmount,
      currency: quote.currency.toLowerCase(),
      customerEmail: quote.clientEmail || quote.project?.client?.email || undefined,
      customerName: quote.clientName || quote.project?.client?.name || undefined,
      description: `Quote ${quote.quoteNumber} - ${quote.project?.name || 'Project'}`,
      metadata: {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        orgId: quote.orgId
      },
      applySurcharge: true,
      surchargePercent
    })

    // Create pending payment record
    const payment = await prisma.payment.create({
      data: {
        orgId: quote.orgId,
        clientQuoteId: quote.id,
        amount: totalWithSurcharge,
        currency: quote.currency,
        method: 'STRIPE',
        status: 'PENDING',
        stripePaymentId: result.paymentIntentId,
        metadata: {
          originalAmount: remainingAmount,
          surchargeAmount: surcharge,
          surchargePercent
        }
      }
    })

    // Update quote with CC surcharge
    await prisma.clientQuote.update({
      where: { id: quote.id },
      data: {
        selectedPaymentMethod: 'CREDIT_CARD',
        ccSurchargeAmount: surcharge
      }
    })

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: quote.id,
        type: 'PAYMENT_INITIATED',
        description: `Payment initiated via credit card ($${totalWithSurcharge.toFixed(2)} including $${surcharge.toFixed(2)} surcharge)`
      }
    })

    return NextResponse.json({
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      paymentId: payment.id,
      originalAmount: remainingAmount,
      surchargeAmount: surcharge,
      surchargePercent,
      totalAmount: totalWithSurcharge,
      currency: quote.currency
    })
  } catch (error) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create payment' },
      { status: 500 }
    )
  }
}
