import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for updating an invoice
const updateInvoiceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(['STANDARD', 'DEPOSIT', 'MILESTONE', 'HOURLY', 'FINAL']).optional(),
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOID']).optional(),
  clientName: z.string().min(1).optional(),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  lineItems: z.array(z.object({
    id: z.string().optional(),
    type: z.enum(['FIXED', 'HOURLY', 'MILESTONE', 'DEPOSIT', 'ADJUSTMENT']).default('FIXED'),
    description: z.string().min(1),
    quantity: z.number().min(0).default(1),
    unitPrice: z.number().min(0),
    hours: z.number().optional(),
    hourlyRate: z.number().optional(),
    timeEntryIds: z.array(z.string()).optional(),
    milestoneTitle: z.string().optional(),
    milestonePercent: z.number().optional(),
    amount: z.number().min(0),
    order: z.number().default(0),
  })).optional(),
  subtotal: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  discountAmount: z.number().min(0).optional().nullable(),
  gstRate: z.number().min(0).optional().nullable(),
  qstRate: z.number().min(0).optional().nullable(),
  totalAmount: z.number().min(0).optional(),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
  allowCreditCard: z.boolean().optional(),
  allowBankTransfer: z.boolean().optional(),
  allowEtransfer: z.boolean().optional(),
  allowCheck: z.boolean().optional(),
  ccFeePercent: z.number().min(0).optional(),
})

interface AuthSession {
  user: {
    id: string
    orgId: string
    role: string
  }
}

// Helper to check billing access
async function canAccessBilling(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, canSeeBilling: true },
  })
  return user?.role === 'OWNER' || user?.canSeeBilling === true
}

// GET - Get a single invoice
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
        proposal: {
          select: { id: true, proposalNumber: true, title: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        lineItems: {
          orderBy: { order: 'asc' },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          include: {
            confirmedBy: {
              select: { id: true, name: true },
            },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...invoice,
      subtotal: Number(invoice.subtotal),
      discountPercent: invoice.discountPercent ? Number(invoice.discountPercent) : null,
      discountAmount: invoice.discountAmount ? Number(invoice.discountAmount) : null,
      gstRate: invoice.gstRate ? Number(invoice.gstRate) : null,
      gstAmount: invoice.gstAmount ? Number(invoice.gstAmount) : null,
      qstRate: invoice.qstRate ? Number(invoice.qstRate) : null,
      qstAmount: invoice.qstAmount ? Number(invoice.qstAmount) : null,
      totalAmount: Number(invoice.totalAmount),
      depositPercent: invoice.depositPercent ? Number(invoice.depositPercent) : null,
      depositAmount: invoice.depositAmount ? Number(invoice.depositAmount) : null,
      amountPaid: Number(invoice.amountPaid),
      balanceDue: Number(invoice.balanceDue),
      ccFeePercent: invoice.ccFeePercent ? Number(invoice.ccFeePercent) : null,
      lineItems: invoice.lineItems.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        hours: item.hours ? Number(item.hours) : null,
        hourlyRate: item.hourlyRate ? Number(item.hourlyRate) : null,
        milestonePercent: item.milestonePercent ? Number(item.milestonePercent) : null,
        amount: Number(item.amount),
      })),
      payments: invoice.payments.map(payment => ({
        ...payment,
        amount: Number(payment.amount),
      })),
    })
  } catch (error) {
    console.error('Error fetching invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update an invoice
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateInvoiceSchema.parse(body)

    // Check invoice exists and belongs to org
    const existingInvoice = await prisma.billingInvoice.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    })

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Cannot edit paid or void invoices
    if (['PAID', 'VOID'].includes(existingInvoice.status)) {
      return NextResponse.json({
        error: 'Cannot edit a paid or void invoice'
      }, { status: 400 })
    }

    // Prepare update data
    let updateData: any = { ...validatedData }
    delete updateData.lineItems

    // Calculate tax amounts if subtotal changed
    if (validatedData.subtotal !== undefined) {
      const subtotal = validatedData.subtotal
      const discountAmount = validatedData.discountAmount !== undefined
        ? validatedData.discountAmount
        : (validatedData.discountPercent !== undefined
          ? subtotal * ((validatedData.discountPercent || 0) / 100)
          : Number(existingInvoice.discountAmount || 0))

      const taxableAmount = subtotal - discountAmount
      const gstRate = validatedData.gstRate !== undefined ? validatedData.gstRate : Number(existingInvoice.gstRate || 0)
      const qstRate = validatedData.qstRate !== undefined ? validatedData.qstRate : Number(existingInvoice.qstRate || 0)

      updateData.gstAmount = gstRate ? taxableAmount * (gstRate / 100) : 0
      updateData.qstAmount = qstRate ? taxableAmount * (qstRate / 100) : 0
      updateData.discountAmount = discountAmount
    }

    // Calculate balance due
    if (validatedData.totalAmount !== undefined) {
      updateData.balanceDue = validatedData.totalAmount - Number(existingInvoice.amountPaid)
    }

    if (validatedData.dueDate !== undefined) {
      updateData.dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null
    }

    // Update invoice
    const invoice = await prisma.billingInvoice.update({
      where: { id },
      data: updateData,
    })

    // Update line items if provided
    if (validatedData.lineItems) {
      // Unbill old linked time entries before deleting line items
      const oldLineItems = await prisma.billingInvoiceLineItem.findMany({
        where: { billingInvoiceId: id },
      })
      for (const oldItem of oldLineItems) {
        if (oldItem.type === 'HOURLY' && oldItem.timeEntryIds.length > 0) {
          await prisma.timeEntry.updateMany({
            where: {
              id: { in: oldItem.timeEntryIds },
              billedStatus: 'BILLED',
            },
            data: {
              billedStatus: 'UNBILLED',
              billedInvoiceLineItemId: null,
              billedAt: null,
            },
          })
        }
      }

      // Delete existing line items
      await prisma.billingInvoiceLineItem.deleteMany({
        where: { billingInvoiceId: id },
      })

      // Create new line items
      await prisma.billingInvoiceLineItem.createMany({
        data: validatedData.lineItems.map((item, index) => ({
          billingInvoiceId: id,
          type: item.type,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          hours: item.hours,
          hourlyRate: item.hourlyRate,
          timeEntryIds: item.timeEntryIds || [],
          milestoneTitle: item.milestoneTitle,
          milestonePercent: item.milestonePercent,
          amount: item.amount,
          order: item.order || index,
        })),
      })

      // Bill new linked time entries
      const newLineItems = await prisma.billingInvoiceLineItem.findMany({
        where: { billingInvoiceId: id },
      })
      for (const newItem of newLineItems) {
        if (newItem.type === 'HOURLY' && newItem.timeEntryIds.length > 0) {
          await prisma.timeEntry.updateMany({
            where: {
              id: { in: newItem.timeEntryIds },
              billedStatus: 'UNBILLED',
            },
            data: {
              billedStatus: 'BILLED',
              billedInvoiceLineItemId: newItem.id,
              billedAt: new Date(),
            },
          })
        }
      }
    }

    // Handle status change to VOID or CANCELLED — unbill all entries
    if (validatedData.status && ['VOID', 'CANCELLED'].includes(validatedData.status) && !['VOID', 'CANCELLED'].includes(existingInvoice.status)) {
      const lineItems = await prisma.billingInvoiceLineItem.findMany({
        where: { billingInvoiceId: id },
      })
      for (const item of lineItems) {
        if (item.type === 'HOURLY' && item.timeEntryIds.length > 0) {
          await prisma.timeEntry.updateMany({
            where: {
              id: { in: item.timeEntryIds },
              billedStatus: 'BILLED',
            },
            data: {
              billedStatus: 'UNBILLED',
              billedInvoiceLineItemId: null,
              billedAt: null,
            },
          })
        }
      }
    }

    // Log activity if status changed
    if (validatedData.status && validatedData.status !== existingInvoice.status) {
      await prisma.billingInvoiceActivity.create({
        data: {
          billingInvoiceId: id,
          type: `STATUS_${validatedData.status}`,
          message: `Status changed to ${validatedData.status}`,
        },
      })
    }

    // Fetch updated invoice with relations
    const updatedInvoice = await prisma.billingInvoice.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json({
      ...updatedInvoice,
      subtotal: Number(updatedInvoice!.subtotal),
      totalAmount: Number(updatedInvoice!.totalAmount),
      amountPaid: Number(updatedInvoice!.amountPaid),
      balanceDue: Number(updatedInvoice!.balanceDue),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error updating invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete an invoice
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    // Check invoice exists and belongs to org
    const invoice = await prisma.billingInvoice.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Cannot delete paid invoices
    if (invoice.status === 'PAID') {
      return NextResponse.json({
        error: 'Cannot delete a paid invoice. Mark it as void instead.'
      }, { status: 400 })
    }

    // Unbill all linked time entries before deletion
    const lineItems = await prisma.billingInvoiceLineItem.findMany({
      where: { billingInvoiceId: id },
    })
    for (const item of lineItems) {
      if (item.type === 'HOURLY' && item.timeEntryIds.length > 0) {
        await prisma.timeEntry.updateMany({
          where: {
            id: { in: item.timeEntryIds },
            billedStatus: 'BILLED',
          },
          data: {
            billedStatus: 'UNBILLED',
            billedInvoiceLineItemId: null,
            billedAt: null,
          },
        })
      }
    }

    await prisma.billingInvoice.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
