import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'
import { validatePhoneNumber } from '@/lib/twilio'

/**
 * Update user's phone number and SMS notification preferences
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow users to update their own phone number, or admins/owners
    if (
      session.user.id !== resolvedParams.userId &&
      !['OWNER', 'ADMIN'].includes(session.user.role as string)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()
    const { phoneNumber, smsNotificationsEnabled } = data

    // Validate phone number if provided
    if (phoneNumber && phoneNumber.trim() !== '') {
      // Basic validation: check if it's a valid international format
      const cleaned = phoneNumber.replace(/\D/g, '')
      if (cleaned.length < 10 || cleaned.length > 15) {
        return NextResponse.json(
          { error: 'Invalid phone number. Must be between 10-15 digits with country code.' },
          { status: 400 }
        )
      }
      
      // Ensure it starts with + for international format
      if (!phoneNumber.startsWith('+')) {
        return NextResponse.json(
          { error: 'Phone number must include country code (e.g., +1234567890)' },
          { status: 400 }
        )
      }
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: {
        id: resolvedParams.userId
      },
      data: {
        phoneNumber: phoneNumber?.trim() || null,
        smsNotificationsEnabled: smsNotificationsEnabled ?? false
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        smsNotificationsEnabled: true
      }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser
    })

  } catch (error) {
    console.error('Error updating phone number:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Get user's phone number and SMS preferences
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession()
    const resolvedParams = await params
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow users to view their own phone number, or admins/owners
    if (
      session.user.id !== resolvedParams.userId &&
      !['OWNER', 'ADMIN'].includes(session.user.role as string)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: {
        id: resolvedParams.userId
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        smsNotificationsEnabled: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user
    })

  } catch (error) {
    console.error('Error fetching phone number:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
