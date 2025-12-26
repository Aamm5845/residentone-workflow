import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/rfq/[id]/line-items
 * Get all line items for an RFQ
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: rfqId } = await params
    const orgId = (session.user as any).orgId

    // Verify RFQ belongs to org
    const rfq = await prisma.rFQ.findFirst({
      where: { id: rfqId, orgId }
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    const lineItems = await prisma.rFQLineItem.findMany({
      where: { rfqId },
      orderBy: { order: 'asc' },
      include: {
        ffeItem: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true
          }
        }
      }
    })

    return NextResponse.json({ lineItems })
  } catch (error) {
    console.error('Error fetching RFQ line items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch line items' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rfq/[id]/line-items
 * Add a new line item to an RFQ
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: rfqId } = await params
    const orgId = (session.user as any).orgId

    // Verify RFQ belongs to org and is in DRAFT status
    const rfq = await prisma.rFQ.findFirst({
      where: { id: rfqId, orgId }
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    if (rfq.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Cannot modify line items on a non-draft RFQ' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { description, quantity, specifications, ffeItemId } = body

    if (!description || !quantity) {
      return NextResponse.json(
        { error: 'Description and quantity are required' },
        { status: 400 }
      )
    }

    // Get the current max order
    const maxOrder = await prisma.rFQLineItem.aggregate({
      where: { rfqId },
      _max: { order: true }
    })

    const lineItem = await prisma.rFQLineItem.create({
      data: {
        rfqId,
        description,
        quantity: parseInt(quantity),
        specifications,
        ffeItemId,
        order: (maxOrder._max.order || 0) + 1
      },
      include: {
        ffeItem: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true
          }
        }
      }
    })

    return NextResponse.json(lineItem)
  } catch (error) {
    console.error('Error creating RFQ line item:', error)
    return NextResponse.json(
      { error: 'Failed to create line item' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/rfq/[id]/line-items
 * Update a line item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: rfqId } = await params
    const orgId = (session.user as any).orgId

    // Verify RFQ belongs to org
    const rfq = await prisma.rFQ.findFirst({
      where: { id: rfqId, orgId }
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    if (rfq.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Cannot modify line items on a non-draft RFQ' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { lineItemId, description, quantity, specifications } = body

    if (!lineItemId) {
      return NextResponse.json(
        { error: 'Line item ID is required' },
        { status: 400 }
      )
    }

    const lineItem = await prisma.rFQLineItem.update({
      where: { id: lineItemId },
      data: {
        ...(description && { description }),
        ...(quantity && { quantity: parseInt(quantity) }),
        ...(specifications !== undefined && { specifications })
      },
      include: {
        ffeItem: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true
          }
        }
      }
    })

    return NextResponse.json(lineItem)
  } catch (error) {
    console.error('Error updating RFQ line item:', error)
    return NextResponse.json(
      { error: 'Failed to update line item' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rfq/[id]/line-items
 * Delete a line item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: rfqId } = await params
    const orgId = (session.user as any).orgId

    // Verify RFQ belongs to org
    const rfq = await prisma.rFQ.findFirst({
      where: { id: rfqId, orgId }
    })

    if (!rfq) {
      return NextResponse.json({ error: 'RFQ not found' }, { status: 404 })
    }

    if (rfq.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Cannot modify line items on a non-draft RFQ' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const lineItemId = searchParams.get('lineItemId')

    if (!lineItemId) {
      return NextResponse.json(
        { error: 'Line item ID is required' },
        { status: 400 }
      )
    }

    await prisma.rFQLineItem.delete({
      where: { id: lineItemId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting RFQ line item:', error)
    return NextResponse.json(
      { error: 'Failed to delete line item' },
      { status: 500 }
    )
  }
}
