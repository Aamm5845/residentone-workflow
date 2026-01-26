// Saved Payment Methods API
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - List all saved payment methods for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

    const paymentMethods = await prisma.savedPaymentMethod.findMany({
      where: {
        orgId,
        isActive: true
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        createdBy: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({
      paymentMethods: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        nickname: pm.nickname,
        lastFour: pm.lastFour,
        cardBrand: pm.cardBrand,
        expiryMonth: pm.expiryMonth,
        expiryYear: pm.expiryYear,
        bankName: pm.bankName,
        holderName: pm.holderName,
        isDefault: pm.isDefault,
        notes: pm.notes,
        createdBy: pm.createdBy?.name,
        createdAt: pm.createdAt
      }))
    })
  } catch (error) {
    console.error('Error fetching payment methods:', error)
    return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 })
  }
}

// POST - Create a new saved payment method
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId
    const userId = session.user.id

    const body = await request.json()
    const {
      type, // CREDIT_CARD, DEBIT_CARD, BANK_ACCOUNT
      nickname,
      lastFour,
      cardBrand,
      expiryMonth,
      expiryYear,
      bankName,
      holderName,
      isDefault,
      notes
    } = body

    if (!type) {
      return NextResponse.json({ error: 'Payment method type is required' }, { status: 400 })
    }

    if (!lastFour) {
      return NextResponse.json({ error: 'Last four digits are required' }, { status: 400 })
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.savedPaymentMethod.updateMany({
        where: { orgId, isDefault: true },
        data: { isDefault: false }
      })
    }

    const paymentMethod = await prisma.savedPaymentMethod.create({
      data: {
        orgId,
        type,
        nickname: nickname || null,
        lastFour,
        cardBrand: cardBrand || null,
        expiryMonth: expiryMonth || null,
        expiryYear: expiryYear || null,
        bankName: bankName || null,
        holderName: holderName || null,
        isDefault: isDefault || false,
        notes: notes || null,
        createdById: userId
      }
    })

    return NextResponse.json({
      success: true,
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        nickname: paymentMethod.nickname,
        lastFour: paymentMethod.lastFour,
        cardBrand: paymentMethod.cardBrand,
        isDefault: paymentMethod.isDefault
      }
    })
  } catch (error) {
    console.error('Error creating payment method:', error)
    return NextResponse.json({ error: 'Failed to create payment method' }, { status: 500 })
  }
}
