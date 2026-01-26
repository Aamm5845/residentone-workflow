// Individual Saved Payment Method API
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET - Get a single payment method
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
    const { id } = await params

    const paymentMethod = await prisma.savedPaymentMethod.findFirst({
      where: { id, orgId },
      include: {
        createdBy: {
          select: { name: true }
        }
      }
    })

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    return NextResponse.json({ paymentMethod })
  } catch (error) {
    console.error('Error fetching payment method:', error)
    return NextResponse.json({ error: 'Failed to fetch payment method' }, { status: 500 })
  }
}

// PATCH - Update a payment method
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
    const { id } = await params
    const body = await request.json()

    const existing = await prisma.savedPaymentMethod.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    const {
      nickname,
      lastFour,
      cardBrand,
      expiryMonth,
      expiryYear,
      bankName,
      holderName,
      isDefault,
      notes,
      isActive
    } = body

    // If setting as default, unset other defaults
    if (isDefault === true) {
      await prisma.savedPaymentMethod.updateMany({
        where: { orgId, isDefault: true, id: { not: id } },
        data: { isDefault: false }
      })
    }

    const updateData: any = {}
    if (nickname !== undefined) updateData.nickname = nickname
    if (lastFour !== undefined) updateData.lastFour = lastFour
    if (cardBrand !== undefined) updateData.cardBrand = cardBrand
    if (expiryMonth !== undefined) updateData.expiryMonth = expiryMonth
    if (expiryYear !== undefined) updateData.expiryYear = expiryYear
    if (bankName !== undefined) updateData.bankName = bankName
    if (holderName !== undefined) updateData.holderName = holderName
    if (isDefault !== undefined) updateData.isDefault = isDefault
    if (notes !== undefined) updateData.notes = notes
    if (isActive !== undefined) updateData.isActive = isActive

    const paymentMethod = await prisma.savedPaymentMethod.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        nickname: paymentMethod.nickname,
        lastFour: paymentMethod.lastFour,
        isDefault: paymentMethod.isDefault,
        isActive: paymentMethod.isActive
      }
    })
  } catch (error) {
    console.error('Error updating payment method:', error)
    return NextResponse.json({ error: 'Failed to update payment method' }, { status: 500 })
  }
}

// DELETE - Deactivate a payment method (soft delete)
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
    const { id } = await params

    const existing = await prisma.savedPaymentMethod.findFirst({
      where: { id, orgId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    // Soft delete - just deactivate
    await prisma.savedPaymentMethod.update({
      where: { id },
      data: { isActive: false, isDefault: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting payment method:', error)
    return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 })
  }
}
