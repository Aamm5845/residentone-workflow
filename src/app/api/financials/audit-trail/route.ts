import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

interface AuditEntry {
  id: string
  type: 'CLIENT_QUOTE' | 'ORDER' | 'SUPPLIER_QUOTE' | 'PAYMENT' | 'SUPPLIER_PAYMENT'
  date: Date
  documentNumber: string
  amount: number
  currency: string
  projectId: string
  projectName: string
  status: string
  description: string
  link: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, canSeeFinancials: true, orgId: true },
    })

    if (user?.role !== 'OWNER' && !user?.canSeeFinancials) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const orgId = user.orgId
    if (!orgId) {
      return NextResponse.json({ error: 'No organization' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const typeFilter = searchParams.get('type') || undefined
    const projectFilter = searchParams.get('projectId') || undefined
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const entries: AuditEntry[] = []

    // 1. Client Quotes (invoices sent to client)
    if (!typeFilter || typeFilter === 'CLIENT_QUOTE') {
      const clientQuotes = await prisma.clientQuote.findMany({
        where: {
          orgId,
          status: { not: 'DRAFT' },
          ...(projectFilter ? { projectId: projectFilter } : {}),
          ...(dateFrom || dateTo
            ? {
                createdAt: {
                  ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                  ...(dateTo ? { lte: new Date(dateTo) } : {}),
                },
              }
            : {}),
        },
        select: {
          id: true,
          quoteNumber: true,
          title: true,
          totalAmount: true,
          currency: true,
          status: true,
          createdAt: true,
          projectId: true,
          project: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      for (const cq of clientQuotes) {
        entries.push({
          id: cq.id,
          type: 'CLIENT_QUOTE',
          date: cq.createdAt,
          documentNumber: cq.quoteNumber,
          amount: Number(cq.totalAmount || 0),
          currency: cq.currency,
          projectId: cq.projectId,
          projectName: cq.project.name,
          status: cq.status,
          description: cq.title,
          link: `/projects/${cq.projectId}/procurement`,
        })
      }
    }

    // 2. Orders (POs to suppliers)
    if (!typeFilter || typeFilter === 'ORDER') {
      const orders = await prisma.order.findMany({
        where: {
          orgId,
          ...(projectFilter ? { projectId: projectFilter } : {}),
          ...(dateFrom || dateTo
            ? {
                createdAt: {
                  ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                  ...(dateTo ? { lte: new Date(dateTo) } : {}),
                },
              }
            : {}),
        },
        select: {
          id: true,
          orderNumber: true,
          vendorName: true,
          totalAmount: true,
          currency: true,
          status: true,
          createdAt: true,
          projectId: true,
          project: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      })

      for (const o of orders) {
        entries.push({
          id: o.id,
          type: 'ORDER',
          date: o.createdAt,
          documentNumber: o.orderNumber,
          amount: Number(o.totalAmount || 0),
          currency: o.currency,
          projectId: o.projectId,
          projectName: o.project.name,
          status: o.status,
          description: `PO to ${o.vendorName || 'Unknown Supplier'}`,
          link: `/projects/${o.projectId}/procurement`,
        })
      }
    }

    // 3. Payments received from clients
    if (!typeFilter || typeFilter === 'PAYMENT') {
      const payments = await prisma.payment.findMany({
        where: {
          orgId,
          ...(dateFrom || dateTo
            ? {
                createdAt: {
                  ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                  ...(dateTo ? { lte: new Date(dateTo) } : {}),
                },
              }
            : {}),
          clientQuote: projectFilter ? { projectId: projectFilter } : undefined,
        },
        select: {
          id: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          paidAt: true,
          createdAt: true,
          clientQuote: {
            select: {
              quoteNumber: true,
              projectId: true,
              project: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      for (const p of payments) {
        entries.push({
          id: p.id,
          type: 'PAYMENT',
          date: p.paidAt || p.createdAt,
          documentNumber: `PMT-${p.clientQuote.quoteNumber}`,
          amount: Number(p.amount),
          currency: p.currency,
          projectId: p.clientQuote.projectId,
          projectName: p.clientQuote.project.name,
          status: p.status,
          description: `${p.method} payment for ${p.clientQuote.quoteNumber}`,
          link: `/projects/${p.clientQuote.projectId}/procurement`,
        })
      }
    }

    // 4. Supplier payments (orders that have been paid)
    if (!typeFilter || typeFilter === 'SUPPLIER_PAYMENT') {
      const supplierPayments = await prisma.order.findMany({
        where: {
          orgId,
          supplierPaidAt: { not: null },
          ...(projectFilter ? { projectId: projectFilter } : {}),
          ...(dateFrom || dateTo
            ? {
                supplierPaidAt: {
                  ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
                  ...(dateTo ? { lte: new Date(dateTo) } : {}),
                },
              }
            : {}),
        },
        select: {
          id: true,
          orderNumber: true,
          vendorName: true,
          supplierPaymentAmount: true,
          supplierPaymentMethod: true,
          supplierPaymentRef: true,
          supplierPaidAt: true,
          currency: true,
          projectId: true,
          project: { select: { name: true } },
        },
        orderBy: { supplierPaidAt: 'desc' },
      })

      for (const sp of supplierPayments) {
        entries.push({
          id: `sp-${sp.id}`,
          type: 'SUPPLIER_PAYMENT',
          date: sp.supplierPaidAt!,
          documentNumber: `SP-${sp.orderNumber}`,
          amount: Number(sp.supplierPaymentAmount || 0),
          currency: sp.currency,
          projectId: sp.projectId,
          projectName: sp.project.name,
          status: 'PAID',
          description: `Payment to ${sp.vendorName || 'Unknown'} via ${sp.supplierPaymentMethod || 'N/A'}`,
          link: `/projects/${sp.projectId}/procurement`,
        })
      }
    }

    // Sort all entries by date descending
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Paginate
    const total = entries.length
    const paginated = entries.slice((page - 1) * limit, page * limit)

    // Get unique projects for filter dropdown
    const projectsForFilter = await prisma.project.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      entries: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      projects: projectsForFilter,
    })
  } catch (error) {
    console.error('Error fetching audit trail:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
