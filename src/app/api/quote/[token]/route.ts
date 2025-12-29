import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/quote/[token]
 * Public endpoint to fetch quote details by access token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Find quote by access token
    const quote = await prisma.clientQuote.findUnique({
      where: { accessToken: token },
      include: {
        lineItems: {
          orderBy: { order: 'asc' }
        },
        project: {
          select: {
            id: true,
            name: true,
            client: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        payments: {
          where: { status: 'PAID' },
          select: {
            id: true,
            amount: true,
            method: true,
            paidAt: true
          }
        }
      }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Get organization branding
    const organization = await prisma.organization.findUnique({
      where: { id: quote.orgId },
      select: {
        name: true,
        logoUrl: true,
        businessName: true,
        businessAddress: true,
        businessCity: true,
        businessProvince: true,
        businessPostal: true,
        businessCountry: true,
        businessPhone: true,
        businessEmail: true,
        gstNumber: true,
        qstNumber: true,
        wireInstructions: true,
        checkInstructions: true
      }
    })

    // Log that client viewed the quote (only if not already viewed)
    if (!quote.emailOpenedAt) {
      await prisma.clientQuote.update({
        where: { id: quote.id },
        data: { emailOpenedAt: new Date() }
      })

      // Create activity for view
      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: quote.id,
          type: 'VIEWED_BY_CLIENT',
          description: 'Client viewed the quote'
        }
      })

      // Create item activities
      for (const lineItem of quote.lineItems) {
        if (lineItem.roomFFEItemId) {
          await prisma.itemActivity.create({
            data: {
              itemId: lineItem.roomFFEItemId,
              type: 'CLIENT_QUOTE_VIEWED',
              title: 'Client Viewed Quote',
              description: `Client viewed quote ${quote.quoteNumber}`,
              actorType: 'client',
              metadata: {
                quoteId: quote.id,
                quoteNumber: quote.quoteNumber
              }
            }
          })
        }
      }
    }

    // Check if quote is expired
    const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date()

    // Calculate paid amount
    const paidAmount = quote.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const remainingAmount = Number(quote.totalAmount) - paidAmount

    return NextResponse.json({
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        description: quote.description,
        status: quote.status,
        isExpired,
        validUntil: quote.validUntil,
        createdAt: quote.createdAt,
        // Pricing
        subtotal: Number(quote.subtotal),
        gstRate: Number(quote.gstRate),
        gstAmount: Number(quote.gstAmount),
        qstRate: Number(quote.qstRate),
        qstAmount: Number(quote.qstAmount),
        totalAmount: Number(quote.totalAmount),
        paidAmount,
        remainingAmount,
        currency: quote.currency,
        // CC Surcharge
        ccSurchargePercent: Number(quote.ccSurchargePercent) || 3,
        // Client info
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        // Payment status
        selectedPaymentMethod: quote.selectedPaymentMethod,
        // Line items
        lineItems: quote.lineItems.map(li => ({
          id: li.id,
          name: li.displayName,
          description: li.displayDescription,
          categoryName: li.categoryName,
          roomName: li.roomName,
          quantity: li.quantity,
          unitType: li.unitType,
          unitPrice: Number(li.clientUnitPrice),
          totalPrice: Number(li.clientTotalPrice)
        })),
        // Project info
        projectName: quote.project?.name
      },
      organization: {
        name: organization?.businessName || organization?.name || 'Company',
        logoUrl: organization?.logoUrl,
        address: organization?.businessAddress,
        city: organization?.businessCity,
        province: organization?.businessProvince,
        postal: organization?.businessPostal,
        country: organization?.businessCountry,
        phone: organization?.businessPhone,
        email: organization?.businessEmail,
        gstNumber: organization?.gstNumber,
        qstNumber: organization?.qstNumber,
        wireInstructions: organization?.wireInstructions,
        checkInstructions: organization?.checkInstructions
      }
    })
  } catch (error) {
    console.error('Error fetching quote:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/quote/[token]
 * Handle client actions on quote (accept, decline, select payment method)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { action, paymentMethod, message } = body

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const quote = await prisma.clientQuote.findUnique({
      where: { accessToken: token },
      include: { lineItems: true }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Check if quote is expired
    if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
      return NextResponse.json({ error: 'Quote has expired' }, { status: 400 })
    }

    // Handle different actions
    if (action === 'accept') {
      await prisma.clientQuote.update({
        where: { id: quote.id },
        data: {
          status: 'APPROVED',
          clientDecision: 'ACCEPTED',
          clientDecidedAt: new Date(),
          clientMessage: message || null
        }
      })

      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: quote.id,
          type: 'APPROVED',
          description: 'Client accepted the quote'
        }
      })

      return NextResponse.json({ success: true, message: 'Quote accepted' })
    }

    if (action === 'decline') {
      await prisma.clientQuote.update({
        where: { id: quote.id },
        data: {
          status: 'REJECTED',
          clientDecision: 'DECLINED',
          clientDecidedAt: new Date(),
          clientMessage: message || null
        }
      })

      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: quote.id,
          type: 'REJECTED',
          description: `Client declined the quote${message ? `: ${message}` : ''}`
        }
      })

      return NextResponse.json({ success: true, message: 'Quote declined' })
    }

    if (action === 'select-payment') {
      if (!paymentMethod) {
        return NextResponse.json({ error: 'Payment method is required' }, { status: 400 })
      }

      await prisma.clientQuote.update({
        where: { id: quote.id },
        data: {
          selectedPaymentMethod: paymentMethod
        }
      })

      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: quote.id,
          type: 'PAYMENT_METHOD_SELECTED',
          description: `Client selected ${paymentMethod} as payment method`
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Payment method selected',
        paymentMethod
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error processing quote action:', error)
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    )
  }
}
