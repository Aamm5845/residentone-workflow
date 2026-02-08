import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateProjectProfit, calculateMargin, splitTax } from '@/lib/financial-calculations'
import { roundCurrency } from '@/lib/pricing'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check: OWNER or canSeeFinancials
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

    // Parse period filter
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all'

    let dateFilter: Date | undefined
    const now = new Date()
    if (period === '30d') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else if (period === '90d') {
      dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    } else if (period === 'ytd') {
      dateFilter = new Date(now.getFullYear(), 0, 1)
    }

    // Revenue: sum of Payment.amount where status IN ('PAID','PARTIAL') and paidAt IS NOT NULL
    const payments = await prisma.payment.findMany({
      where: {
        orgId,
        status: { in: ['PAID', 'PARTIAL'] },
        paidAt: {
          not: null,
          ...(dateFilter ? { gte: dateFilter } : {}),
        },
      },
      select: {
        amount: true,
        clientQuote: {
          select: {
            gstAmount: true,
            qstAmount: true,
            totalAmount: true,
            subtotal: true,
          },
        },
      },
    })

    const revenue = payments.reduce((sum, p) => sum + Number(p.amount), 0)

    // Tax collected from clients: proportional to payment/total ratio
    let gstCollected = 0
    let qstCollected = 0
    for (const p of payments) {
      const cq = p.clientQuote
      if (cq.totalAmount && Number(cq.totalAmount) > 0) {
        const ratio = Number(p.amount) / Number(cq.totalAmount)
        gstCollected += Number(cq.gstAmount || 0) * ratio
        qstCollected += Number(cq.qstAmount || 0) * ratio
      }
    }

    // Costs: sum of Order.supplierPaymentAmount where supplierPaidAt IS NOT NULL
    const orders = await prisma.order.findMany({
      where: {
        orgId,
        supplierPaidAt: {
          not: null,
          ...(dateFilter ? { gte: dateFilter } : {}),
        },
      },
      select: {
        supplierPaymentAmount: true,
        taxAmount: true,
      },
    })

    const costs = orders.reduce((sum, o) => sum + Number(o.supplierPaymentAmount || 0), 0)

    // Tax paid to suppliers: split combined Order.taxAmount into GST/QST
    let gstPaid = 0
    let qstPaid = 0
    for (const o of orders) {
      const tax = splitTax(Number(o.taxAmount || 0))
      gstPaid += tax.gst
      qstPaid += tax.qst
    }

    const profit = calculateProjectProfit(revenue, costs)
    const margin = calculateMargin(profit, revenue)

    return NextResponse.json({
      revenue: roundCurrency(revenue),
      costs: roundCurrency(costs),
      profit,
      margin,
      gstCollected: roundCurrency(gstCollected),
      gstPaid: roundCurrency(gstPaid),
      gstNet: roundCurrency(gstCollected - gstPaid),
      qstCollected: roundCurrency(qstCollected),
      qstPaid: roundCurrency(qstPaid),
      qstNet: roundCurrency(qstCollected - qstPaid),
    })
  } catch (error) {
    console.error('Error fetching financial overview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
