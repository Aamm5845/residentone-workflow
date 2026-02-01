import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Get a single monthly bill
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

    const bill = await prisma.monthlyBill.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
      include: {
        payments: {
          orderBy: { paidDate: 'desc' },
          take: 12,
        },
      },
    })

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    return NextResponse.json({ bill })
  } catch (error: any) {
    console.error('Get monthly bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch monthly bill' },
      { status: 500 }
    )
  }
}

// PUT - Update a monthly bill
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

    // First check if the bill exists and belongs to this org
    const existing = await prisma.monthlyBill.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    const {
      name,
      amount,
      type,
      category,
      subCategory,
      dueDay,
      frequency,
      yearlyMonth,
      isVariable,
      averageAmount,
      description,
      payeeName,
      accountNumber,
      paymentUrl,
      isAutoPay,
      isActive,
      sortOrder,
      lastPaidDate,
      lastPaidAmount,
    } = body

    const bill = await prisma.monthlyBill.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(amount !== undefined && { amount }),
        ...(type !== undefined && { type }),
        ...(category !== undefined && { category }),
        ...(subCategory !== undefined && { subCategory }),
        ...(dueDay !== undefined && { dueDay: dueDay ? Math.min(31, Math.max(1, parseInt(dueDay))) : null }),
        ...(frequency !== undefined && { frequency }),
        ...(yearlyMonth !== undefined && { yearlyMonth: yearlyMonth ? Math.min(12, Math.max(1, parseInt(yearlyMonth))) : null }),
        ...(isVariable !== undefined && { isVariable }),
        ...(averageAmount !== undefined && { averageAmount }),
        ...(description !== undefined && { description }),
        ...(payeeName !== undefined && { payeeName }),
        ...(accountNumber !== undefined && { accountNumber }),
        ...(paymentUrl !== undefined && { paymentUrl }),
        ...(isAutoPay !== undefined && { isAutoPay }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(lastPaidDate !== undefined && { lastPaidDate: new Date(lastPaidDate) }),
        ...(lastPaidAmount !== undefined && { lastPaidAmount }),
      },
    })

    return NextResponse.json({ bill })
  } catch (error: any) {
    console.error('Update monthly bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update monthly bill' },
      { status: 500 }
    )
  }
}

// DELETE - Delete (soft delete) a monthly bill
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
    const existing = await prisma.monthlyBill.findFirst({
      where: {
        id,
        orgId: session.user.orgId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
    }

    // Soft delete by setting isActive to false
    await prisma.monthlyBill.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete monthly bill error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete monthly bill' },
      { status: 500 }
    )
  }
}
