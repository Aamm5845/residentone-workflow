import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

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
    const type = searchParams.get('type')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const projectId = searchParams.get('projectId') || undefined
    const source = searchParams.get('source') || 'both'

    if (!type) {
      return NextResponse.json({ error: 'Export type is required' }, { status: 400 })
    }

    const dateFilter = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59.999Z') } : {}),
    }
    const hasDateFilter = dateFrom || dateTo

    switch (type) {
      case 'invoices':
        return await exportInvoices(orgId, dateFilter, hasDateFilter, projectId, source)
      case 'bills':
        return await exportBills(orgId, dateFilter, hasDateFilter, projectId)
      case 'customers':
        return await exportCustomers(orgId)
      case 'vendors':
        return await exportVendors(orgId)
      case 'payments':
        return await exportPayments(orgId, dateFilter, hasDateFilter, projectId, source)
      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error exporting financial data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// --- Invoices (AR) ---
async function exportInvoices(
  orgId: string,
  dateFilter: Record<string, Date>,
  hasDateFilter: string | null,
  projectId: string | undefined,
  source: string
) {
  const records: Record<string, unknown>[] = []

  // Billing invoices
  if (source === 'billing' || source === 'both') {
    const invoices = await prisma.billingInvoice.findMany({
      where: {
        orgId,
        status: { not: 'DRAFT' },
        ...(projectId ? { projectId } : {}),
        ...(hasDateFilter ? { issueDate: dateFilter } : {}),
      },
      select: {
        invoiceNumber: true,
        title: true,
        status: true,
        clientName: true,
        clientEmail: true,
        issueDate: true,
        dueDate: true,
        subtotal: true,
        totalAmount: true,
        gstAmount: true,
        qstAmount: true,
        discountAmount: true,
        notes: true,
        lineItems: {
          orderBy: { order: 'asc' },
          select: {
            type: true,
            description: true,
            quantity: true,
            unitPrice: true,
            amount: true,
          },
        },
        project: { select: { name: true } },
      },
      orderBy: { issueDate: 'desc' },
    })

    for (const inv of invoices) {
      if (inv.lineItems.length === 0) {
        // Invoice with no line items - single row
        records.push({
          source: 'Billing',
          invoiceNo: inv.invoiceNumber,
          customer: inv.clientName,
          invoiceDate: inv.issueDate,
          dueDate: inv.dueDate,
          item: inv.title,
          description: inv.title,
          quantity: 1,
          rate: Number(inv.subtotal),
          amount: Number(inv.subtotal),
          taxAmount: Number(inv.gstAmount || 0) + Number(inv.qstAmount || 0),
          totalAmount: Number(inv.totalAmount),
          project: inv.project?.name || '',
          status: inv.status,
          memo: inv.notes || '',
        })
      } else {
        for (const item of inv.lineItems) {
          records.push({
            source: 'Billing',
            invoiceNo: inv.invoiceNumber,
            customer: inv.clientName,
            invoiceDate: inv.issueDate,
            dueDate: inv.dueDate,
            item: item.description,
            description: item.description,
            quantity: Number(item.quantity),
            rate: Number(item.unitPrice),
            amount: Number(item.amount),
            taxAmount: Number(inv.gstAmount || 0) + Number(inv.qstAmount || 0),
            totalAmount: Number(inv.totalAmount),
            project: inv.project?.name || '',
            status: inv.status,
            memo: inv.notes || '',
          })
        }
      }
    }
  }

  // Procurement client quotes
  if (source === 'procurement' || source === 'both') {
    const clientQuotes = await prisma.clientQuote.findMany({
      where: {
        orgId,
        status: { not: 'DRAFT' },
        ...(projectId ? { projectId } : {}),
        ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      },
      select: {
        quoteNumber: true,
        title: true,
        status: true,
        clientName: true,
        clientEmail: true,
        subtotal: true,
        totalAmount: true,
        gstAmount: true,
        qstAmount: true,
        currency: true,
        createdAt: true,
        validUntil: true,
        lineItems: {
          select: {
            displayName: true,
            displayDescription: true,
            quantity: true,
            clientUnitPrice: true,
            clientTotalPrice: true,
          },
        },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    for (const cq of clientQuotes) {
      if (cq.lineItems.length === 0) {
        records.push({
          source: 'Procurement',
          invoiceNo: cq.quoteNumber,
          customer: cq.clientName,
          invoiceDate: cq.createdAt,
          dueDate: cq.validUntil,
          item: cq.title || 'Procurement Invoice',
          description: cq.title || '',
          quantity: 1,
          rate: Number(cq.subtotal || 0),
          amount: Number(cq.subtotal || 0),
          taxAmount: Number(cq.gstAmount || 0) + Number(cq.qstAmount || 0),
          totalAmount: Number(cq.totalAmount || 0),
          project: cq.project?.name || '',
          status: cq.status,
          memo: '',
        })
      } else {
        for (const item of cq.lineItems) {
          records.push({
            source: 'Procurement',
            invoiceNo: cq.quoteNumber,
            customer: cq.clientName,
            invoiceDate: cq.createdAt,
            dueDate: cq.validUntil,
            item: item.displayName || '',
            description: item.displayDescription || item.displayName || '',
            quantity: Number(item.quantity || 1),
            rate: Number(item.clientUnitPrice || 0),
            amount: Number(item.clientTotalPrice || 0),
            taxAmount: Number(cq.gstAmount || 0) + Number(cq.qstAmount || 0),
            totalAmount: Number(cq.totalAmount || 0),
            project: cq.project?.name || '',
            status: cq.status,
            memo: '',
          })
        }
      }
    }
  }

  return NextResponse.json({ records, count: records.length })
}

// --- Bills (AP) ---
async function exportBills(
  orgId: string,
  dateFilter: Record<string, Date>,
  hasDateFilter: string | null,
  projectId: string | undefined
) {
  const orders = await prisma.order.findMany({
    where: {
      orgId,
      ...(projectId ? { projectId } : {}),
      ...(hasDateFilter
        ? { createdAt: dateFilter }
        : {}),
    },
    select: {
      orderNumber: true,
      vendorName: true,
      vendorEmail: true,
      status: true,
      subtotal: true,
      taxAmount: true,
      shippingCost: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      supplierPaidAt: true,
      supplierPaymentAmount: true,
      supplierPaymentMethod: true,
      supplierPaymentRef: true,
      items: {
        select: {
          name: true,
          description: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
        },
      },
      project: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const records: Record<string, unknown>[] = []

  for (const order of orders) {
    if (order.items.length === 0) {
      records.push({
        vendor: order.vendorName || 'Unknown Supplier',
        billDate: order.createdAt,
        dueDate: null,
        billNo: order.orderNumber,
        description: `Purchase Order to ${order.vendorName || 'Unknown'}`,
        quantity: 1,
        rate: Number(order.subtotal || 0),
        amount: Number(order.subtotal || 0),
        taxAmount: Number(order.taxAmount || 0),
        shippingCost: Number(order.shippingCost || 0),
        totalAmount: Number(order.totalAmount || 0),
        currency: order.currency,
        project: order.project?.name || '',
        status: order.status,
        paidDate: order.supplierPaidAt,
        paymentMethod: order.supplierPaymentMethod || '',
        paymentRef: order.supplierPaymentRef || '',
      })
    } else {
      for (const item of order.items) {
        records.push({
          vendor: order.vendorName || 'Unknown Supplier',
          billDate: order.createdAt,
          dueDate: null,
          billNo: order.orderNumber,
          description: item.name || item.description || '',
          quantity: Number(item.quantity || 1),
          rate: Number(item.unitPrice || 0),
          amount: Number(item.totalPrice || 0),
          taxAmount: Number(order.taxAmount || 0),
          shippingCost: Number(order.shippingCost || 0),
          totalAmount: Number(order.totalAmount || 0),
          currency: order.currency,
          project: order.project?.name || '',
          status: order.status,
          paidDate: order.supplierPaidAt,
          paymentMethod: order.supplierPaymentMethod || '',
          paymentRef: order.supplierPaymentRef || '',
        })
      }
    }
  }

  return NextResponse.json({ records, count: records.length })
}

// --- Customers ---
async function exportCustomers(orgId: string) {
  const clients = await prisma.client.findMany({
    where: { orgId },
    select: {
      name: true,
      company: true,
      email: true,
      phone: true,
      billingName: true,
      billingEmail: true,
      billingAddress: true,
      billingCity: true,
      billingProvince: true,
      billingPostalCode: true,
      billingCountry: true,
    },
    orderBy: { name: 'asc' },
  })

  const records = clients.map((c) => ({
    name: c.name,
    company: c.company || '',
    email: c.email,
    phone: c.phone || '',
    billingName: c.billingName || '',
    billingEmail: c.billingEmail || '',
    street: c.billingAddress || '',
    city: c.billingCity || '',
    state: c.billingProvince || '',
    zip: c.billingPostalCode || '',
    country: c.billingCountry || 'Canada',
  }))

  return NextResponse.json({ records, count: records.length })
}

// --- Vendors ---
async function exportVendors(orgId: string) {
  const suppliers = await prisma.supplier.findMany({
    where: { orgId, isActive: true },
    select: {
      name: true,
      contactName: true,
      email: true,
      phone: true,
      address: true,
      website: true,
      currency: true,
      supplierCategory: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  })

  const records = suppliers.map((s) => ({
    name: s.name,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone || '',
    street: s.address || '',
    website: s.website || '',
    currency: s.currency,
    category: s.supplierCategory?.name || '',
  }))

  return NextResponse.json({ records, count: records.length })
}

// --- Payments Received ---
async function exportPayments(
  orgId: string,
  dateFilter: Record<string, Date>,
  hasDateFilter: string | null,
  projectId: string | undefined,
  source: string
) {
  const records: Record<string, unknown>[] = []

  // Billing payments
  if (source === 'billing' || source === 'both') {
    const billingPayments = await prisma.billingPayment.findMany({
      where: {
        billingInvoice: {
          orgId,
          ...(projectId ? { projectId } : {}),
        },
        status: { in: ['PENDING', 'CONFIRMED'] },
        ...(hasDateFilter ? { paidAt: dateFilter } : {}),
      },
      select: {
        amount: true,
        method: true,
        status: true,
        paidAt: true,
        checkNumber: true,
        wireReference: true,
        eTransferRef: true,
        notes: true,
        billingInvoice: {
          select: {
            invoiceNumber: true,
            clientName: true,
            project: { select: { name: true } },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    })

    for (const p of billingPayments) {
      const refNo = p.checkNumber || p.wireReference || p.eTransferRef || ''
      records.push({
        source: 'Billing',
        date: p.paidAt,
        customer: p.billingInvoice.clientName,
        paymentMethod: p.method,
        referenceNo: refNo,
        amount: Number(p.amount),
        invoiceNo: p.billingInvoice.invoiceNumber,
        project: p.billingInvoice.project?.name || '',
        status: p.status,
        memo: p.notes || '',
      })
    }
  }

  // Procurement payments
  if (source === 'procurement' || source === 'both') {
    const procPayments = await prisma.payment.findMany({
      where: {
        orgId,
        status: { in: ['PAID', 'PARTIAL'] },
        ...(hasDateFilter ? { paidAt: dateFilter } : {}),
        ...(projectId
          ? { clientQuote: { projectId } }
          : {}),
      },
      select: {
        amount: true,
        method: true,
        status: true,
        paidAt: true,
        checkNumber: true,
        wireReference: true,
        notes: true,
        currency: true,
        clientQuote: {
          select: {
            quoteNumber: true,
            clientName: true,
            project: { select: { name: true } },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    })

    for (const p of procPayments) {
      const refNo = p.checkNumber || p.wireReference || ''
      records.push({
        source: 'Procurement',
        date: p.paidAt,
        customer: p.clientQuote.clientName,
        paymentMethod: p.method,
        referenceNo: refNo,
        amount: Number(p.amount),
        invoiceNo: p.clientQuote.quoteNumber,
        project: p.clientQuote.project?.name || '',
        status: p.status,
        memo: p.notes || '',
      })
    }
  }

  return NextResponse.json({ records, count: records.length })
}
