import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateProposalPdfBuffer } from '@/lib/proposal-pdf'
import { generateProposalPdfBufferV2 } from '@/lib/proposal-pdf-v2'

// GET - Public PDF download using access token
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: accessToken } = await context.params
  try {
    // Find proposal by access token (public access)
    const proposal = await prisma.proposal.findFirst({
      where: {
        accessToken,
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
        'Content-Disposition': `inline; filename="${proposal.proposalNumber}-${proposal.clientName.replace(/\s+/g, '-')}${suffix}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating public proposal PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
