import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/budget-quotes/[id]
 * Get a specific budget quote
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

    const { id } = await params
    const orgId = (session.user as any).orgId

    const budgetQuote = await prisma.budgetQuote.findFirst({
      where: { id, orgId },
      include: {
        project: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!budgetQuote) {
      return NextResponse.json({ error: 'Budget quote not found' }, { status: 404 })
    }

    return NextResponse.json(budgetQuote)
  } catch (error) {
    console.error('Error fetching budget quote:', error)
    return NextResponse.json(
      { error: 'Failed to fetch budget quote' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/budget-quotes/[id]
 * Update a budget quote
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const orgId = (session.user as any).orgId
    const body = await request.json()

    // Verify budget quote exists and belongs to org
    const existing = await prisma.budgetQuote.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Budget quote not found' }, { status: 404 })
    }

    const {
      title,
      description,
      itemIds,
      estimatedTotal,
      currency,
      includeTax,
      includedServices,
      clientEmail,
      expiresAt,
      status
    } = body

    const updateData: any = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (itemIds !== undefined) updateData.itemIds = itemIds
    if (estimatedTotal !== undefined) updateData.estimatedTotal = estimatedTotal
    if (currency !== undefined) updateData.currency = currency
    if (includeTax !== undefined) updateData.includeTax = includeTax
    if (includedServices !== undefined) updateData.includedServices = includedServices
    if (clientEmail !== undefined) updateData.clientEmail = clientEmail
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null
    if (status !== undefined) updateData.status = status

    const budgetQuote = await prisma.budgetQuote.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    return NextResponse.json(budgetQuote)
  } catch (error) {
    console.error('Error updating budget quote:', error)
    return NextResponse.json(
      { error: 'Failed to update budget quote' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/budget-quotes/[id]
 * Delete a budget quote
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

    const { id } = await params
    const orgId = (session.user as any).orgId

    // Verify budget quote exists and belongs to org
    const existing = await prisma.budgetQuote.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Budget quote not found' }, { status: 404 })
    }

    await prisma.budgetQuote.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting budget quote:', error)
    return NextResponse.json(
      { error: 'Failed to delete budget quote' },
      { status: 500 }
    )
  }
}
