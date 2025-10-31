import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { isValidAuthSession } from '@/lib/attribution'

// GET /api/users/[userId]/notifications - Get notification preferences
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

    // Check permissions: user can view their own or admin/owner can view any
    const canView = 
      session.user.id === resolvedParams.userId ||
      ['OWNER', 'ADMIN'].includes(session.user.role as string)

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: resolvedParams.userId },
      select: {
        id: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: true,
        phoneNumber: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      preferences: {
        emailNotificationsEnabled: user.emailNotificationsEnabled,
        smsNotificationsEnabled: user.smsNotificationsEnabled,
        phoneNumber: user.phoneNumber
      }
    })

  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/users/[userId]/notifications - Update notification preferences
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

    // Check permissions: user can edit their own or admin/owner can edit any
    const canEdit = 
      session.user.id === resolvedParams.userId ||
      ['OWNER', 'ADMIN'].includes(session.user.role as string)

    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { emailNotificationsEnabled, smsNotificationsEnabled, phoneNumber } = body

    // Validate
    if (typeof emailNotificationsEnabled !== 'boolean') {
      return NextResponse.json({ 
        error: 'emailNotificationsEnabled must be a boolean' 
      }, { status: 400 })
    }

    if (typeof smsNotificationsEnabled !== 'boolean') {
      return NextResponse.json({ 
        error: 'smsNotificationsEnabled must be a boolean' 
      }, { status: 400 })
    }

    // If SMS is enabled, phone number is required
    if (smsNotificationsEnabled && !phoneNumber) {
      return NextResponse.json({ 
        error: 'Phone number is required when SMS notifications are enabled' 
      }, { status: 400 })
    }

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { id: resolvedParams.userId },
      data: {
        emailNotificationsEnabled,
        smsNotificationsEnabled,
        phoneNumber: phoneNumber || null
      },
      select: {
        id: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: true,
        phoneNumber: true
      }
    })

    return NextResponse.json({
      success: true,
      preferences: {
        emailNotificationsEnabled: updatedUser.emailNotificationsEnabled,
        smsNotificationsEnabled: updatedUser.smsNotificationsEnabled,
        phoneNumber: updatedUser.phoneNumber
      }
    })

  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
