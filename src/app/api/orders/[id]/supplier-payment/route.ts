// Record supplier payment for an order
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Get payment status for an order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const { id: orderId } = await params

    const order = await prisma.order.findFirst({
      where: { id: orderId, orgId },
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        depositRequired: true,
        depositPercent: true,
        depositPaid: true,
        depositPaidAt: true,
        balanceDue: true,
        balancePaidAt: true,
        supplierPaidAt: true,
        supplierPaymentMethod: true,
        supplierPaymentRef: true,
        supplierPaymentAmount: true,
        supplierPaymentNotes: true,
        savedPaymentMethod: {
          select: {
            id: true,
            nickname: true,
            type: true,
            lastFour: true,
            cardBrand: true
          }
        },
        currency: true,
        status: true
      }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const totalAmount = Number(order.totalAmount) || 0
    const depositRequired = Number(order.depositRequired) || 0
    const depositPaid = Number(order.depositPaid) || 0
    const balanceDue = Number(order.balanceDue) || (totalAmount - depositPaid)
    const totalPaid = Number(order.supplierPaymentAmount) || 0

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount,
        currency: order.currency,
        status: order.status
      },
      deposit: {
        required: depositRequired,
        percent: order.depositPercent ? Number(order.depositPercent) : null,
        paid: depositPaid,
        paidAt: order.depositPaidAt
      },
      balance: {
        due: balanceDue,
        paidAt: order.balancePaidAt
      },
      payment: {
        totalPaid,
        paidAt: order.supplierPaidAt,
        method: order.supplierPaymentMethod,
        reference: order.supplierPaymentRef,
        notes: order.supplierPaymentNotes,
        savedPaymentMethod: order.savedPaymentMethod
      },
      isFullyPaid: totalPaid >= totalAmount,
      isDepositPaid: depositPaid >= depositRequired
    })
  } catch (error) {
    console.error('Error fetching order payment status:', error)
    return NextResponse.json({ error: 'Failed to fetch payment status' }, { status: 500 })
  }
}

// POST - Record a payment to supplier
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id
    const { id: orderId } = await params
    const body = await request.json()

    const {
      amount,
      paymentType, // 'DEPOSIT' or 'BALANCE' or 'FULL'
      method, // CREDIT_CARD, WIRE_TRANSFER, CHECK, etc.
      savedPaymentMethodId,
      reference,
      paidAt,
      notes
    } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, orgId }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const totalAmount = Number(order.totalAmount) || 0
    const depositRequired = Number(order.depositRequired) || 0
    const currentPaid = Number(order.supplierPaymentAmount) || 0
    const depositPaid = Number(order.depositPaid) || 0

    // Determine payment method name from saved payment method
    let paymentMethodName = method
    if (savedPaymentMethodId) {
      const savedMethod = await prisma.savedPaymentMethod.findFirst({
        where: { id: savedPaymentMethodId, orgId }
      })
      if (savedMethod) {
        paymentMethodName = `${savedMethod.type} - ${savedMethod.nickname || savedMethod.cardBrand} ****${savedMethod.lastFour}`
      }
    }

    // Build update data
    const updateData: any = {
      supplierPaymentAmount: currentPaid + amount,
      supplierPaymentMethod: paymentMethodName || method,
      supplierPaymentRef: reference || order.supplierPaymentRef,
      supplierPaymentNotes: notes || order.supplierPaymentNotes,
      supplierPaidAt: paidAt ? new Date(paidAt) : new Date(),
      savedPaymentMethodId: savedPaymentMethodId || order.savedPaymentMethodId,
      updatedById: userId
    }

    // Update deposit tracking based on payment type
    // NOTE: We intentionally do NOT update the order status here
    // The status field tracks fulfillment (ORDERED → SHIPPED → DELIVERED)
    // Payment status is tracked separately via supplierPaymentAmount, depositPaid, etc.
    if (paymentType === 'DEPOSIT') {
      updateData.depositPaid = depositPaid + amount
      updateData.depositPaidAt = new Date()
      updateData.balanceDue = totalAmount - (depositPaid + amount)
    } else if (paymentType === 'BALANCE' || paymentType === 'FULL') {
      updateData.balancePaidAt = new Date()
      if (currentPaid + amount >= totalAmount) {
        updateData.balanceDue = 0
      }
    }

    const newTotalPaid = currentPaid + amount

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData
    })

    // Log activity
    await prisma.orderActivity.create({
      data: {
        orderId,
        type: 'PAYMENT_MADE',
        message: `${paymentType === 'DEPOSIT' ? 'Deposit' : 'Payment'} of $${amount.toFixed(2)} made via ${paymentMethodName || method}`,
        userId,
        metadata: {
          amount,
          paymentType,
          method: paymentMethodName || method,
          reference,
          totalPaid: newTotalPaid
        }
      }
    })

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        totalPaid: newTotalPaid,
        isFullyPaid: newTotalPaid >= totalAmount
      }
    })
  } catch (error) {
    console.error('Error recording supplier payment:', error)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}

// DELETE - Delete a specific payment record (activity) and recalculate totals
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id
    const { id: orderId } = await params
    const { searchParams } = new URL(request.url)
    const activityId = searchParams.get('activityId')

    if (!activityId) {
      return NextResponse.json({ error: 'Activity ID is required' }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, orgId }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Find the activity to delete
    const activity = await prisma.orderActivity.findFirst({
      where: {
        id: activityId,
        orderId,
        type: { in: ['PAYMENT_MADE', 'PAYMENT_RECORDED'] }
      }
    })

    if (!activity) {
      return NextResponse.json({ error: 'Payment activity not found' }, { status: 404 })
    }

    const metadata = activity.metadata as any
    const paymentAmount = metadata?.amount || 0
    const isDeposit = metadata?.isDeposit || metadata?.paymentType === 'DEPOSIT'

    // Delete the activity
    await prisma.orderActivity.delete({
      where: { id: activityId }
    })

    // Recalculate totals from remaining payment activities
    const remainingActivities = await prisma.orderActivity.findMany({
      where: {
        orderId,
        type: { in: ['PAYMENT_MADE', 'PAYMENT_RECORDED'] }
      }
    })

    let newTotalPaid = 0
    let newDepositPaid = 0
    for (const act of remainingActivities) {
      const meta = act.metadata as any
      const amt = meta?.amount || 0
      newTotalPaid += amt
      if (meta?.isDeposit || meta?.paymentType === 'DEPOSIT') {
        newDepositPaid += amt
      }
    }

    const totalAmount = Number(order.totalAmount) || 0
    const depositRequired = Number(order.depositRequired) || 0

    // Update order with recalculated amounts
    await prisma.order.update({
      where: { id: orderId },
      data: {
        supplierPaymentAmount: newTotalPaid,
        depositPaid: Math.min(newDepositPaid, depositRequired),
        balanceDue: totalAmount - Math.min(newDepositPaid, depositRequired),
        supplierPaidAt: newTotalPaid > 0 ? order.supplierPaidAt : null,
        balancePaidAt: newTotalPaid >= totalAmount ? order.balancePaidAt : null,
        updatedById: userId
      }
    })

    // Log the deletion
    await prisma.orderActivity.create({
      data: {
        orderId,
        type: 'PAYMENT_DELETED',
        message: `Payment of $${paymentAmount.toFixed(2)} was deleted (New total: $${newTotalPaid.toFixed(2)})`,
        userId,
        metadata: {
          deletedAmount: paymentAmount,
          deletedActivityId: activityId,
          newTotalPaid
        }
      }
    })

    return NextResponse.json({
      success: true,
      newTotalPaid,
      newDepositPaid: Math.min(newDepositPaid, depositRequired)
    })
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}

// PATCH - Update a specific payment activity and recalculate totals
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id
    const { id: orderId } = await params
    const body = await request.json()
    const { activityId, amount, method, reference, notes } = body

    if (!activityId) {
      return NextResponse.json({ error: 'Activity ID is required' }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, orgId }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Find the activity to update
    const activity = await prisma.orderActivity.findFirst({
      where: {
        id: activityId,
        orderId,
        type: { in: ['PAYMENT_MADE', 'PAYMENT_RECORDED'] }
      }
    })

    if (!activity) {
      return NextResponse.json({ error: 'Payment activity not found' }, { status: 404 })
    }

    const oldMetadata = activity.metadata as any
    const newAmount = amount !== undefined ? amount : oldMetadata?.amount || 0
    const newMethod = method || oldMetadata?.method || ''
    const isDeposit = oldMetadata?.isDeposit || oldMetadata?.paymentType === 'DEPOSIT'

    // Update the activity
    await prisma.orderActivity.update({
      where: { id: activityId },
      data: {
        message: `${isDeposit ? 'Deposit ' : ''}Payment of $${newAmount.toFixed(2)} via ${newMethod}${reference ? ` (Ref: ${reference})` : ''}`,
        metadata: {
          ...oldMetadata,
          amount: newAmount,
          method: newMethod,
          reference: reference !== undefined ? reference : oldMetadata?.reference,
          notes: notes !== undefined ? notes : oldMetadata?.notes,
          editedAt: new Date().toISOString(),
          editedBy: userId
        }
      }
    })

    // Recalculate totals from all payment activities
    const allActivities = await prisma.orderActivity.findMany({
      where: {
        orderId,
        type: { in: ['PAYMENT_MADE', 'PAYMENT_RECORDED'] }
      }
    })

    let newTotalPaid = 0
    let newDepositPaid = 0
    for (const act of allActivities) {
      const meta = act.metadata as any
      const amt = meta?.amount || 0
      newTotalPaid += amt
      if (meta?.isDeposit || meta?.paymentType === 'DEPOSIT') {
        newDepositPaid += amt
      }
    }

    const totalAmount = Number(order.totalAmount) || 0
    const depositRequired = Number(order.depositRequired) || 0

    // Update order with recalculated amounts
    await prisma.order.update({
      where: { id: orderId },
      data: {
        supplierPaymentAmount: newTotalPaid,
        depositPaid: Math.min(newDepositPaid, depositRequired),
        balanceDue: totalAmount - Math.min(newDepositPaid, depositRequired),
        updatedById: userId
      }
    })

    return NextResponse.json({
      success: true,
      newTotalPaid,
      newDepositPaid: Math.min(newDepositPaid, depositRequired)
    })
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}

// PUT - Update deposit requirements
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id
    const { id: orderId } = await params
    const body = await request.json()

    const {
      depositRequired,
      depositPercent
    } = body

    const order = await prisma.order.findFirst({
      where: { id: orderId, orgId }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const totalAmount = Number(order.totalAmount) || 0

    // Calculate deposit amount from percentage if provided
    let calculatedDeposit = depositRequired
    if (depositPercent && !depositRequired) {
      calculatedDeposit = (totalAmount * depositPercent) / 100
    }

    // Update order with deposit requirements
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        depositRequired: calculatedDeposit || null,
        depositPercent: depositPercent || null,
        balanceDue: totalAmount - (Number(order.depositPaid) || 0),
        updatedById: userId
      }
    })

    // Log activity
    await prisma.orderActivity.create({
      data: {
        orderId,
        type: 'DEPOSIT_UPDATED',
        message: `Deposit requirement set to $${calculatedDeposit?.toFixed(2) || '0'} (${depositPercent || 0}%)`,
        userId,
        metadata: {
          depositRequired: calculatedDeposit,
          depositPercent
        }
      }
    })

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        depositRequired: calculatedDeposit,
        depositPercent,
        balanceDue: totalAmount - (Number(order.depositPaid) || 0)
      }
    })
  } catch (error) {
    console.error('Error updating deposit requirements:', error)
    return NextResponse.json({ error: 'Failed to update deposit requirements' }, { status: 500 })
  }
}
