import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for payment schedule items
const paymentScheduleItemSchema = z.object({
  title: z.string(),
  amount: z.number(),
  percent: z.number().nullable(),
  dueOn: z.enum(['signing', 'milestone', 'completion', 'custom']),
  description: z.string().optional(),
})

// Validation schema for scope items
const scopeItemSchema = z.object({
  title: z.string(),
  description: z.string(),
})

// Validation schema for creating a proposal
const createProposalSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  title: z.string().min(1, "Title is required").max(200),
  billingType: z.enum(['FIXED', 'HOURLY', 'HYBRID']).default('HYBRID'),
  content: z.object({
    projectOverview: z.string().optional(),
    scopeItems: z.array(scopeItemSchema).optional(),
    terms: z.string().optional(),
    // Legacy fields for backwards compatibility
    scope: z.string().optional(),
    deliverables: z.array(z.object({
      title: z.string(),
      description: z.string().optional(),
      price: z.number().optional(),
    })).optional(),
    timeline: z.string().optional(),
    pricing: z.object({
      items: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        amount: z.number(),
      })).optional(),
      notes: z.string().optional(),
    }).optional(),
  }).optional(),
  coverLetter: z.string().optional(),
  paymentSchedule: z.array(paymentScheduleItemSchema).optional(),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Valid email required"),
  clientPhone: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  projectAddress: z.string().optional().nullable(),
  subtotal: z.number().min(0),
  depositAmount: z.number().optional().nullable(),
  depositPercent: z.number().optional().nullable(),
  hourlyRate: z.number().optional().nullable(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  discountAmount: z.number().min(0).optional().nullable(),
  gstRate: z.number().min(0).optional(),
  qstRate: z.number().min(0).optional(),
  ccFeePercent: z.number().min(0).optional(),
  totalAmount: z.number().min(0),
  validUntil: z.string().optional(),
  validDays: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
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

// Generate next proposal number
async function generateProposalNumber(orgId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `P-${year}-`

  const lastProposal = await prisma.proposal.findFirst({
    where: {
      orgId,
      proposalNumber: { startsWith: prefix },
    },
    orderBy: { proposalNumber: 'desc' },
    select: { proposalNumber: true },
  })

  let nextNumber = 1
  if (lastProposal) {
    const match = lastProposal.proposalNumber.match(/P-\d{4}-(\d+)/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  return `${prefix}${nextNumber.toString().padStart(3, '0')}`
}

// GET - List proposals for a project
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

    const proposals = await prisma.proposal.findMany({
      where: {
        projectId,
        orgId: session.user.orgId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        proposalNumber: true,
        title: true,
        billingType: true,
        status: true,
        totalAmount: true,
        depositAmount: true,
        validUntil: true,
        sentAt: true,
        viewedAt: true,
        signedAt: true,
        clientName: true,
        clientEmail: true,
        createdAt: true,
        accessToken: true,
        createdBy: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(proposals.map(p => ({
      ...p,
      totalAmount: Number(p.totalAmount),
      depositAmount: p.depositAmount ? Number(p.depositAmount) : null,
    })))
  } catch (error) {
    console.error('Error fetching proposals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new proposal
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
    const validatedData = createProposalSchema.parse(body)

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

    // Generate proposal number
    const proposalNumber = await generateProposalNumber(session.user.orgId)

    // Calculate tax amounts
    const subtotal = validatedData.subtotal
    const discountAmount = validatedData.discountAmount || (validatedData.discountPercent ? subtotal * (validatedData.discountPercent / 100) : 0)
    const taxableAmount = subtotal - discountAmount
    const gstAmount = validatedData.gstRate ? taxableAmount * (validatedData.gstRate / 100) : 0
    const qstAmount = validatedData.qstRate ? taxableAmount * (validatedData.qstRate / 100) : 0

    const proposal = await prisma.proposal.create({
      data: {
        orgId: session.user.orgId,
        projectId: validatedData.projectId,
        proposalNumber,
        title: validatedData.title,
        billingType: validatedData.billingType,
        status: 'DRAFT',
        content: validatedData.content || {},
        coverLetter: validatedData.coverLetter,
        paymentSchedule: validatedData.paymentSchedule || [],
        clientName: validatedData.clientName,
        clientEmail: validatedData.clientEmail,
        clientPhone: validatedData.clientPhone,
        clientAddress: validatedData.clientAddress,
        projectAddress: validatedData.projectAddress,
        subtotal: validatedData.subtotal,
        depositAmount: validatedData.depositAmount,
        depositPercent: validatedData.depositPercent,
        hourlyRate: validatedData.hourlyRate,
        discountPercent: validatedData.discountPercent,
        discountAmount: discountAmount,
        gstRate: validatedData.gstRate,
        gstAmount: gstAmount,
        qstRate: validatedData.qstRate,
        qstAmount: qstAmount,
        ccFeePercent: validatedData.ccFeePercent || 3.5,
        totalAmount: validatedData.totalAmount,
        validUntil: validatedData.validUntil ? new Date(validatedData.validUntil) : null,
        validDays: validatedData.validDays,
        notes: validatedData.notes,
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    })

    // Create activity log
    await prisma.proposalActivity.create({
      data: {
        proposalId: proposal.id,
        type: 'CREATED',
        message: `Proposal ${proposalNumber} created`,
      },
    })

    return NextResponse.json({
      ...proposal,
      subtotal: Number(proposal.subtotal),
      depositAmount: proposal.depositAmount ? Number(proposal.depositAmount) : null,
      depositPercent: proposal.depositPercent ? Number(proposal.depositPercent) : null,
      hourlyRate: proposal.hourlyRate ? Number(proposal.hourlyRate) : null,
      discountAmount: proposal.discountAmount ? Number(proposal.discountAmount) : null,
      gstAmount: proposal.gstAmount ? Number(proposal.gstAmount) : null,
      qstAmount: proposal.qstAmount ? Number(proposal.qstAmount) : null,
      ccFeePercent: proposal.ccFeePercent ? Number(proposal.ccFeePercent) : null,
      totalAmount: Number(proposal.totalAmount),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error creating proposal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
