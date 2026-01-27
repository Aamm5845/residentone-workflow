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
