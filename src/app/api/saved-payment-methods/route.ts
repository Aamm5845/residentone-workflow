// Saved Payment Methods API
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

export const dynamic = 'force-dynamic'

// GET - List all saved payment methods for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = (session.user as any).orgId

    // Check if full details are requested (for PO display)
    const { searchParams } = new URL(request.url)
    const includeFullDetails = searchParams.get('includeFullDetails') === 'true'

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
      paymentMethods: paymentMethods.map(pm => {
        const base = {
          id: pm.id,
          type: pm.type,
          nickname: pm.nickname,
          lastFour: pm.lastFour,
          cardBrand: pm.cardBrand,
          expiryMonth: pm.expiryMonth,
          expiryYear: pm.expiryYear,
          expiry: pm.expiryMonth && pm.expiryYear
            ? formatExpiry(pm.expiryMonth, pm.expiryYear)
            : null,
          bankName: pm.bankName,
          holderName: pm.holderName,
          billingAddress: pm.billingAddress,
          billingCity: pm.billingCity,
          billingProvince: pm.billingProvince,
          billingPostal: pm.billingPostal,
          billingCountry: pm.billingCountry,
          isDefault: pm.isDefault,
          notes: pm.notes,
          createdBy: pm.createdBy?.name,
          createdAt: pm.createdAt,
          hasFullCardDetails: !!pm.encryptedCardNumber
        }

        // Only include decrypted card details if specifically requested
        if (includeFullDetails && pm.encryptedCardNumber) {
          return {
            ...base,
            cardNumber: decrypt(pm.encryptedCardNumber),
            cvv: pm.encryptedCvv ? decrypt(pm.encryptedCvv) : null
          }
        }

        return base
      })
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
      cardNumber, // Full card number (will be encrypted)
      cvv, // CVV (will be encrypted)
      lastFour, // For backward compatibility
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
      notes
    } = body

    if (!type) {
      return NextResponse.json({ error: 'Payment method type is required' }, { status: 400 })
    }

    // Handle credit/debit cards with full card number
    if ((type === 'CREDIT_CARD' || type === 'DEBIT_CARD') && cardNumber) {
      const cleanCardNumber = cardNumber.replace(/\D/g, '')

      // Check card number length first
      if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
        return NextResponse.json({ error: 'Card number must be 13-19 digits' }, { status: 400 })
      }

      // Validate card number using Luhn algorithm
      if (!validateCardNumber(cleanCardNumber)) {
        return NextResponse.json({ error: 'Invalid card number - please check the number and try again' }, { status: 400 })
      }

      // Validate expiry is provided
      if (!expiryMonth || !expiryYear) {
        return NextResponse.json({ error: 'Expiry month and year are required' }, { status: 400 })
      }

      // Validate expiry values
      const expMonth = parseInt(expiryMonth)
      const expYear = parseInt(expiryYear)

      if (isNaN(expMonth) || isNaN(expYear)) {
        return NextResponse.json({ error: 'Invalid expiry date format' }, { status: 400 })
      }

      if (!validateExpiry(expMonth, expYear)) {
        return NextResponse.json({ error: 'Card has expired or invalid expiry date' }, { status: 400 })
      }

      const detectedBrand = detectCardBrand(cleanCardNumber)

      // Validate CVV if provided
      if (cvv) {
        if (!validateCvv(cvv, detectedBrand)) {
          const expectedLength = detectedBrand === 'AMEX' ? '4' : '3'
          return NextResponse.json({ error: `Invalid CVV - ${detectedBrand === 'AMEX' ? 'AMEX' : 'this card'} requires ${expectedLength} digits` }, { status: 400 })
        }
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
          nickname: nickname || `${detectedBrand} ending in ${getLastFour(cleanCardNumber)}`,
          lastFour: getLastFour(cleanCardNumber),
          cardBrand: cardBrand || detectedBrand,
          expiryMonth: expiryMonth ? parseInt(expiryMonth) : null,
          expiryYear: expiryYear ? parseInt(expiryYear) : null,
          bankName: bankName || null,
          holderName: holderName || null,
          encryptedCardNumber: encrypt(cleanCardNumber),
          encryptedCvv: cvv ? encrypt(cvv) : null,
          billingAddress: billingAddress || null,
          billingCity: billingCity || null,
          billingProvince: billingProvince || null,
          billingPostal: billingPostal || null,
          billingCountry: billingCountry || 'Canada',
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
          expiryMonth: paymentMethod.expiryMonth,
          expiryYear: paymentMethod.expiryYear,
          isDefault: paymentMethod.isDefault,
          hasFullCardDetails: true
        }
      })
    }

    // Backward compatible: create with just lastFour (no full card number)
    if (!lastFour && !cardNumber) {
      return NextResponse.json({ error: 'Card number or last four digits are required' }, { status: 400 })
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
        lastFour: lastFour || null,
        cardBrand: cardBrand || null,
        expiryMonth: expiryMonth ? parseInt(expiryMonth) : null,
        expiryYear: expiryYear ? parseInt(expiryYear) : null,
        bankName: bankName || null,
        holderName: holderName || null,
        billingAddress: billingAddress || null,
        billingCity: billingCity || null,
        billingProvince: billingProvince || null,
        billingPostal: billingPostal || null,
        billingCountry: billingCountry || 'Canada',
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
        isDefault: paymentMethod.isDefault,
        hasFullCardDetails: false
      }
    })
  } catch (error) {
    console.error('Error creating payment method:', error)
    return NextResponse.json({ error: 'Failed to create payment method' }, { status: 500 })
  }
}
