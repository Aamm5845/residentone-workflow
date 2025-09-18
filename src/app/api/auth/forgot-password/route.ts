import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    // Validation
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    // Always return success to prevent email enumeration attacks
    // But only actually send email if user exists
    if (user) {
      // Delete any existing password reset tokens for this email
      await prisma.passwordResetToken.deleteMany({
        where: { email: email.toLowerCase() }
      })

      // Generate secure random token
      const resetToken = crypto.randomBytes(32).toString('hex')
      
      // Create password reset token (expires in 1 hour)
      await prisma.passwordResetToken.create({
        data: {
          email: email.toLowerCase(),
          token: resetToken,
          expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
        }
      })

      // Send password reset email (don't block response)
      sendPasswordResetEmail(email.toLowerCase(), resetToken).catch(error => {
        console.error('Failed to send password reset email:', error)
      })
    }

    // Always return success message to prevent email enumeration
    return NextResponse.json({
      message: 'If an account with that email exists, we have sent a password reset link.'
    })

  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}