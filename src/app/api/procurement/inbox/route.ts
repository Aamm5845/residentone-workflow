import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/procurement/inbox
 * Get inbox notifications across ALL projects for the user's org.
 * Returns items grouped by project with a totalCount for badge display.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

    // Get all projects for this org
    const projects = await prisma.project.findMany({
      where: { orgId },
      select: { id: true, name: true }
    })

    if (projects.length === 0) {
      return NextResponse.json({ projects: [], totalCount: 0 })
    }

    const projectMap = new Map(projects.map(p => [p.id, p.name]))
    const projectIds = projects.map(p => p.id)
    const now = new Date()

    // Collect all items across all projects
    const allItems: any[] = []

    // ========================================
    // 1. RFQ / SUPPLIER SIDE SCENARIOS
    // ========================================

    // Get all RFQ IDs across all projects
    const rfqs = await prisma.rFQ.findMany({
      where: { projectId: { in: projectIds } },
      select: { id: true, projectId: true }
    })
    const rfqIds = rfqs.map(r => r.id)
    const rfqProjectMap = new Map(rfqs.map(r => [r.id, r.projectId]))

    if (rfqIds.length > 0) {
      // 1a. Recent supplier quotes (received in last 30 days)
      const supplierQuotes = await prisma.supplierQuote.findMany({
        where: {
          status: 'SUBMITTED',
          supplierRFQ: {
            rfqId: { in: rfqIds }
          },
          submittedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          supplierRFQ: {
            include: {
              supplier: { select: { name: true } },
              rfq: { select: { rfqNumber: true, projectId: true } }
            }
          },
          lineItems: true
        },
        orderBy: { submittedAt: 'desc' },
        take: 50
      })

      for (const quote of supplierQuotes) {
        const supplierName = quote.supplierRFQ.supplier?.name || quote.supplierRFQ.vendorName || 'Supplier'
        const rfqNumber = quote.supplierRFQ.rfq.rfqNumber
        const total = quote.totalAmount ? Number(quote.totalAmount) : 0
        const formattedTotal = formatCurrency(total)
        const leadTime = quote.estimatedLeadTime || ''
        const projectId = quote.supplierRFQ.rfq.projectId

        const hasMismatches = quote.lineItems.some(li => li.alternateProduct)

        allItems.push({
          id: `quote-${quote.id}`,
          type: 'quote_received',
          priority: hasMismatches ? 'warning' : 'normal',
          title: `Supplier quote received`,
          description: supplierName,
          meta: `${rfqNumber} • ${quote.lineItems.length} items • ${formattedTotal}${leadTime ? ` • ${leadTime}` : ''}`,
          actionLabel: 'Review Quote',
          actionHref: `/projects/${projectId}/procurement?tab=supplier-quotes&quoteId=${quote.id}`,
          createdAt: quote.submittedAt ? formatRelativeTime(quote.submittedAt) : 'Recently',
          projectId,
          projectName: projectMap.get(projectId) || 'Unknown Project',
        })
      }

      // 1b. Quotes expiring soon (within 7 days)
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
              supplier: { select: { name: true } },
              rfq: { select: { projectId: true } }
            }
          }
        }
      })

      for (const quote of expiringQuotes) {
        const supplierName = quote.supplierRFQ.supplier?.name || 'Supplier'
        const daysLeft = Math.ceil((new Date(quote.validUntil!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        const projectId = quote.supplierRFQ.rfq.projectId

        allItems.push({
          id: `expiring-${quote.id}`,
          type: 'quote_expiring',
          priority: daysLeft <= 2 ? 'urgent' : 'warning',
          title: `Quote expiring in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
          description: supplierName,
          meta: `Valid until ${new Date(quote.validUntil!).toLocaleDateString()}`,
          actionLabel: 'Review Now',
          actionHref: `/projects/${projectId}/procurement?tab=supplier-quotes&quoteId=${quote.id}`,
          createdAt: `${daysLeft}d left`,
          projectId,
          projectName: projectMap.get(projectId) || 'Unknown Project',
        })
      }

      // 1c. Declined RFQs (last 7 days)
      const declinedRFQs = await prisma.supplierRFQ.findMany({
        where: {
          rfqId: { in: rfqIds },
          responseStatus: 'DECLINED',
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        include: {
          supplier: { select: { name: true } },
          rfq: { select: { rfqNumber: true, projectId: true } }
        }
      })

      for (const srfq of declinedRFQs) {
        const supplierName = srfq.supplier?.name || srfq.vendorName || 'Supplier'
        const projectId = srfq.rfq.projectId

        allItems.push({
          id: `declined-${srfq.id}`,
          type: 'supplier_declined',
          priority: 'urgent',
          title: `Supplier declined RFQ`,
          description: supplierName,
          meta: srfq.rfq.rfqNumber,
          actionLabel: 'Send to Another',
          actionHref: `/projects/${projectId}/procurement?tab=rfq`,
          createdAt: formatRelativeTime(srfq.updatedAt),
          projectId,
          projectName: projectMap.get(projectId) || 'Unknown Project',
        })
      }
    }

    // ========================================
    // 2. CLIENT BILLING / INVOICE SCENARIOS
    // ========================================

    // 2a. Client viewed invoice but hasn't paid (viewed 2+ days ago)
    const viewedInvoices = await prisma.clientQuote.findMany({
      where: {
        projectId: { in: projectIds },
        orgId,
        status: { notIn: ['DRAFT'] },
        emailOpenedAt: {
          lte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        payments: { where: { status: { in: ['PAID', 'PARTIAL'] } } }
      }
    })

    for (const invoice of viewedInvoices) {
      const totalAmount = Number(invoice.totalAmount) || 0
      const paidAmount = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)

      if (paidAmount < totalAmount && totalAmount > 0) {
        const daysViewed = Math.ceil((now.getTime() - new Date(invoice.emailOpenedAt!).getTime()) / (1000 * 60 * 60 * 24))
        const projectId = invoice.projectId

        allItems.push({
          id: `viewed-${invoice.id}`,
          type: 'invoice_viewed',
          priority: daysViewed >= 5 ? 'warning' : 'normal',
          title: `Client viewed invoice — awaiting payment`,
          description: invoice.clientName || 'Client',
          meta: `${invoice.quoteNumber} • ${formatCurrency(totalAmount - paidAmount)} balance • Viewed ${daysViewed}d ago`,
          actionLabel: 'Send Reminder',
          actionHref: `/projects/${projectId}/procurement?tab=client-invoices&invoiceId=${invoice.id}`,
          createdAt: formatRelativeTime(invoice.emailOpenedAt!),
          projectId,
          projectName: projectMap.get(projectId) || 'Unknown Project',
        })
      }
    }

    // 2b. Invoice overdue (past valid until date, unpaid)
    const overdueInvoices = await prisma.clientQuote.findMany({
      where: {
        projectId: { in: projectIds },
        orgId,
        status: { notIn: ['DRAFT'] },
        sentToClientAt: { not: null },
        validUntil: { lt: now }
      },
      include: {
        payments: { where: { status: { in: ['PAID', 'PARTIAL'] } } }
      }
    })

    for (const invoice of overdueInvoices) {
      const totalAmount = Number(invoice.totalAmount) || 0
      const paidAmount = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)

      if (paidAmount < totalAmount && totalAmount > 0) {
        const daysOverdue = Math.ceil((now.getTime() - new Date(invoice.validUntil!).getTime()) / (1000 * 60 * 60 * 24))
        const projectId = invoice.projectId

        allItems.push({
          id: `overdue-invoice-${invoice.id}`,
          type: 'invoice_overdue',
          priority: 'urgent',
          title: `Invoice overdue`,
          description: invoice.clientName || 'Client',
          meta: `${invoice.quoteNumber} • ${formatCurrency(totalAmount - paidAmount)} balance • ${daysOverdue}d overdue`,
          actionLabel: 'Send Reminder',
          actionHref: `/projects/${projectId}/procurement?tab=client-invoices&invoiceId=${invoice.id}`,
          createdAt: `${daysOverdue}d overdue`,
          projectId,
          projectName: projectMap.get(projectId) || 'Unknown Project',
        })
      }
    }

    // 2c. Payment received — create orders
    const paidInvoicesWithoutOrders = await prisma.clientQuote.findMany({
      where: {
        projectId: { in: projectIds },
        orgId,
        payments: {
          some: { status: { in: ['PAID', 'PARTIAL'] } }
        }
      },
      include: {
        payments: { where: { status: { in: ['PAID', 'PARTIAL'] } } },
        lineItems: {
          include: {
            roomFFEItem: {
              select: { specStatus: true }
            }
          }
        }
      }
    })

    for (const invoice of paidInvoicesWithoutOrders) {
      const totalAmount = Number(invoice.totalAmount) || 0
      const paidAmount = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)
      const isPaid = paidAmount >= totalAmount && totalAmount > 0
      const projectId = invoice.projectId

      const itemsNotOrdered = invoice.lineItems.filter(li =>
        li.roomFFEItem &&
        !['ORDERED', 'SHIPPED', 'RECEIVED', 'DELIVERED', 'INSTALLED', 'CLOSED'].includes(li.roomFFEItem.specStatus)
      )

      if (itemsNotOrdered.length > 0) {
        if (isPaid) {
          allItems.push({
            id: `create-orders-${invoice.id}`,
            type: 'payment_received',
            priority: 'urgent',
            title: `Payment received — create orders`,
            description: invoice.clientName || 'Client',
            meta: `${invoice.quoteNumber} • ${formatCurrency(paidAmount)} paid • ${itemsNotOrdered.length} items to order`,
            actionLabel: 'Create Orders',
            actionHref: `/projects/${projectId}/procurement?tab=orders`,
            createdAt: invoice.payments[0] ? formatRelativeTime(invoice.payments[0].paidAt || invoice.payments[0].createdAt) : 'Recently',
            projectId,
            projectName: projectMap.get(projectId) || 'Unknown Project',
          })
        } else if (paidAmount > 0) {
          allItems.push({
            id: `partial-${invoice.id}`,
            type: 'partial_payment',
            priority: 'warning',
            title: `Partial payment received`,
            description: invoice.clientName || 'Client',
            meta: `${invoice.quoteNumber} • ${formatCurrency(paidAmount)} of ${formatCurrency(totalAmount)} paid`,
            actionLabel: 'Review Invoice',
            actionHref: `/projects/${projectId}/procurement?tab=client-invoices&invoiceId=${invoice.id}`,
            createdAt: invoice.payments[0] ? formatRelativeTime(invoice.payments[0].paidAt || invoice.payments[0].createdAt) : 'Recently',
            projectId,
            projectName: projectMap.get(projectId) || 'Unknown Project',
          })
        }
      }
    }

    // ========================================
    // 3. ORDERS / SUPPLIER PAYMENT SCENARIOS
    // ========================================

    // 3a. Order created but supplier not paid
    const unpaidOrders = await prisma.order.findMany({
      where: {
        projectId: { in: projectIds },
        status: { notIn: ['CANCELLED'] },
        supplierPaidAt: null,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      include: {
        supplier: { select: { name: true } }
      },
      take: 50
    })

    for (const order of unpaidOrders) {
      const total = Number(order.totalAmount) || 0
      const projectId = order.projectId

      allItems.push({
        id: `supplier-payment-${order.id}`,
        type: 'supplier_payment_pending',
        priority: 'warning',
        title: `Supplier payment pending`,
        description: order.supplier?.name || 'Supplier',
        meta: `${order.orderNumber} • ${formatCurrency(total)}`,
        actionLabel: 'Mark Paid',
        actionHref: `/projects/${projectId}/procurement?tab=orders&orderId=${order.id}`,
        createdAt: formatRelativeTime(order.createdAt),
        projectId,
        projectName: projectMap.get(projectId) || 'Unknown Project',
      })
    }

    // 3b. Order overdue based on lead time
    const overdueOrders = await prisma.order.findMany({
      where: {
        projectId: { in: projectIds },
        status: { notIn: ['DELIVERED', 'CANCELLED', 'SHIPPED'] },
        expectedDelivery: { lt: now }
      },
      include: {
        supplier: { select: { name: true } }
      },
      take: 50
    })

    for (const order of overdueOrders) {
      const daysOverdue = Math.ceil((now.getTime() - new Date(order.expectedDelivery!).getTime()) / (1000 * 60 * 60 * 24))
      const projectId = order.projectId

      allItems.push({
        id: `overdue-${order.id}`,
        type: 'order_overdue',
        priority: 'urgent',
        title: `Order overdue — follow up needed`,
        description: order.supplier?.name || 'Supplier',
        meta: `${order.orderNumber} • ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} past expected`,
        actionLabel: 'Request Update',
        actionHref: `/projects/${projectId}/procurement?tab=orders&orderId=${order.id}`,
        createdAt: `${daysOverdue}d overdue`,
        projectId,
        projectName: projectMap.get(projectId) || 'Unknown Project',
      })
    }

    // 3c. Shipped but tracking missing
    const shippedNoTracking = await prisma.order.findMany({
      where: {
        projectId: { in: projectIds },
        status: 'SHIPPED',
        OR: [
          { trackingNumber: null },
          { trackingNumber: '' }
        ]
      },
      include: {
        supplier: { select: { name: true } }
      },
      take: 50
    })

    for (const order of shippedNoTracking) {
      const projectId = order.projectId

      allItems.push({
        id: `tracking-${order.id}`,
        type: 'tracking_missing',
        priority: 'warning',
        title: `Tracking missing for shipment`,
        description: order.supplier?.name || 'Supplier',
        meta: order.orderNumber,
        actionLabel: 'Add Tracking',
        actionHref: `/projects/${projectId}/procurement?tab=orders&orderId=${order.id}`,
        createdAt: formatRelativeTime(order.updatedAt),
        projectId,
        projectName: projectMap.get(projectId) || 'Unknown Project',
      })
    }

    // ========================================
    // 4. DELIVERY SCENARIOS
    // ========================================

    // 4a. Delivery arrived, not marked received
    const deliveredNotReceived = await prisma.order.findMany({
      where: {
        projectId: { in: projectIds },
        status: 'DELIVERED'
      },
      include: {
        supplier: { select: { name: true } }
      },
      take: 50
    })

    for (const order of deliveredNotReceived) {
      const projectId = order.projectId

      allItems.push({
        id: `confirm-${order.id}`,
        type: 'delivery_confirm',
        priority: 'normal',
        title: `Delivery received — confirm`,
        description: order.supplier?.name || 'Supplier',
        meta: order.orderNumber,
        actionLabel: 'Mark Received',
        actionHref: `/projects/${projectId}/procurement?tab=delivery&orderId=${order.id}`,
        createdAt: formatRelativeTime(order.updatedAt),
        projectId,
        projectName: projectMap.get(projectId) || 'Unknown Project',
      })
    }

    // 4b. Delivery exception/issue
    const deliveryExceptions = await prisma.order.findMany({
      where: {
        projectId: { in: projectIds },
        status: 'EXCEPTION'
      },
      include: {
        supplier: { select: { name: true } }
      },
      take: 50
    })

    for (const order of deliveryExceptions) {
      const projectId = order.projectId

      allItems.push({
        id: `exception-${order.id}`,
        type: 'delivery_exception',
        priority: 'urgent',
        title: `Delivery issue reported`,
        description: order.supplier?.name || 'Supplier',
        meta: order.orderNumber,
        actionLabel: 'View Details',
        actionHref: `/projects/${projectId}/procurement?tab=delivery&orderId=${order.id}`,
        createdAt: formatRelativeTime(order.updatedAt),
        projectId,
        projectName: projectMap.get(projectId) || 'Unknown Project',
      })
    }

    // Sort by priority (urgent first)
    const priorityOrder = { urgent: 0, warning: 1, normal: 2 }
    allItems.sort((a, b) => {
      const pDiff = priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]
      if (pDiff !== 0) return pDiff
      return 0
    })

    // Group items by project (only projects with items)
    const projectGroups: Record<string, { projectId: string; projectName: string; items: any[] }> = {}

    for (const item of allItems) {
      if (!projectGroups[item.projectId]) {
        projectGroups[item.projectId] = {
          projectId: item.projectId,
          projectName: item.projectName,
          items: [],
        }
      }
      projectGroups[item.projectId].items.push(item)
    }

    const projects_with_items = Object.values(projectGroups)

    return NextResponse.json({
      projects: projects_with_items,
      totalCount: allItems.length,
    })

  } catch (error) {
    console.error('Error fetching global procurement inbox:', error)
    return NextResponse.json(
      { error: 'Failed to fetch procurement inbox' },
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
}
