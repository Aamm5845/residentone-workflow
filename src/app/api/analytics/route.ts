import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/analytics
 * Get aggregated analytics and dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { searchParams } = new URL(request.url)

    const reportType = searchParams.get('type') || 'overview'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: any = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    switch (reportType) {
      case 'overview':
        return NextResponse.json(await getOverviewReport(orgId, dateFilter))
      case 'financial':
        return NextResponse.json(await getFinancialReport(orgId, dateFilter))
      case 'procurement':
        return NextResponse.json(await getProcurementReport(orgId, dateFilter))
      case 'projects':
        return NextResponse.json(await getProjectsReport(orgId, dateFilter))
      case 'suppliers':
        return NextResponse.json(await getSuppliersReport(orgId, dateFilter))
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Analytics] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}

async function getOverviewReport(orgId: string, dateFilter: any) {
  const createdAtFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}

  // Get counts
  const [
    activeProjects,
    totalProjects,
    totalClients,
    totalSuppliers,
    pendingOrders,
    totalOrders,
    pendingDeliveries,
    openRfqs,
    pendingQuotes
  ] = await Promise.all([
    prisma.project.count({
      where: { orgId, status: { in: ['ACTIVE', 'IN_PROGRESS', 'URGENT'] } }
    }),
    prisma.project.count({ where: { orgId, ...createdAtFilter } }),
    prisma.client.count({ where: { orgId } }),
    prisma.supplier.count({ where: { orgId } }),
    prisma.order.count({
      where: { orgId, status: { in: ['PENDING', 'PROCESSING', 'SHIPPED'] } }
    }),
    prisma.order.count({ where: { orgId, ...createdAtFilter } }),
    prisma.delivery.count({
      where: {
        order: { orgId },
        status: { in: ['PENDING', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'] }
      }
    }),
    prisma.rFQ.count({
      where: { orgId, status: { in: ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED'] }, ...createdAtFilter }
    }),
    prisma.clientQuote.count({
      where: { orgId, status: 'PENDING_APPROVAL', ...createdAtFilter }
    })
  ])

  // Get financial summary
  const payments = await prisma.payment.findMany({
    where: { orgId, ...createdAtFilter },
    select: { amount: true, status: true }
  })

  const totalReceived = payments
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const totalPending = payments
    .filter(p => p.status === 'PENDING')
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  // Get recent activity
  const recentProjects = await prisma.project.findMany({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      name: true,
      projectNumber: true,
      status: true,
      updatedAt: true,
      client: { select: { name: true } }
    }
  })

  return {
    summary: {
      activeProjects,
      totalProjects,
      totalClients,
      totalSuppliers,
      pendingOrders,
      totalOrders,
      pendingDeliveries,
      openRfqs,
      pendingQuotes
    },
    financial: {
      totalReceived,
      totalPending
    },
    recentProjects
  }
}

async function getFinancialReport(orgId: string, dateFilter: any) {
  const createdAtFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}

  // Get all payments
  const payments = await prisma.payment.findMany({
    where: { orgId, ...createdAtFilter },
    include: {
      project: { select: { id: true, name: true, projectNumber: true } },
      clientQuote: { select: { id: true, quoteNumber: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Get client quotes
  const quotes = await prisma.clientQuote.findMany({
    where: { orgId, ...createdAtFilter },
    select: {
      id: true,
      quoteNumber: true,
      totalAmount: true,
      status: true,
      project: { select: { id: true, name: true } }
    }
  })

  // Calculate totals by status
  const paymentsByStatus = payments.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + (p.amount || 0)
    return acc
  }, {} as Record<string, number>)

  const quotesByStatus = quotes.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + (q.totalAmount || 0)
    return acc
  }, {} as Record<string, number>)

  // Monthly revenue (last 12 months)
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const date = new Date()
    date.setMonth(date.getMonth() - i)
    const month = date.toLocaleString('en-CA', { month: 'short', year: 'numeric' })
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)

    const monthPayments = payments.filter(p => {
      const pDate = new Date(p.createdAt)
      return pDate >= startOfMonth && pDate <= endOfMonth && p.status === 'COMPLETED'
    })

    return {
      month,
      revenue: monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
      count: monthPayments.length
    }
  }).reverse()

  return {
    summary: {
      totalRevenue: paymentsByStatus['COMPLETED'] || 0,
      pendingPayments: paymentsByStatus['PENDING'] || 0,
      failedPayments: paymentsByStatus['FAILED'] || 0,
      totalQuotedValue: Object.values(quotesByStatus).reduce((a, b) => a + b, 0),
      approvedQuotesValue: quotesByStatus['APPROVED'] || 0,
      pendingQuotesValue: quotesByStatus['PENDING_APPROVAL'] || 0
    },
    paymentsByStatus,
    quotesByStatus,
    monthlyData,
    recentPayments: payments.slice(0, 10)
  }
}

async function getProcurementReport(orgId: string, dateFilter: any) {
  const createdAtFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}

  // Get RFQs
  const rfqs = await prisma.rFQ.findMany({
    where: { orgId, ...createdAtFilter },
    include: {
      project: { select: { id: true, name: true } },
      supplierRfqs: {
        include: {
          supplier: { select: { id: true, name: true } },
          supplierQuote: { select: { id: true, status: true, totalAmount: true } }
        }
      }
    }
  })

  // Get supplier quotes
  const supplierQuotes = await prisma.supplierQuote.findMany({
    where: {
      supplierRfq: { rfq: { orgId } },
      ...createdAtFilter
    },
    include: {
      supplierRfq: {
        include: {
          supplier: { select: { id: true, name: true } },
          rfq: { select: { id: true, rfqNumber: true, title: true } }
        }
      }
    }
  })

  // Calculate metrics
  const rfqsByStatus = rfqs.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const quotesByStatus = supplierQuotes.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Response rate
  const totalSent = rfqs.reduce((sum, r) => sum + r.supplierRfqs.length, 0)
  const totalResponded = supplierQuotes.length
  const responseRate = totalSent > 0 ? (totalResponded / totalSent) * 100 : 0

  // Average lead time
  const quotesWithLeadTime = supplierQuotes.filter(q => q.estimatedLeadTime)
  const avgLeadTime = quotesWithLeadTime.length > 0
    ? quotesWithLeadTime.reduce((sum, q) => sum + parseInt(q.estimatedLeadTime || '0'), 0) / quotesWithLeadTime.length
    : 0

  return {
    summary: {
      totalRfqs: rfqs.length,
      openRfqs: (rfqsByStatus['DRAFT'] || 0) + (rfqsByStatus['SENT'] || 0) + (rfqsByStatus['PARTIALLY_RECEIVED'] || 0),
      completedRfqs: rfqsByStatus['COMPLETED'] || 0,
      totalQuotes: supplierQuotes.length,
      acceptedQuotes: quotesByStatus['ACCEPTED'] || 0,
      responseRate: Math.round(responseRate),
      avgLeadTimeWeeks: Math.round(avgLeadTime)
    },
    rfqsByStatus,
    quotesByStatus,
    recentRfqs: rfqs.slice(0, 10).map(r => ({
      id: r.id,
      rfqNumber: r.rfqNumber,
      title: r.title,
      status: r.status,
      project: r.project,
      suppliersCount: r.supplierRfqs.length,
      quotesReceived: r.supplierRfqs.filter(sr => sr.supplierQuote).length,
      createdAt: r.createdAt
    }))
  }
}

async function getProjectsReport(orgId: string, dateFilter: any) {
  const createdAtFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}

  const projects = await prisma.project.findMany({
    where: { orgId, ...createdAtFilter },
    include: {
      client: { select: { id: true, name: true } },
      orders: { select: { id: true, status: true, totalAmount: true } },
      clientQuotes: { select: { id: true, status: true, totalAmount: true } },
      _count: {
        select: {
          orders: true,
          rfqs: true,
          ffeSpecs: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  const projectsByStatus = projects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Calculate project values
  const projectsWithValue = projects.map(p => {
    const quotedValue = p.clientQuotes.reduce((sum, q) => sum + (q.totalAmount || 0), 0)
    const orderValue = p.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
    return {
      id: p.id,
      name: p.name,
      projectNumber: p.projectNumber,
      status: p.status,
      client: p.client,
      quotedValue,
      orderValue,
      ordersCount: p._count.orders,
      rfqsCount: p._count.rfqs,
      ffeSpecsCount: p._count.ffeSpecs,
      createdAt: p.createdAt
    }
  })

  const totalQuotedValue = projectsWithValue.reduce((sum, p) => sum + p.quotedValue, 0)
  const totalOrderValue = projectsWithValue.reduce((sum, p) => sum + p.orderValue, 0)

  return {
    summary: {
      totalProjects: projects.length,
      activeProjects: (projectsByStatus['ACTIVE'] || 0) + (projectsByStatus['IN_PROGRESS'] || 0),
      urgentProjects: projectsByStatus['URGENT'] || 0,
      completedProjects: projectsByStatus['COMPLETED'] || 0,
      totalQuotedValue,
      totalOrderValue
    },
    projectsByStatus,
    projects: projectsWithValue
  }
}

async function getSuppliersReport(orgId: string, dateFilter: any) {
  const createdAtFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}

  const suppliers = await prisma.supplier.findMany({
    where: { orgId },
    include: {
      supplierRfqs: {
        where: createdAtFilter,
        include: {
          supplierQuote: { select: { id: true, status: true, totalAmount: true } }
        }
      },
      orders: {
        where: createdAtFilter,
        select: { id: true, status: true, totalAmount: true }
      },
      _count: {
        select: {
          supplierRfqs: true,
          orders: true
        }
      }
    }
  })

  const supplierMetrics = suppliers.map(s => {
    const rfqsReceived = s.supplierRfqs.length
    const quotesSubmitted = s.supplierRfqs.filter(sr => sr.supplierQuote).length
    const quotesAccepted = s.supplierRfqs.filter(sr => sr.supplierQuote?.status === 'ACCEPTED').length
    const responseRate = rfqsReceived > 0 ? (quotesSubmitted / rfqsReceived) * 100 : 0
    const winRate = quotesSubmitted > 0 ? (quotesAccepted / quotesSubmitted) * 100 : 0
    const totalOrderValue = s.orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)

    return {
      id: s.id,
      name: s.name,
      email: s.email,
      category: s.category,
      status: s.status,
      rfqsReceived,
      quotesSubmitted,
      quotesAccepted,
      responseRate: Math.round(responseRate),
      winRate: Math.round(winRate),
      ordersCount: s.orders.length,
      totalOrderValue
    }
  })

  // Sort by order value
  supplierMetrics.sort((a, b) => b.totalOrderValue - a.totalOrderValue)

  const activeSuppliers = suppliers.filter(s => s.status === 'ACTIVE').length
  const totalOrderValue = supplierMetrics.reduce((sum, s) => sum + s.totalOrderValue, 0)
  const avgResponseRate = supplierMetrics.length > 0
    ? supplierMetrics.reduce((sum, s) => sum + s.responseRate, 0) / supplierMetrics.length
    : 0

  return {
    summary: {
      totalSuppliers: suppliers.length,
      activeSuppliers,
      totalOrderValue,
      avgResponseRate: Math.round(avgResponseRate)
    },
    suppliers: supplierMetrics,
    topSuppliers: supplierMetrics.slice(0, 5)
  }
}
