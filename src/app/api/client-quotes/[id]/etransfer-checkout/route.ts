import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionToken, initiateETransferPayment, isNuveiConfigured } from '@/lib/nuvei'

export const dynamic = 'force-dynamic'

/**
 * POST /api/client-quotes/[id]/etransfer-checkout
 * Create a Nuvei Interac e-Transfer checkout session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if Nuvei is configured
    if (!isNuveiConfigured()) {
      return NextResponse.json(
        { error: 'Interac e-Transfer is not configured. Please contact support.' },
        { status: 503 }
      )
    }

    // Get invoice by ID or accessToken
    const invoice = await prisma.clientQuote.findFirst({
      where: {
        OR: [
          { id },
          { accessToken: id }
        ]
      },
      include: {
        lineItems: true,
        project: {
          select: {
            name: true,
            client: {
              select: {
                name: true,
                email: true,
                phone: true
              }
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get customer details
    const customerEmail = invoice.clientEmail || invoice.project.client?.email
    const customerName = invoice.clientName || invoice.project.client?.name || 'Customer'
    const customerPhone = invoice.project.client?.phone

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'Customer email is required for e-Transfer' },
        { status: 400 }
      )
    }

    // Get total amount (no fee for e-Transfer)
    const amount = Number(invoice.totalAmount) || 0

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid invoice amount' },
        { status: 400 }
      )
    }

    // Get base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Get client IP
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || '127.0.0.1'

    // Get session token from Nuvei
    const clientRequestId = `session-${invoice.id}-${Date.now()}`
    const sessionResponse = await getSessionToken(clientRequestId)

    if (sessionResponse.status !== 'SUCCESS') {
      console.error('Nuvei session token failed:', sessionResponse)
      return NextResponse.json(
        { error: 'Failed to initialize payment session' },
        { status: 500 }
      )
    }

    // Initiate e-Transfer payment
    const paymentResponse = await initiateETransferPayment({
      sessionToken: sessionResponse.sessionToken,
      amount,
      invoiceId: invoice.id,
      quoteNumber: invoice.quoteNumber,
      customerEmail,
      customerPhone: customerPhone || undefined,
      customerName,
      notificationUrl: `${baseUrl}/api/webhooks/nuvei`,
      successUrl: `${baseUrl}/client/invoice/${id}?payment=success`,
      failureUrl: `${baseUrl}/client/invoice/${id}?payment=failed`,
      pendingUrl: `${baseUrl}/client/invoice/${id}?payment=pending`,
      ipAddress,
    })

    console.log('[Nuvei e-Transfer] Payment response:', {
      status: paymentResponse.status,
      transactionStatus: paymentResponse.transactionStatus,
      hasRedirectUrl: !!paymentResponse.redirectUrl,
    })

    // Check if we got a redirect URL
    if (paymentResponse.transactionStatus === 'REDIRECT' && paymentResponse.redirectUrl) {
      // Store the transaction ID for webhook matching
      await prisma.clientQuote.update({
        where: { id: invoice.id },
        data: {
          // Store Nuvei transaction info in metadata or a dedicated field
          // For now, we'll log it and handle in webhook
        }
      })

      return NextResponse.json({
        url: paymentResponse.redirectUrl,
        transactionId: paymentResponse.transactionId,
      })
    }

    // If approved immediately (unlikely for e-Transfer)
    if (paymentResponse.status === 'SUCCESS' && paymentResponse.transactionStatus === 'APPROVED') {
      return NextResponse.json({
        url: `${baseUrl}/client/invoice/${id}?payment=success`,
        transactionId: paymentResponse.transactionId,
      })
    }

    // Handle errors
    console.error('Nuvei payment error:', paymentResponse)
    return NextResponse.json(
      { error: paymentResponse.reason || 'Failed to create e-Transfer session' },
      { status: 500 }
    )

  } catch (error) {
    console.error('Error creating e-Transfer checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create e-Transfer checkout session' },
      { status: 500 }
    )
  }
}
