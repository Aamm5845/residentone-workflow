import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/projects/[id]/procurement/inbox
 * Get inbox notifications for a project's procurement
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const orgId = (session.user as any).orgId

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId },
      select: { id: true, name: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const inboxItems: any[] = []
    const now = new Date()

    // 1. Get recent supplier quotes (received in last 30 days)
    const rfqs = await prisma.rFQ.findMany({
      where: { projectId },
      select: { id: true }
    })
    const rfqIds = rfqs.map(r => r.id)

    if (rfqIds.length > 0) {
      const supplierQuotes = await prisma.supplierQuote.findMany({
        where: {
          status: 'SUBMITTED',
          supplierRFQ: {
            rfqId: { in: rfqIds }
          },
          submittedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        },
        include: {
          supplierRFQ: {
            include: {
              supplier: { select: { name: true } },
              rfq: { select: { rfqNumber: true } }
            }
          },
          lineItems: true
        },
        orderBy: { submittedAt: 'desc' },
        take: 20
      })

      for (const quote of supplierQuotes) {
        const supplierName = quote.supplierRFQ.supplier?.name || quote.supplierRFQ.vendorName || 'Supplier'
        const rfqNumber = quote.supplierRFQ.rfq.rfqNumber
        const total = quote.totalAmount ? Number(quote.totalAmount) : 0
        const formattedTotal = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(total)

        // Check if there are mismatches
        const hasMismatches = quote.lineItems.some(li =>
          li.alternateProduct ||
          (li.quantity !== li.rfqLineItemId ? false : false) // Simplified check
        )

        inboxItems.push({
          id: `quote-${quote.id}`,
          type: 'quote_received',
          priority: hasMismatches ? 'warning' : 'normal',
          title: `Quote from ${supplierName}`,
          description: `${quote.lineItems.length} items quoted at ${formattedTotal}`,
          meta: rfqNumber,
          actionLabel: 'Review',
          actionHref: `/projects/${projectId}/procurement?tab=supplier-quotes&quoteId=${quote.id}`,
          createdAt: quote.submittedAt ? formatRelativeTime(quote.submittedAt) : 'Recently',
          quoteId: quote.id
        })
      }

      // 2. Get quotes expiring soon (within 7 days)
      const expiringQuotes = await prisma.supplierQuote.findMany({
        where: {
          status: 'SUBMITTED',
          supplierRFQ: {
            rfqId: { in: rfqIds }
          },
          validUntil: {
            gte: now,
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          supplierRFQ: {
            include: {
              supplier: { select: { name: true } }
            }
          }
        }
      })

      for (const quote of expiringQuotes) {
        const supplierName = quote.supplierRFQ.supplier?.name || 'Supplier'
        const daysLeft = Math.ceil((new Date(quote.validUntil!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        inboxItems.push({
          id: `expiring-${quote.id}`,
          type: 'quote_expiring',
          priority: daysLeft <= 2 ? 'urgent' : 'warning',
          title: `Quote expiring soon`,
          description: `${supplierName}'s quote expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
          meta: `Valid until ${new Date(quote.validUntil!).toLocaleDateString()}`,
          actionLabel: 'Review',
          actionHref: `/projects/${projectId}/procurement?tab=supplier-quotes&quoteId=${quote.id}`,
          createdAt: `${daysLeft}d left`,
          quoteId: quote.id
        })
      }
    }

    // 3. Get overdue orders
    const overdueOrders = await prisma.order.findMany({
      where: {
        projectId,
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
        expectedDelivery: { lt: now }
      },
      include: {
        supplier: { select: { name: true } }
      },
      take: 10
    })

    for (const order of overdueOrders) {
      const daysOverdue = Math.ceil((now.getTime() - new Date(order.expectedDelivery!).getTime()) / (1000 * 60 * 60 * 24))

      inboxItems.push({
        id: `overdue-${order.id}`,
        type: 'order_overdue',
        priority: 'urgent',
        title: `Order overdue`,
        description: `${order.supplier?.name || 'Supplier'} - ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} past expected delivery`,
        meta: order.orderNumber,
        actionLabel: 'Track',
        actionHref: `/projects/${projectId}/procurement?tab=orders&orderId=${order.id}`,
        createdAt: `${daysOverdue}d overdue`
      })
    }

    // Sort by priority (urgent first) then by created time
    const priorityOrder = { urgent: 0, warning: 1, normal: 2 }
    inboxItems.sort((a, b) => {
      const pDiff = priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]
      if (pDiff !== 0) return pDiff
      return 0 // Keep original order for same priority
    })

    return NextResponse.json({ items: inboxItems })

  } catch (error) {
    console.error('Error fetching inbox:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inbox' },
      { status: 500 }
    )
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
