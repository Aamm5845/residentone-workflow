import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { soloService } from '@/lib/solo-service'
import { calculateCCSurcharge } from '@/lib/tax-utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/quote/[token]/payment
 * Initialize a payment for credit card (returns payment ID and iFields key)
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

    // Check if Solo is configured
    if (!soloService.isConfigured()) {
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

    // Create pending payment record
    const payment = await prisma.payment.create({
      data: {
        orgId: quote.orgId,
        clientQuoteId: quote.id,
        amount: totalWithSurcharge,
        currency: quote.currency,
        method: 'CREDIT_CARD',
        status: 'PENDING',
        metadata: {
          originalAmount: remainingAmount,
          surchargeAmount: surcharge,
          surchargePercent,
          quoteNumber: quote.quoteNumber,
          projectName: quote.project?.name
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
        message: `Payment initiated via credit card ($${totalWithSurcharge.toFixed(2)} including $${surcharge.toFixed(2)} surcharge)`
      }
    })

    return NextResponse.json({
      paymentId: payment.id,
      originalAmount: remainingAmount,
      surchargeAmount: surcharge,
      surchargePercent,
      totalAmount: totalWithSurcharge,
      currency: quote.currency,
      iFieldsKey: soloService.getIFieldsKey()
    })
  } catch (error) {
    console.error('Error initializing payment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initialize payment' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/quote/[token]/payment
 * Process the payment with card tokens from iFields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { paymentId, cardToken, cvvToken, expiration } = body

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
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
        }
      }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Get the pending payment
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        clientQuoteId: quote.id,
        status: 'PENDING'
      }
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found or already processed' },
        { status: 404 }
      )
    }

    // Extract metadata
    const metadata = payment.metadata as Record<string, unknown> || {}

    // Process payment with Solo
    const result = await soloService.processSale({
      amount: parseFloat(payment.amount.toString()),
      currency: payment.currency,
      cardToken,
      cvvToken,
      expiration,
      customerEmail: quote.clientEmail || quote.project?.client?.email || undefined,
      customerName: quote.clientName || quote.project?.client?.name || undefined,
      description: `Quote ${quote.quoteNumber} - ${quote.project?.name || 'Project'}`,
      invoiceNumber: quote.quoteNumber,
      metadata: {
        paymentId: payment.id,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        orgId: quote.orgId
      }
    })

    if (result.success) {
      // Update payment record
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          confirmedAt: new Date(),
          nuveiTransactionId: result.transactionId,
          metadata: {
            ...metadata,
            soloTransactionId: result.transactionId,
            soloAuthCode: result.authCode,
            maskedCard: result.maskedCard,
            cardType: result.cardType,
            soloToken: result.token
          }
        }
      })

      // Log activity
      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: quote.id,
          type: 'PAYMENT_COMPLETED',
          message: `Payment of $${parseFloat(payment.amount.toString()).toFixed(2)} completed via credit card (${result.cardType || 'Card'} ending ${result.maskedCard?.slice(-4) || '****'})`
        }
      })

      // Check if quote is fully paid
      const allPayments = await prisma.payment.findMany({
        where: {
          clientQuoteId: quote.id,
          status: 'PAID'
        }
      })

      const totalPaid = allPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount.toString()),
        0
      )
      const quoteTotal = parseFloat(quote.totalAmount?.toString() || '0')
      const fullyPaid = totalPaid >= quoteTotal

      // Update orders if fully paid
      if (fullyPaid) {
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

      return NextResponse.json({
        success: true,
        paymentId: payment.id,
        transactionId: result.transactionId,
        fullyPaid,
        totalPaid,
        remainingBalance: Math.max(0, quoteTotal - totalPaid)
      })
    } else {
      // Payment failed
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          metadata: {
            ...metadata,
            failureReason: result.error,
            failureCode: result.errorCode
          }
        }
      })

      // Log failure
      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: quote.id,
          type: 'PAYMENT_FAILED',
          message: `Payment of $${parseFloat(payment.amount.toString()).toFixed(2)} failed: ${result.error}`
        }
      })

      return NextResponse.json(
        { error: result.error || 'Payment was declined', success: false },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error processing payment:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process payment' },
      { status: 500 }
    )
  }
}
