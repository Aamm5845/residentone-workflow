import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/projects/[id]/procurement/supplier-quotes/[quoteId]/status
 * Update the status of a supplier quote
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; quoteId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, quoteId } = await params
    const orgId = (session.user as any).orgId
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      )
    }

    // Verify quote exists and belongs to project in this org
    const quote = await prisma.supplierQuote.findFirst({
      where: { id: quoteId },
      include: {
        supplierRFQ: {
          include: {
            rfq: {
              select: { projectId: true, orgId: true }
            }
          }
        }
      }
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    if (quote.supplierRFQ.rfq.orgId !== orgId || quote.supplierRFQ.rfq.projectId !== projectId) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Update quote status
    const updated = await prisma.supplierQuote.update({
      where: { id: quoteId },
      data: { status }
    })

    return NextResponse.json({
      success: true,
      status: updated.status
    })

  } catch (error) {
    console.error('Error updating quote status:', error)
    return NextResponse.json(
      { error: 'Failed to update quote status' },
      { status: 500 }
    )
  }
}
