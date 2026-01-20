import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'
import { getBaseUrl } from '@/lib/get-base-url'

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

    // Get invoice by accessToken only (SECURITY: prevent ID enumeration attacks)
    const invoice = await prisma.clientQuote.findFirst({
      where: {
        accessToken: id
      },
      include: {
        lineItems: {
          include: {
            roomFFEItem: {
              select: {
                images: true,
                name: true
              }
            }
          }
        },
        project: {
          select: {
            name: true,
            orgId: true,
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

    // Get organization for branding
    const organization = invoice ? await prisma.organization.findUnique({
      where: { id: invoice.orgId },
      select: {
        businessName: true,
        logoUrl: true
      }
    }) : null

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Calculate total with CC fee (3%)
    const subtotal = Number(invoice.totalAmount) || 0
    const ccFeeRate = 3
    const ccFee = subtotal * (ccFeeRate / 100)
    const totalWithFee = Math.round((subtotal + ccFee) * 100) // Stripe uses cents

    // Get base URL (always uses production URL on Vercel)
    const baseUrl = getBaseUrl()

    // Build line items with images for a nicer checkout
    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []

    // Add individual items (up to 10 for cleaner display)
    const displayItems = invoice.lineItems.slice(0, 10)
    for (const item of displayItems) {
      const images = (item.roomFFEItem?.images as string[]) || []
      const imageUrl = images.length > 0 ? images[0] : undefined

      // Item price in cents (without CC fee - we add it separately)
      const itemTotal = Math.round((Number(item.clientTotalPrice) || 0) * 100)

      stripeLineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: item.displayName || 'Item',
            description: item.displayDescription || undefined,
            images: imageUrl ? [imageUrl] : undefined,
          },
          unit_amount: itemTotal,
        },
        quantity: 1,
      })
    }

    // If there are more items, add a summary line
    if (invoice.lineItems.length > 10) {
      const remainingItems = invoice.lineItems.slice(10)
      const remainingTotal = remainingItems.reduce((sum, item) => sum + (Number(item.clientTotalPrice) || 0), 0)
      const remainingTotalCents = Math.round(remainingTotal * 100)

      stripeLineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: `+ ${invoice.lineItems.length - 10} more items`,
            description: `Additional items from invoice ${invoice.quoteNumber}`,
          },
          unit_amount: remainingTotalCents,
        },
        quantity: 1,
      })
    }

    // Add GST if applicable
    const gstAmount = Number(invoice.gstAmount) || 0
    if (gstAmount > 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: `GST (${invoice.gstRate || 5}%)`,
            description: 'Goods and Services Tax',
          },
          unit_amount: Math.round(gstAmount * 100),
        },
        quantity: 1,
      })
    }

    // Add QST if applicable
    const qstAmount = Number(invoice.qstAmount) || 0
    if (qstAmount > 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: `QST (${invoice.qstRate || 9.975}%)`,
            description: 'Quebec Sales Tax',
          },
          unit_amount: Math.round(qstAmount * 100),
        },
        quantity: 1,
      })
    }

    // Add shipping/delivery if applicable
    const shippingCost = Number(invoice.shippingCost) || 0
    if (shippingCost > 0) {
      stripeLineItems.push({
        price_data: {
          currency: 'cad',
          product_data: {
            name: 'Delivery',
            description: 'Shipping and handling',
          },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      })
    }

    // Add custom fees if applicable
    const customFees = invoice.customFees as { name: string; amount: number }[] | null
    if (customFees && Array.isArray(customFees)) {
      for (const fee of customFees) {
        const feeAmount = Number(fee.amount) || 0
        if (feeAmount > 0) {
          stripeLineItems.push({
            price_data: {
              currency: 'cad',
              product_data: {
                name: fee.name || 'Additional Fee',
              },
              unit_amount: Math.round(feeAmount * 100),
            },
            quantity: 1,
          })
        }
      }
    }

    // Add CC processing fee as separate line item for transparency (3% of total)
    const ccFeeAmount = Math.round(ccFee * 100)
    stripeLineItems.push({
      price_data: {
        currency: 'cad',
        product_data: {
          name: 'Credit Card Processing Fee (3%)',
          description: 'Processing fee for credit card payment',
        },
        unit_amount: ccFeeAmount,
      },
      quantity: 1,
    })

    // Create Stripe checkout session with enhanced options
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: stripeLineItems,
      mode: 'payment',
      success_url: `${baseUrl}/client/invoice/${id}?payment=success`,
      cancel_url: `${baseUrl}/client/invoice/${id}?payment=cancelled`,
      customer_email: invoice.clientEmail || invoice.project.client?.email || undefined,
      // Custom branding
      custom_text: {
        submit: {
          message: `Payment for ${organization?.businessName || 'Invoice'} - ${invoice.quoteNumber}`
        }
      },
      // Allow customers to adjust quantity (disabled for fixed invoice)
      // Collect phone number for order confirmation
      phone_number_collection: {
        enabled: true
      },
      // Show company info
      metadata: {
        invoiceId: invoice.id,
        quoteNumber: invoice.quoteNumber,
        projectName: invoice.project.name,
        companyName: organization?.businessName || '',
      },
      // Stripe branding settings (theme colors can be set in Stripe Dashboard)
      submit_type: 'pay',
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
