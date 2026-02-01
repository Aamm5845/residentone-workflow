import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Get a single recurring bill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bill = await prisma.recurringBill.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    })

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    return NextResponse.json({ bill })
  } catch (error: any) {
    console.error('Get recurring bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recurring bill' },
      { status: 500 }
    )
  }
}

// PUT - Update a recurring bill
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      name,
      amount,
      category,
      dueDay,
      frequency,
      description,
      payeeName,
      accountNumber,
      paymentUrl,
      isAutoPay,
      isActive,
      lastPaidDate,
      lastPaidAmount,
    } = body

    // First check if the bill exists and belongs to this org
    const existing = await prisma.recurringBill.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    const bill = await prisma.recurringBill.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(amount !== undefined && { amount }),
        ...(category !== undefined && { category }),
        ...(dueDay !== undefined && { dueDay: Math.min(31, Math.max(1, parseInt(dueDay))) }),
        ...(frequency !== undefined && { frequency }),
        ...(description !== undefined && { description }),
        ...(payeeName !== undefined && { payeeName }),
        ...(accountNumber !== undefined && { accountNumber }),
        ...(paymentUrl !== undefined && { paymentUrl }),
        ...(isAutoPay !== undefined && { isAutoPay }),
        ...(isActive !== undefined && { isActive }),
        ...(lastPaidDate !== undefined && { lastPaidDate: new Date(lastPaidDate) }),
        ...(lastPaidAmount !== undefined && { lastPaidAmount }),
      },
    })

    return NextResponse.json({ bill })
  } catch (error: any) {
    console.error('Update recurring bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update recurring bill' },
      { status: 500 }
    )
  }
}

// DELETE - Delete (soft delete) a recurring bill
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ error: 'Forbidden - Owner access required' }, { status: 403 })
    }

    // First check if the bill exists and belongs to this org
    const existing = await prisma.recurringBill.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Soft delete by setting isActive to false
    await prisma.recurringBill.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete recurring bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete recurring bill' },
      { status: 500 }
    )
  }
}
