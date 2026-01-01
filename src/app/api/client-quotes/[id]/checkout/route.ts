import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-04-30.basil'
})

export const dynamic = 'force-dynamic'

/**
 * POST /api/client-quotes/[id]/checkout
 * Create a Stripe checkout session for invoice payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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
                email: true
              }
            }
          }
        }
      }
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Calculate total with CC fee (3%)
    const subtotal = Number(invoice.totalAmount) || 0
    const ccFeeRate = 3
    const ccFee = subtotal * (ccFeeRate / 100)
    const totalWithFee = Math.round((subtotal + ccFee) * 100) // Stripe uses cents

    // Get base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: `Invoice ${invoice.quoteNumber}`,
              description: `${invoice.title} - ${invoice.project.name}`,
            },
            unit_amount: totalWithFee,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/client/invoice/${id}?payment=success`,
      cancel_url: `${baseUrl}/client/invoice/${id}?payment=cancelled`,
      customer_email: invoice.clientEmail || invoice.project.client?.email || undefined,
      metadata: {
        invoiceId: invoice.id,
        quoteNumber: invoice.quoteNumber,
        projectName: invoice.project.name,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
