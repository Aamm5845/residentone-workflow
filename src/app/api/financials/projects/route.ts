import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { calculateProjectProfit, calculateMargin } from '@/lib/financial-calculations'
import { roundCurrency } from '@/lib/pricing'

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

    // Get all projects with their financial data
    const projects = await prisma.project.findMany({
      where: { orgId },
      select: {
        id: true,
        name: true,
        status: true,
        client: {
          select: { name: true },
        },
        clientQuotes: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            payments: {
              where: {
                status: { in: ['PAID', 'PARTIAL'] },
                paidAt: { not: null },
              },
              select: {
                amount: true,
              },
            },
          },
        },
        orders: {
          where: {
            supplierPaidAt: { not: null },
          },
          select: {
            supplierPaymentAmount: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const projectBreakdown = projects.map((project) => {
      // Invoiced = sum of all client quote totalAmounts (non-draft)
      const invoicedAmount = project.clientQuotes
        .filter((cq) => cq.status !== 'DRAFT')
        .reduce((sum, cq) => sum + Number(cq.totalAmount || 0), 0)

      // Paid = sum of confirmed payment amounts
      const paidAmount = project.clientQuotes.reduce(
        (sum, cq) =>
          sum + cq.payments.reduce((pSum, p) => pSum + Number(p.amount), 0),
        0
      )

      const outstanding = invoicedAmount - paidAmount

      // Supplier costs = sum of Order.supplierPaymentAmount where paid
      const supplierCosts = project.orders.reduce(
        (sum, o) => sum + Number(o.supplierPaymentAmount || 0),
        0
      )

      const profit = calculateProjectProfit(paidAmount, supplierCosts)
      const marginPercent = calculateMargin(profit, paidAmount)

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        clientName: project.client?.name || 'No Client',
        invoicedAmount: roundCurrency(invoicedAmount),
        paidAmount: roundCurrency(paidAmount),
        outstanding: roundCurrency(outstanding),
        supplierCosts: roundCurrency(supplierCosts),
        profit,
        marginPercent,
        link: `/projects/${project.id}/procurement`,
      }
    })

    // Filter out projects with zero financial activity
    const activeProjects = projectBreakdown.filter(
      (p) => p.invoicedAmount > 0 || p.paidAmount > 0 || p.supplierCosts > 0
    )

    // Calculate totals
    const totals = activeProjects.reduce(
      (acc, p) => ({
        invoicedAmount: acc.invoicedAmount + p.invoicedAmount,
        paidAmount: acc.paidAmount + p.paidAmount,
        outstanding: acc.outstanding + p.outstanding,
        supplierCosts: acc.supplierCosts + p.supplierCosts,
        profit: acc.profit + p.profit,
      }),
      { invoicedAmount: 0, paidAmount: 0, outstanding: 0, supplierCosts: 0, profit: 0 }
    )

    return NextResponse.json({
      projects: activeProjects,
      totals: {
        ...totals,
        invoicedAmount: roundCurrency(totals.invoicedAmount),
        paidAmount: roundCurrency(totals.paidAmount),
        outstanding: roundCurrency(totals.outstanding),
        supplierCosts: roundCurrency(totals.supplierCosts),
        profit: roundCurrency(totals.profit),
        marginPercent: calculateMargin(totals.profit, totals.paidAmount),
      },
    })
  } catch (error) {
    console.error('Error fetching project breakdown:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
