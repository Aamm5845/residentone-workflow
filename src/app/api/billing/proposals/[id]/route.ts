import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for updating a proposal
const updateProposalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.any().optional(),
  clientName: z.string().min(1).optional(),
  clientEmail: z.string().email().optional(),
  clientPhone: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  subtotal: z.number().min(0).optional(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  discountAmount: z.number().min(0).optional().nullable(),
  gstRate: z.number().min(0).optional().nullable(),
  qstRate: z.number().min(0).optional().nullable(),
  totalAmount: z.number().min(0).optional(),
  validUntil: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'EXPIRED', 'DECLINED']).optional(),
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

// GET - Get a single proposal
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

    const proposal = await prisma.proposal.findFirst({
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
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...proposal,
      subtotal: Number(proposal.subtotal),
      discountPercent: proposal.discountPercent ? Number(proposal.discountPercent) : null,
      discountAmount: proposal.discountAmount ? Number(proposal.discountAmount) : null,
      gstRate: proposal.gstRate ? Number(proposal.gstRate) : null,
      gstAmount: proposal.gstAmount ? Number(proposal.gstAmount) : null,
      qstRate: proposal.qstRate ? Number(proposal.qstRate) : null,
      qstAmount: proposal.qstAmount ? Number(proposal.qstAmount) : null,
      totalAmount: Number(proposal.totalAmount),
    })
  } catch (error) {
    console.error('Error fetching proposal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update a proposal
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
    const validatedData = updateProposalSchema.parse(body)

    // Check proposal exists and belongs to org
    const existingProposal = await prisma.proposal.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    })

    if (!existingProposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Cannot edit signed or declined proposals
    if (['SIGNED', 'DECLINED'].includes(existingProposal.status)) {
      return NextResponse.json({
        error: 'Cannot edit a proposal that has been signed or declined'
      }, { status: 400 })
    }

    // Calculate tax amounts if subtotal changed
    let updateData: any = { ...validatedData }

    if (validatedData.subtotal !== undefined) {
      const subtotal = validatedData.subtotal
      let discountAmount = 0
      if (validatedData.discountAmount !== undefined && validatedData.discountAmount !== null) {
        discountAmount = validatedData.discountAmount
      } else if (validatedData.discountPercent !== undefined && validatedData.discountPercent !== null) {
        discountAmount = subtotal * (validatedData.discountPercent / 100)
      } else if (existingProposal.discountAmount) {
        discountAmount = Number(existingProposal.discountAmount)
      }

      const taxableAmount = subtotal - discountAmount
      const gstRate = validatedData.gstRate !== undefined ? validatedData.gstRate : Number(existingProposal.gstRate || 0)
      const qstRate = validatedData.qstRate !== undefined ? validatedData.qstRate : Number(existingProposal.qstRate || 0)

      updateData.gstAmount = gstRate ? taxableAmount * (gstRate / 100) : 0
      updateData.qstAmount = qstRate ? taxableAmount * (qstRate / 100) : 0
      updateData.discountAmount = discountAmount
    }

    if (validatedData.validUntil !== undefined) {
      updateData.validUntil = validatedData.validUntil ? new Date(validatedData.validUntil) : null
    }

    const proposal = await prisma.proposal.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    })

    // Log activity if status changed
    if (validatedData.status && validatedData.status !== existingProposal.status) {
      await prisma.proposalActivity.create({
        data: {
          proposalId: id,
          type: `STATUS_${validatedData.status}`,
          message: `Status changed to ${validatedData.status}`,
        },
      })
    }

    return NextResponse.json({
      ...proposal,
      subtotal: Number(proposal.subtotal),
      discountPercent: proposal.discountPercent ? Number(proposal.discountPercent) : null,
      discountAmount: proposal.discountAmount ? Number(proposal.discountAmount) : null,
      gstRate: proposal.gstRate ? Number(proposal.gstRate) : null,
      gstAmount: proposal.gstAmount ? Number(proposal.gstAmount) : null,
      qstRate: proposal.qstRate ? Number(proposal.qstRate) : null,
      qstAmount: proposal.qstAmount ? Number(proposal.qstAmount) : null,
      totalAmount: Number(proposal.totalAmount),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error updating proposal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete a proposal
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

    // Check proposal exists and belongs to org
    const proposal = await prisma.proposal.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Only allow deleting draft proposals
    if (proposal.status !== 'DRAFT') {
      return NextResponse.json({
        error: `Cannot delete a proposal that has been ${proposal.status.toLowerCase()}. Only draft proposals can be deleted.`
      }, { status: 400 })
    }

    // Delete activity logs first (foreign key constraint)
    await prisma.proposalActivity.deleteMany({
      where: { proposalId: id },
    })

    // Delete the proposal
    await prisma.proposal.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `Proposal ${proposal.proposalNumber} deleted`
    })
  } catch (error) {
    console.error('Error deleting proposal:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
