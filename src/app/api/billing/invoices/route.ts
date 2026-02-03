import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for creating an invoice
const createInvoiceSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  proposalId: z.string().optional(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  type: z.enum(['STANDARD', 'DEPOSIT', 'MILESTONE', 'HOURLY', 'FINAL']).default('STANDARD'),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Valid email required"),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  lineItems: z.array(z.object({
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
  })).default([]),
  subtotal: z.number().min(0),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  gstRate: z.number().min(0).optional(),
  qstRate: z.number().min(0).optional(),
  totalAmount: z.number().min(0),
  depositPercent: z.number().min(0).max(100).optional(),
  depositAmount: z.number().min(0).optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  allowCreditCard: z.boolean().default(true),
  ccFeePercent: z.number().min(0).default(2.9),
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

// Generate next invoice number
async function generateInvoiceNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  const lastInvoice = await prisma.billingInvoice.findFirst({
    where: {
      orgId,
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  })

  let nextNumber = 1
  if (lastInvoice) {
    const match = lastInvoice.invoiceNumber.match(/INV-\d{4}-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`
}

// GET - List invoices for a project
export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    const invoices = await prisma.billingInvoice.findMany({
      where: {
        projectId,
        orgId: session.user.orgId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        lineItems: {
          orderBy: { order: 'asc' },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(invoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      title: inv.title,
      description: inv.description,
      type: inv.type,
      status: inv.status,
      totalAmount: Number(inv.totalAmount),
      subtotal: Number(inv.subtotal),
      amountPaid: Number(inv.amountPaid),
      balanceDue: Number(inv.balanceDue),
      gstRate: inv.gstRate ? Number(inv.gstRate) : null,
      gstAmount: inv.gstAmount ? Number(inv.gstAmount) : null,
      qstRate: inv.qstRate ? Number(inv.qstRate) : null,
      qstAmount: inv.qstAmount ? Number(inv.qstAmount) : null,
      dueDate: inv.dueDate,
      issueDate: inv.issueDate,
      sentAt: inv.sentAt,
      paidInFullAt: inv.paidInFullAt,
      clientName: inv.clientName,
      clientEmail: inv.clientEmail,
      clientPhone: inv.clientPhone,
      clientAddress: inv.clientAddress,
      accessToken: inv.accessToken,
      allowCreditCard: inv.allowCreditCard,
      ccFeePercent: Number(inv.ccFeePercent),
      notes: inv.notes,
      createdAt: inv.createdAt,
      createdBy: inv.createdBy,
      lineItems: inv.lineItems.map(item => ({
        id: item.id,
        type: item.type,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        amount: Number(item.amount),
      })),
    })))
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new invoice
export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await canAccessBilling(session.user.id))) {
      return NextResponse.json({ error: 'No billing access' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createInvoiceSchema.parse(body)

    // Verify project belongs to org
    const project = await prisma.project.findFirst({
      where: {
        id: validatedData.projectId,
        orgId: session.user.orgId,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(session.user.orgId)

    // Calculate tax amounts
    const subtotal = validatedData.subtotal
    const discountAmount = validatedData.discountAmount || (validatedData.discountPercent ? subtotal * (validatedData.discountPercent / 100) : 0)
    const taxableAmount = subtotal - discountAmount
    const gstAmount = validatedData.gstRate ? taxableAmount * (validatedData.gstRate / 100) : 0
    const qstAmount = validatedData.qstRate ? taxableAmount * (validatedData.qstRate / 100) : 0

    // Create invoice with line items
    const invoice = await prisma.billingInvoice.create({
      data: {
        orgId: session.user.orgId,
        projectId: validatedData.projectId,
        proposalId: validatedData.proposalId,
        invoiceNumber,
        title: validatedData.title,
        description: validatedData.description,
        type: validatedData.type,
        status: 'DRAFT',
        clientName: validatedData.clientName,
        clientEmail: validatedData.clientEmail,
        clientPhone: validatedData.clientPhone,
        clientAddress: validatedData.clientAddress,
        subtotal: validatedData.subtotal,
        discountPercent: validatedData.discountPercent,
        discountAmount: discountAmount,
        gstRate: validatedData.gstRate,
        gstAmount: gstAmount,
        qstRate: validatedData.qstRate,
        qstAmount: qstAmount,
        totalAmount: validatedData.totalAmount,
        depositPercent: validatedData.depositPercent,
        depositAmount: validatedData.depositAmount,
        amountPaid: 0,
        balanceDue: validatedData.totalAmount,
        issueDate: new Date(),
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        notes: validatedData.notes,
        termsAndConditions: validatedData.termsAndConditions,
        allowCreditCard: validatedData.allowCreditCard,
        ccFeePercent: validatedData.ccFeePercent,
        createdById: session.user.id,
        lineItems: {
          create: validatedData.lineItems.map((item, index) => ({
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
        },
      },
      include: {
        lineItems: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    })

    // Create activity log
    await prisma.billingInvoiceActivity.create({
      data: {
        billingInvoiceId: invoice.id,
        type: 'CREATED',
        message: `Invoice ${invoiceNumber} created`,
      },
    })

    return NextResponse.json({
      ...invoice,
      subtotal: Number(invoice.subtotal),
      discountAmount: invoice.discountAmount ? Number(invoice.discountAmount) : null,
      gstAmount: invoice.gstAmount ? Number(invoice.gstAmount) : null,
      qstAmount: invoice.qstAmount ? Number(invoice.qstAmount) : null,
      totalAmount: Number(invoice.totalAmount),
      amountPaid: Number(invoice.amountPaid),
      balanceDue: Number(invoice.balanceDue),
      lineItems: invoice.lineItems.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        hours: item.hours ? Number(item.hours) : null,
        hourlyRate: item.hourlyRate ? Number(item.hourlyRate) : null,
        milestonePercent: item.milestonePercent ? Number(item.milestonePercent) : null,
        amount: Number(item.amount),
      })),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error creating invoice:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
