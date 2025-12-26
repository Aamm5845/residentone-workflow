import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/client-portal/[token]
 * Get client portal data for a project using access token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find the access token
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

    // Update access stats
    await prisma.clientAccessToken.update({
      where: { id: accessToken.id },
      data: {
        lastAccessedAt: new Date(),
        accessCount: { increment: 1 }
      }
    })

    const projectId = accessToken.projectId
    const orgId = accessToken.project.orgId

    // Fetch all client-facing data
    const [clientQuotes, orders] = await Promise.all([
      // Get client quotes for this project
      prisma.clientQuote.findMany({
        where: {
          projectId,
          status: { not: 'DRAFT' } // Don't show drafts to clients
        },
        include: {
          lineItems: {
            select: {
              id: true,
              itemName: true,
              itemDescription: true,
              quantity: true,
              unitType: true,
              sellingPrice: true,
              totalPrice: true,
              groupId: true
            },
            orderBy: { order: 'asc' }
          },
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              paidAt: true
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),

      // Get orders for this project (only show confirmed/shipped)
      prisma.order.findMany({
        where: {
          projectId,
          status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED'] }
        },
        include: {
          items: {
            select: {
              id: true,
              name: true,
              description: true,
              quantity: true,
              unitType: true
            }
          },
          deliveries: {
            select: {
              id: true,
              status: true,
              carrier: true,
              trackingNumber: true,
              trackingUrl: true,
              expectedDate: true,
              actualDate: true,
              notes: true
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    ])

    // Calculate payment summary
    const paymentSummary = {
      totalQuoted: 0,
      totalPaid: 0,
      totalPending: 0
    }

    for (const quote of clientQuotes) {
      if (quote.status === 'APPROVED') {
        paymentSummary.totalQuoted += parseFloat(quote.totalAmount?.toString() || quote.subtotal?.toString() || '0')

        for (const payment of quote.payments) {
          if (payment.status === 'PAID') {
            paymentSummary.totalPaid += parseFloat(payment.amount.toString())
          }
        }
      }
    }
    paymentSummary.totalPending = paymentSummary.totalQuoted - paymentSummary.totalPaid

    return NextResponse.json({
      project: {
        id: accessToken.project.id,
        name: accessToken.project.name,
        status: accessToken.project.status
      },
      client: accessToken.project.client ? {
        name: accessToken.project.client.name,
        email: accessToken.project.client.email
      } : null,
      quotes: clientQuotes.map(quote => ({
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        description: quote.description,
        status: quote.status,
        subtotal: parseFloat(quote.subtotal?.toString() || '0'),
        taxAmount: quote.taxAmount ? parseFloat(quote.taxAmount.toString()) : null,
        totalAmount: quote.totalAmount ? parseFloat(quote.totalAmount.toString()) : null,
        validUntil: quote.validUntil,
        paymentTerms: quote.paymentTerms,
        depositRequired: quote.depositRequired,
        depositAmount: quote.depositAmount ? parseFloat(quote.depositAmount.toString()) : null,
        createdAt: quote.createdAt,
        lineItems: quote.lineItems.map(item => ({
          id: item.id,
          name: item.itemName,
          description: item.itemDescription,
          quantity: item.quantity,
          unitType: item.unitType,
          price: parseFloat(item.sellingPrice?.toString() || '0'),
          total: parseFloat(item.totalPrice?.toString() || '0'),
          category: item.groupId
        })),
        payments: quote.payments.map(p => ({
          id: p.id,
          amount: parseFloat(p.amount.toString()),
          method: p.method,
          status: p.status,
          paidAt: p.paidAt
        })),
        amountPaid: quote.payments
          .filter(p => p.status === 'PAID')
          .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)
      })),
      orders: orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        createdAt: order.createdAt,
        items: order.items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unitType: item.unitType
        })),
        deliveries: order.deliveries.map(d => ({
          id: d.id,
          status: d.status,
          carrier: d.carrier,
          trackingNumber: d.trackingNumber,
          trackingUrl: d.trackingUrl,
          scheduledDate: d.expectedDate,
          deliveredAt: d.actualDate,
          notes: d.notes
        }))
      })),
      paymentSummary
    })
  } catch (error) {
    console.error('[ClientPortal] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load client portal' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/client-portal/[token]
 * Handle client actions (approve quote, make payment, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { action, quoteId, decision, message } = body

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
        project: true
      }
    })

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Invalid or expired access link' },
        { status: 401 }
      )
    }

    const projectId = accessToken.projectId
    const orgId = accessToken.project.orgId

    if (action === 'respond_to_quote') {
      if (!quoteId || !decision) {
        return NextResponse.json(
          { error: 'Quote ID and decision required' },
          { status: 400 }
        )
      }

      // Verify quote belongs to this project
      const quote = await prisma.clientQuote.findFirst({
        where: { id: quoteId, projectId }
      })

      if (!quote) {
        return NextResponse.json(
          { error: 'Quote not found' },
          { status: 404 }
        )
      }

      if (quote.status !== 'SENT_TO_CLIENT' && quote.status !== 'CLIENT_REVIEWING') {
        return NextResponse.json(
          { error: 'Quote is not awaiting response' },
          { status: 400 }
        )
      }

      // Update quote with client decision
      const newStatus = decision === 'approved' ? 'APPROVED' :
                       decision === 'rejected' ? 'REJECTED' :
                       'REVISION_REQUESTED'

      await prisma.clientQuote.update({
        where: { id: quoteId },
        data: {
          status: newStatus,
          clientDecision: decision,
          clientDecidedAt: new Date(),
          clientMessage: message || null
        }
      })

      // Log activity
      await prisma.clientQuoteActivity.create({
        data: {
          clientQuoteId: quoteId,
          type: `CLIENT_${decision.toUpperCase()}`,
          message: `Client ${decision} the quote via portal${message ? `: ${message}` : ''}`
        }
      })

      return NextResponse.json({ success: true, status: newStatus })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[ClientPortal] POST Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
