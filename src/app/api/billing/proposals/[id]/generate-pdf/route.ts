import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { generateProposalPdfBuffer } from '@/lib/proposal-pdf'
import { generateProposalPdfBufferV2 } from '@/lib/proposal-pdf-v2'

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

    // Get proposal with all details
    const proposal = await prisma.proposal.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
      include: {
        project: {
          select: { name: true },
        },
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Get organization info
    const org = await prisma.organization.findFirst({
      where: { id: session.user.orgId },
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
      },
    })

    // Generate PDF (v2 = professional Montserrat layout)
    const version = request.nextUrl.searchParams.get('v')
    const pdfBuffer = version === '2'
      ? await generateProposalPdfBufferV2(proposal, org)
      : await generateProposalPdfBuffer(proposal, org)

    // Return PDF as response
    const suffix = version === '2' ? '-pro' : ''
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${proposal.proposalNumber}-${proposal.clientName.replace(/\s+/g, '-')}${suffix}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating proposal PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
