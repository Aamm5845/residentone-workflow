import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { soloService } from '@/lib/solo-service'
import { syncItemsStatus } from '@/lib/procurement/status-sync'

export const dynamic = 'force-dynamic'

/**
 * POST /api/client-portal/[token]/pay
 * Initialize a payment for a client quote (returns payment ID and iFields key)
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

    // Check if Solo is configured
    if (!soloService.isConfigured()) {
      return NextResponse.json(
        { error: 'Payment processing is not configured' },
        { status: 503 }
      )
    }

    // Calculate surcharge
    const surchargePercent = 3
    let surchargeAmount = 0
    let totalAmount = paymentAmount

    if (applySurcharge) {
      surchargeAmount = Math.round(paymentAmount * (surchargePercent / 100) * 100) / 100
      totalAmount = paymentAmount + surchargeAmount
    }

    // Create pending payment record
    const payment = await prisma.payment.create({
      data: {
        orgId: accessToken.project.orgId,
        clientQuoteId: quote.id,
        amount: totalAmount,
        currency: 'CAD',
        method: 'CREDIT_CARD',
        status: 'PENDING',
        notes: applySurcharge
          ? `Original amount: $${paymentAmount.toFixed(2)}, CC surcharge (3%): $${surchargeAmount.toFixed(2)}`
          : null,
        metadata: {
          originalAmount: paymentAmount,
          surchargeAmount: surchargeAmount,
          surchargeApplied: applySurcharge,
          quoteNumber: quote.quoteNumber,
          projectId: accessToken.projectId,
          projectName: accessToken.project.name
        },
        createdById: accessToken.createdById
      }
    })

    // Log activity
    await prisma.clientQuoteActivity.create({
      data: {
        clientQuoteId: quote.id,
        type: 'PAYMENT_INITIATED',
        message: `Payment of $${totalAmount.toFixed(2)} initiated${applySurcharge ? ' (includes 3% CC fee)' : ''}`
      }
    })

    return NextResponse.json({
      paymentId: payment.id,
      amount: paymentAmount,
      surchargeAmount,
      totalAmount,
      iFieldsKey: soloService.getIFieldsKey()
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

    // Get the pending payment
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        status: 'PENDING'
      },
      include: {
        clientQuote: true
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
      customerEmail: accessToken.project.client?.email || undefined,
      customerName: accessToken.project.client?.name || undefined,
      description: `Payment for ${payment.clientQuote.quoteNumber} - ${payment.clientQuote.title}`,
      invoiceNumber: payment.clientQuote.quoteNumber,
      metadata: {
        paymentId: payment.id,
        quoteNumber: metadata.quoteNumber as string || '',
        projectId: metadata.projectId as string || ''
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
          nuveiTransactionId: result.transactionId, // Using nuveiTransactionId field for Solo
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
          clientQuoteId: payment.clientQuoteId,
          type: 'PAYMENT_COMPLETED',
          message: `Payment of $${parseFloat(payment.amount.toString()).toFixed(2)} completed via credit card (${result.cardType || 'Card'} ending ${result.maskedCard?.slice(-4) || '****'})`
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

      // Update orders and FFE item statuses if fully paid
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

        // Update FFE item statuses to CLIENT_PAID
        const lineItems = await prisma.clientQuoteLineItem.findMany({
          where: {
            clientQuoteId: payment.clientQuoteId,
            roomFFEItemId: { not: null }
          },
          select: { roomFFEItemId: true }
        })

        const itemIds = lineItems
          .map(li => li.roomFFEItemId)
          .filter((id): id is string => id !== null)

        if (itemIds.length > 0) {
          await syncItemsStatus(itemIds, 'payment_received')
          console.log(`[ClientPortal Payment] Updated ${itemIds.length} FFE items to CLIENT_PAID`)
        }
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
      // Payment failed - update status
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
          clientQuoteId: payment.clientQuoteId,
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
    console.error('[ClientPortal] Payment Processing Error:', error)
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    )
  }
}
