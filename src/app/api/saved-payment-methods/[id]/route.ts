// Individual Saved Payment Method API
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  encrypt,
  decrypt,
  getLastFour,
  detectCardBrand,
  validateCardNumber,
  validateCvv,
  validateExpiry,
  formatExpiry
} from '@/lib/encryption'

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

    // Check if full details are requested
    const { searchParams } = new URL(request.url)
    const includeFullDetails = searchParams.get('includeFullDetails') === 'true'

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

    const result: any = {
      id: paymentMethod.id,
      type: paymentMethod.type,
      nickname: paymentMethod.nickname,
      lastFour: paymentMethod.lastFour,
      cardBrand: paymentMethod.cardBrand,
      expiryMonth: paymentMethod.expiryMonth,
      expiryYear: paymentMethod.expiryYear,
      expiry: paymentMethod.expiryMonth && paymentMethod.expiryYear
        ? formatExpiry(paymentMethod.expiryMonth, paymentMethod.expiryYear)
        : null,
      bankName: paymentMethod.bankName,
      holderName: paymentMethod.holderName,
      billingAddress: paymentMethod.billingAddress,
      billingCity: paymentMethod.billingCity,
      billingProvince: paymentMethod.billingProvince,
      billingPostal: paymentMethod.billingPostal,
      billingCountry: paymentMethod.billingCountry,
      isDefault: paymentMethod.isDefault,
      isActive: paymentMethod.isActive,
      notes: paymentMethod.notes,
      createdBy: paymentMethod.createdBy?.name,
      createdAt: paymentMethod.createdAt,
      hasFullCardDetails: !!paymentMethod.encryptedCardNumber
    }

    // Include decrypted card details if requested
    if (includeFullDetails && paymentMethod.encryptedCardNumber) {
      result.cardNumber = decrypt(paymentMethod.encryptedCardNumber)
      result.cvv = paymentMethod.encryptedCvv ? decrypt(paymentMethod.encryptedCvv) : null
    }

    return NextResponse.json({ paymentMethod: result })
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
      cardNumber,
      cvv,
      lastFour,
      cardBrand,
      expiryMonth,
      expiryYear,
      bankName,
      holderName,
      billingAddress,
      billingCity,
      billingProvince,
      billingPostal,
      billingCountry,
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
    if (expiryMonth !== undefined) updateData.expiryMonth = parseInt(expiryMonth)
    if (expiryYear !== undefined) updateData.expiryYear = parseInt(expiryYear)
    if (bankName !== undefined) updateData.bankName = bankName
    if (holderName !== undefined) updateData.holderName = holderName
    if (billingAddress !== undefined) updateData.billingAddress = billingAddress
    if (billingCity !== undefined) updateData.billingCity = billingCity
    if (billingProvince !== undefined) updateData.billingProvince = billingProvince
    if (billingPostal !== undefined) updateData.billingPostal = billingPostal
    if (billingCountry !== undefined) updateData.billingCountry = billingCountry
    if (isDefault !== undefined) updateData.isDefault = isDefault
    if (notes !== undefined) updateData.notes = notes
    if (isActive !== undefined) updateData.isActive = isActive

    // Handle card number update
    if (cardNumber) {
      const cleanCardNumber = cardNumber.replace(/\D/g, '')

      if (!validateCardNumber(cleanCardNumber)) {
        return NextResponse.json({ error: 'Invalid card number' }, { status: 400 })
      }

      const detectedBrand = detectCardBrand(cleanCardNumber)

      updateData.encryptedCardNumber = encrypt(cleanCardNumber)
      updateData.lastFour = getLastFour(cleanCardNumber)
      if (!cardBrand) updateData.cardBrand = detectedBrand
    }

    // Handle CVV update
    if (cvv !== undefined) {
      if (cvv) {
        const brand = cardBrand || existing.cardBrand || 'UNKNOWN'
        if (!validateCvv(cvv, brand)) {
          return NextResponse.json({ error: 'Invalid CVV' }, { status: 400 })
        }
        updateData.encryptedCvv = encrypt(cvv)
      } else {
        updateData.encryptedCvv = null
      }
    }

    // Validate expiry if both provided
    if (expiryMonth !== undefined && expiryYear !== undefined) {
      if (!validateExpiry(expiryMonth, expiryYear)) {
        return NextResponse.json({ error: 'Card has expired or invalid expiry date' }, { status: 400 })
      }
    }

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
        cardBrand: paymentMethod.cardBrand,
        expiryMonth: paymentMethod.expiryMonth,
        expiryYear: paymentMethod.expiryYear,
        isDefault: paymentMethod.isDefault,
        isActive: paymentMethod.isActive,
        hasFullCardDetails: !!paymentMethod.encryptedCardNumber
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
