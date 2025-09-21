import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import {
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  isOwnerUser,
  type AuthSession
} from '@/lib/attribution'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const params = await context.params
  
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions - only OWNER can directly set passwords
    if (!isOwnerUser(session)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners can directly set passwords.' 
      }, { status: 403 })
    }

    const { password, forceChange = true } = await request.json()

    // Validation
    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      )
    }

    // Password validation
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Get the target user
    const targetUser = await prisma.user.findFirst({
      where: { 
        id: params.userId,
        orgId: session.user.orgId  // Ensure same organization
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent setting password for another owner (unless setting own password)
    if (targetUser.role === 'OWNER' && params.userId !== session.user.id) {
      return NextResponse.json({ 
        error: 'Cannot set password for another owner.' 
      }, { status: 403 })
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update user password and set mustChangePassword flag
    await prisma.user.update({
      where: { id: params.userId },
      data: { 
        password: hashedPassword,
        mustChangePassword: forceChange,
        updatedAt: new Date()
      }
    })

    // Invalidate all active sessions for this user (force re-login)
    await prisma.userSession.updateMany({
      where: {
        userId: params.userId,
        isActive: true
      },
      data: {
        isActive: false
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.PASSWORD_CHANGED,
      entity: EntityTypes.USER,
      entityId: params.userId,
      details: {
        targetUserEmail: targetUser.email,
        targetUserName: targetUser.name,
        isAdminSet: true,
        forceChange,
        sessionsInvalidated: true
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: `Password updated for ${targetUser.name}. ${forceChange ? 'User must change password on next login.' : ''}`
    })

  } catch (error) {
    console.error('Admin password set error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}