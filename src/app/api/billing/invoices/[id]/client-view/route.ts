import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - View invoice by access token (public)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: accessToken } = await context.params
  try {
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        accessToken,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        lineItems: {
          orderBy: { order: 'asc' },
        },
        payments: {
          where: { status: 'CONFIRMED' },
          orderBy: { paidAt: 'desc' },
          select: {
            id: true,
            amount: true,
            method: true,
            paidAt: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Check if overdue
    if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
      if (!['PAID', 'VOID', 'CANCELLED', 'OVERDUE'].includes(invoice.status)) {
        await prisma.billingInvoice.update({
          where: { id: invoice.id },
          data: { status: 'OVERDUE' },
        })
        invoice.status = 'OVERDUE'
      }
    }

    // Mark as viewed if first time
    if (!invoice.viewedAt && invoice.status === 'SENT') {
      await prisma.billingInvoice.update({
        where: { id: invoice.id },
        data: {
          status: 'VIEWED',
          viewedAt: new Date(),
        },
      })

      // Log activity
      await prisma.billingInvoiceActivity.create({
        data: {
          billingInvoiceId: invoice.id,
          type: 'VIEWED',
          message: 'Invoice viewed by client',
        },
      })
    }

    // Get organization info for display
    const org = await prisma.organization.findFirst({
      where: { id: invoice.orgId },
      select: {
        name: true,
        businessName: true,
        logoUrl: true,
        businessEmail: true,
        businessPhone: true,
        businessAddress: true,
        businessCity: true,
        businessProvince: true,
        businessPostal: true,
        gstNumber: true,
        qstNumber: true,
        neqNumber: true,
        wireInstructions: true,
        etransferEmail: true,
      },
    })

    return NextResponse.json({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      description: invoice.description,
      type: invoice.type,
      status: invoice.status,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientPhone: invoice.clientPhone,
      clientAddress: invoice.clientAddress,
      subtotal: Number(invoice.subtotal),
      discountPercent: invoice.discountPercent ? Number(invoice.discountPercent) : null,
      discountAmount: invoice.discountAmount ? Number(invoice.discountAmount) : null,
      gstRate: invoice.gstRate ? Number(invoice.gstRate) : null,
      gstAmount: invoice.gstAmount ? Number(invoice.gstAmount) : null,
      qstRate: invoice.qstRate ? Number(invoice.qstRate) : null,
      qstAmount: invoice.qstAmount ? Number(invoice.qstAmount) : null,
      totalAmount: Number(invoice.totalAmount),
      amountPaid: Number(invoice.amountPaid),
      balanceDue: Number(invoice.balanceDue),
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      paidInFullAt: invoice.paidInFullAt,
      allowCreditCard: invoice.allowCreditCard,
      ccFeePercent: invoice.ccFeePercent ? Number(invoice.ccFeePercent) : 2.9,
      notes: invoice.notes,
      termsAndConditions: invoice.termsAndConditions,
      project: invoice.project,
      organization: org,
      lineItems: invoice.lineItems.map(item => ({
        id: item.id,
        type: item.type,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        hours: item.hours ? Number(item.hours) : null,
        hourlyRate: item.hourlyRate ? Number(item.hourlyRate) : null,
        milestoneTitle: item.milestoneTitle,
        milestonePercent: item.milestonePercent ? Number(item.milestonePercent) : null,
        amount: Number(item.amount),
      })),
      payments: invoice.payments.map(p => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        paidAt: p.paidAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching invoice for client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
