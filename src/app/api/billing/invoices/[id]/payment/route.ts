import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { soloService } from '@/lib/solo-service'

// Initialize payment - creates a pending payment record
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: token } = await context.params

  try {
    const body = await request.json()
    const { amount, applySurcharge } = body

    // Find invoice by access token
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        OR: [
          { accessToken: token },
          { id: token }
        ]
      },
      include: {
        project: {
          include: {
            organization: {
              select: {
                cardknoxKey: true,
                ccSurchargePercent: true,
              }
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (invoice.status === 'PAID') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 })
    }

    // Check if Solo payment service is configured
    if (!soloService.isConfigured()) {
      return NextResponse.json({ error: 'Payment processing not configured' }, { status: 500 })
    }

    // Get Cardknox iFields key (prefer organization-specific, fallback to global)
    const iFieldsKey = invoice.project?.organization?.cardknoxKey || soloService.getIFieldsKey()

    if (!iFieldsKey) {
      return NextResponse.json({ error: 'Payment processing not configured' }, { status: 500 })
    }

    // Calculate surcharge if applicable
    const originalAmount = amount || Number(invoice.balanceDue)
    const surchargePercent = invoice.project?.organization?.ccSurchargePercent || invoice.ccFeePercent || 3
    const surchargeAmount = applySurcharge ? originalAmount * (surchargePercent / 100) : 0
    const totalAmount = originalAmount + surchargeAmount

    // Create pending payment record
    const payment = await prisma.billingInvoicePayment.create({
      data: {
        billingInvoiceId: invoice.id,
        amount: totalAmount,
        method: 'CREDIT_CARD',
        status: 'PENDING',
        reference: `PAY-${Date.now()}`,
        notes: applySurcharge ? `Includes ${surchargePercent}% credit card fee` : undefined,
      }
    })

    return NextResponse.json({
      paymentId: payment.id,
      originalAmount,
      surchargeAmount,
      totalAmount,
      iFieldsKey
    })
  } catch (error) {
    console.error('Error initializing payment:', error)
    return NextResponse.json({ error: 'Failed to initialize payment' }, { status: 500 })
  }
}

// Process payment - complete the payment with card tokens
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: token } = await context.params

  try {
    const body = await request.json()
    const { paymentId, cardToken, cvvToken, expiration } = body

    if (!paymentId || !cardToken) {
      return NextResponse.json({ error: 'Missing payment information' }, { status: 400 })
    }

    // Validate expiration format (should be MMYY)
    if (!expiration || !/^\d{4}$/.test(expiration)) {
      return NextResponse.json({ error: 'Invalid expiration date format. Please use MM/YY.' }, { status: 400 })
    }

    // Validate month is 01-12
    const month = parseInt(expiration.substring(0, 2), 10)
    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid expiration month' }, { status: 400 })
    }

    // Get payment and invoice
    const payment = await prisma.billingInvoicePayment.findUnique({
      where: { id: paymentId },
      include: {
        billingInvoice: {
          include: {
            project: {
              include: {
                organization: {
                  select: {
                    cardknoxKey: true,
                    businessName: true,
                    name: true,
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.status !== 'PENDING') {
      return NextResponse.json({ error: 'Payment already processed' }, { status: 400 })
    }

    const invoice = payment.billingInvoice

    // Check if Solo payment service is configured
    if (!soloService.isConfigured()) {
      return NextResponse.json({ error: 'Payment processing not configured' }, { status: 500 })
    }

    // Parse client name for billing
    const nameParts = invoice.clientName.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    console.log('[Billing Payment] Processing with Solo service:', {
      amount: Number(payment.amount),
      invoiceNumber: invoice.invoiceNumber,
      clientEmail: invoice.clientEmail,
    })

    // Process payment with Solo service (uses Cardknox JSON API)
    const result = await soloService.processSale({
      amount: Number(payment.amount),
      currency: 'CAD',
      cardToken,
      cvvToken: cvvToken || undefined,
      expiration,
      customerEmail: invoice.clientEmail,
      customerName: invoice.clientName,
      billingAddress: {
        firstName,
        lastName,
      },
      description: `Payment for Invoice ${invoice.invoiceNumber}`,
      invoiceNumber: invoice.invoiceNumber,
      metadata: {
        invoiceId: invoice.id,
        paymentId: payment.id,
      }
    })

    console.log('[Billing Payment] Solo service response:', {
      success: result.success,
      transactionId: result.transactionId,
      error: result.error,
      errorCode: result.errorCode,
    })

    if (result.success) {
      // Payment approved
      await prisma.$transaction(async (tx) => {
        // Update payment record
        await tx.billingInvoicePayment.update({
          where: { id: paymentId },
          data: {
            status: 'COMPLETED',
            reference: result.transactionId || payment.reference,
            paidAt: new Date(),
          }
        })

        // Update invoice
        const newAmountPaid = Number(invoice.amountPaid) + Number(payment.amount)
        const newBalanceDue = Number(invoice.totalAmount) - newAmountPaid

        await tx.billingInvoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: newAmountPaid,
            balanceDue: newBalanceDue,
            status: newBalanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID',
            paidInFullAt: newBalanceDue <= 0 ? new Date() : undefined,
          }
        })

        // Create activity log
        await tx.billingInvoiceActivity.create({
          data: {
            billingInvoiceId: invoice.id,
            type: 'PAYMENT_RECEIVED',
            message: `Payment of $${Number(payment.amount).toFixed(2)} received via credit card (${result.cardType || 'Card'} ending ${result.maskedCard?.slice(-4) || '****'})`,
          }
        })
      })

      return NextResponse.json({
        success: true,
        message: 'Payment processed successfully',
        refNum: result.transactionId
      })
    } else {
      // Payment declined
      await prisma.billingInvoicePayment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          notes: result.error || 'Payment declined',
        }
      })

      return NextResponse.json({
        success: false,
        error: result.error || 'Payment was declined'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing payment:', error)
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
  }
}
