import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'
import {
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  isAdminUser,
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

    // Check permissions - only OWNER and ADMIN can reset passwords
    if (!isAdminUser(session)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners and admins can reset passwords.' 
      }, { status: 403 })
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

    // Prevent self-reset through admin interface (use regular forgot password for that)
    if (params.userId === session.user.id) {
      return NextResponse.json({ 
        error: 'Cannot reset your own password through admin interface. Use forgot password instead.' 
      }, { status: 400 })
    }

    // Additional check: only OWNER can reset another OWNER's password
    if (targetUser.role === 'OWNER' && session.user.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Only owners can reset other owners\' passwords.' 
      }, { status: 403 })
    }

    // Delete any existing password reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { email: targetUser.email.toLowerCase() }
    })

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex')
    
    // Create password reset token (expires in 24 hours for admin resets)
    await prisma.passwordResetToken.create({
      data: {
        email: targetUser.email.toLowerCase(),
        token: resetToken,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    })

    try {
      // Send password reset email (don't block response)
      await sendPasswordResetEmail(targetUser.email.toLowerCase(), resetToken, {
        isAdminReset: true,
        adminName: session.user.name || 'Administrator'
      })
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError)
      // Continue anyway - token is created
    }

    // Log the activity
    await logActivity({
      session,
      action: ActivityActions.PASSWORD_RESET_REQUESTED,
      entity: EntityTypes.USER,
      entityId: params.userId,
      details: {
        targetUserEmail: targetUser.email,
        targetUserName: targetUser.name,
        isAdminReset: true,
        resetTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      ipAddress
    })

    return NextResponse.json({
      success: true,
      message: `Password reset email sent to ${targetUser.name} (${targetUser.email})`
    })

  } catch (error) {
    console.error('Admin password reset error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}