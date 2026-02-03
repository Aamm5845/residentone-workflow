import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    // Get Cardknox iFields key
    const iFieldsKey = invoice.project?.organization?.cardknoxKey || process.env.CARDKNOX_IFIELDS_KEY

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

    // Get Cardknox API key
    const cardknoxKey = invoice.project?.organization?.cardknoxKey || process.env.CARDKNOX_KEY

    if (!cardknoxKey) {
      return NextResponse.json({ error: 'Payment processing not configured' }, { status: 500 })
    }

    // Process payment with Cardknox
    const cardknoxResponse = await fetch('https://x1.cardknox.com/gateway', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        xKey: cardknoxKey,
        xVersion: '5.0.0',
        xSoftwareName: 'ResidentOne',
        xSoftwareVersion: '1.0.0',
        xCommand: 'cc:sale',
        xAmount: Number(payment.amount).toFixed(2),
        xCardNum: cardToken,
        xCVV: cvvToken || '',
        xExp: expiration,
        xInvoice: invoice.invoiceNumber,
        xBillFirstName: invoice.clientName.split(' ')[0] || '',
        xBillLastName: invoice.clientName.split(' ').slice(1).join(' ') || '',
        xEmail: invoice.clientEmail,
      }).toString()
    })

    const responseText = await cardknoxResponse.text()
    const params = new URLSearchParams(responseText)
    const result = Object.fromEntries(params.entries())

    console.log('[Billing Payment] Cardknox response:', result)

    if (result.xResult === 'A' || result.xStatus === 'Approved') {
      // Payment approved
      await prisma.$transaction(async (tx) => {
        // Update payment record
        await tx.billingInvoicePayment.update({
          where: { id: paymentId },
          data: {
            status: 'COMPLETED',
            reference: result.xRefNum || payment.reference,
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
            message: `Payment of $${Number(payment.amount).toFixed(2)} received via credit card`,
          }
        })
      })

      return NextResponse.json({
        success: true,
        message: 'Payment processed successfully',
        refNum: result.xRefNum
      })
    } else {
      // Payment declined
      await prisma.billingInvoicePayment.update({
        where: { id: paymentId },
        data: {
          status: 'FAILED',
          notes: result.xError || result.xErrorCode || 'Payment declined',
        }
      })

      return NextResponse.json({
        success: false,
        error: result.xError || 'Payment was declined'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error processing payment:', error)
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
  }
}
