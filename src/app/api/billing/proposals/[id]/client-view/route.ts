import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { headers } from 'next/headers'
import { sendProposalSignedNotification } from '@/lib/email'

// Schema for signing the proposal
const signProposalSchema = z.object({
  signatureData: z.string().min(1, "Signature is required"),
  signatureType: z.enum(['drawn', 'typed']),
  signedByName: z.string().min(1, "Name is required"),
  signedByEmail: z.string().email("Valid email required"),
})

// Helper to generate invoice number
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

// Helper to create deposit invoice after signing
async function createDepositInvoice(proposal: any): Promise<void> {
  // Get deposit amount from payment schedule
  const paymentSchedule = proposal.paymentSchedule as any[] || []
  const depositItem = paymentSchedule.find((item: any) => item.dueOn === 'signing')

  if (!depositItem || !depositItem.amount || depositItem.amount <= 0) {
    return // No deposit required
  }

  const depositAmount = depositItem.amount

  // Calculate taxes on deposit
  const gstRate = proposal.gstRate ? Number(proposal.gstRate) : 0
  const qstRate = proposal.qstRate ? Number(proposal.qstRate) : 0
  const gstAmount = depositAmount * (gstRate / 100)
  const qstAmount = depositAmount * (qstRate / 100)
  const totalAmount = depositAmount + gstAmount + qstAmount

  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber(proposal.orgId)

  // Get first user from org to use as creator
  const orgUser = await prisma.user.findFirst({
    where: { orgId: proposal.orgId },
    select: { id: true },
  })

  if (!orgUser) {
    console.error('No user found for org:', proposal.orgId)
    return
  }

  // Create the deposit invoice
  await prisma.billingInvoice.create({
    data: {
      orgId: proposal.orgId,
      projectId: proposal.projectId,
      proposalId: proposal.id,
      invoiceNumber,
      title: `${proposal.title} - Deposit`,
      description: `Deposit payment for ${proposal.proposalNumber}`,
      type: 'DEPOSIT',
      status: 'DRAFT', // Save as draft for review before sending
      clientName: proposal.clientName,
      clientEmail: proposal.clientEmail,
      clientPhone: proposal.clientPhone,
      clientAddress: proposal.clientAddress,
      subtotal: depositAmount,
      gstRate: gstRate,
      gstAmount: gstAmount,
      qstRate: qstRate,
      qstAmount: qstAmount,
      totalAmount: totalAmount,
      balanceDue: totalAmount,
      depositPercent: proposal.depositPercent,
      depositAmount: depositAmount,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 7 days
      allowCreditCard: true,
      ccFeePercent: proposal.ccFeePercent || 3.5,
      termsAndConditions: 'Payment is due within 7 days of invoice date.',
      createdById: orgUser.id,
      lineItems: {
        create: [{
          type: 'DEPOSIT',
          description: depositItem.title || 'Deposit to begin project',
          quantity: 1,
          unitPrice: depositAmount,
          amount: depositAmount,
          order: 0,
        }],
      },
    },
  })

  // Update proposal to mark deposit invoice as created
  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { depositInvoiceCreated: true },
  })

  // Log activity
  await prisma.proposalActivity.create({
    data: {
      proposalId: proposal.id,
      type: 'DEPOSIT_INVOICE_CREATED',
      message: `Deposit invoice ${invoiceNumber} created as draft for ${depositAmount.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })}`,
      metadata: {
        invoiceNumber,
        depositAmount,
        totalWithTax: totalAmount,
      },
    },
  })
}

// GET - View proposal by access token (public)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: accessToken } = await context.params
  try {
    const proposal = await prisma.proposal.findFirst({
      where: {
        accessToken,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Check if expired
    if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
      if (proposal.status !== 'EXPIRED' && proposal.status !== 'SIGNED') {
        // Update status to expired
        await prisma.proposal.update({
          where: { id: proposal.id },
          data: { status: 'EXPIRED' },
        })
        proposal.status = 'EXPIRED'
      }
    }

    // Mark as viewed if first time
    if (!proposal.viewedAt && proposal.status === 'SENT') {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: {
          status: 'VIEWED',
          viewedAt: new Date(),
        },
      })

      // Log activity
      await prisma.proposalActivity.create({
        data: {
          proposalId: proposal.id,
          type: 'VIEWED',
          message: 'Proposal viewed by client',
        },
      })
    }

    // Get organization info for display
    const org = await prisma.organization.findFirst({
      where: { id: proposal.orgId },
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
      },
    })

    return NextResponse.json({
      id: proposal.id,
      proposalNumber: proposal.proposalNumber,
      title: proposal.title,
      billingType: proposal.billingType,
      status: proposal.status,
      content: proposal.content,
      coverLetter: proposal.coverLetter,
      paymentSchedule: proposal.paymentSchedule,
      clientName: proposal.clientName,
      clientEmail: proposal.clientEmail,
      clientPhone: proposal.clientPhone,
      clientAddress: proposal.clientAddress,
      projectAddress: proposal.projectAddress,
      subtotal: Number(proposal.subtotal),
      depositAmount: proposal.depositAmount ? Number(proposal.depositAmount) : null,
      depositPercent: proposal.depositPercent ? Number(proposal.depositPercent) : null,
      hourlyRate: proposal.hourlyRate ? Number(proposal.hourlyRate) : null,
      discountPercent: proposal.discountPercent ? Number(proposal.discountPercent) : null,
      discountAmount: proposal.discountAmount ? Number(proposal.discountAmount) : null,
      gstRate: proposal.gstRate ? Number(proposal.gstRate) : null,
      gstAmount: proposal.gstAmount ? Number(proposal.gstAmount) : null,
      qstRate: proposal.qstRate ? Number(proposal.qstRate) : null,
      qstAmount: proposal.qstAmount ? Number(proposal.qstAmount) : null,
      ccFeePercent: proposal.ccFeePercent ? Number(proposal.ccFeePercent) : 3.5,
      totalAmount: Number(proposal.totalAmount),
      validUntil: proposal.validUntil,
      validDays: proposal.validDays,
      notes: proposal.notes,
      signedAt: proposal.signedAt,
      signedByName: proposal.signedByName,
      companySignature: proposal.companySignature,
      companySignedByName: proposal.companySignedByName,
      companySignedAt: proposal.companySignedAt,
      project: proposal.project,
      organization: org,
    })
  } catch (error) {
    console.error('Error fetching proposal for client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Sign the proposal (public, using access token)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: accessToken } = await context.params
  try {
    const body = await request.json()
    const validatedData = signProposalSchema.parse(body)

    const proposal = await prisma.proposal.findFirst({
      where: {
        accessToken,
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Cannot sign if already signed, expired, or declined
    if (proposal.status === 'SIGNED') {
      return NextResponse.json({ error: 'Proposal already signed' }, { status: 400 })
    }

    if (proposal.status === 'EXPIRED') {
      return NextResponse.json({ error: 'Proposal has expired' }, { status: 400 })
    }

    if (proposal.status === 'DECLINED') {
      return NextResponse.json({ error: 'Proposal was declined' }, { status: 400 })
    }

    // Check if expired
    if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: 'EXPIRED' },
      })
      return NextResponse.json({ error: 'Proposal has expired' }, { status: 400 })
    }

    // Get client IP
    const headersList = await headers()
    const forwardedFor = headersList.get('x-forwarded-for')
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown'

    // Update proposal with signature
    const updatedProposal = await prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        status: 'SIGNED',
        signatureData: validatedData.signatureData,
        signatureType: validatedData.signatureType,
        signedByName: validatedData.signedByName,
        signedByEmail: validatedData.signedByEmail,
        signedByIp: clientIp,
        signedAt: new Date(),
      },
    })

    // Log activity
    await prisma.proposalActivity.create({
      data: {
        proposalId: proposal.id,
        type: 'SIGNED',
        message: `Proposal signed by ${validatedData.signedByName} (${validatedData.signedByEmail})`,
        metadata: {
          signedByIp: clientIp,
          signatureType: validatedData.signatureType,
        },
      },
    })

    // Send email notifications to organization owners and admins
    try {
      // Get organization owners and admins to notify
      const notifyUsers = await prisma.user.findMany({
        where: {
          orgId: proposal.orgId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
        select: {
          email: true,
          name: true,
        },
      })

      // Get project name for the notification
      const project = await prisma.project.findUnique({
        where: { id: proposal.projectId },
        select: { name: true },
      })

      // Send notification to each owner/admin
      for (const user of notifyUsers) {
        if (user.email) {
          await sendProposalSignedNotification(
            user.email,
            user.name || 'Team',
            {
              proposalNumber: proposal.proposalNumber,
              title: proposal.title,
              clientName: proposal.clientName,
              clientEmail: proposal.clientEmail || '',
              totalAmount: Number(proposal.totalAmount),
              projectName: project?.name,
              projectId: proposal.projectId,
              signedByName: validatedData.signedByName,
              signedAt: updatedProposal.signedAt!,
            }
          )
        }
      }
    } catch (emailError) {
      console.error('Error sending proposal signed notifications:', emailError)
      // Don't fail the signing if email notifications fail
    }

    // Auto-create deposit invoice if not already created
    if (!proposal.depositInvoiceCreated) {
      try {
        await createDepositInvoice(updatedProposal)
      } catch (invoiceError) {
        console.error('Error creating deposit invoice:', invoiceError)
        // Don't fail the signing if invoice creation fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Proposal signed successfully',
      signedAt: updatedProposal.signedAt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error signing proposal:', error)
    return NextResponse.json({ error: 'Failed to sign proposal' }, { status: 500 })
  }
}
