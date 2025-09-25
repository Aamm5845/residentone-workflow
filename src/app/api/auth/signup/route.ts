import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
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

    // Password validation
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Find or create shared organization
    let organization = await prisma.organization.findFirst()
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: 'Shared Design Studio',
          slug: 'shared-design-studio'
        }
      })
    }

    // Check if this is the first user (should be OWNER) or a subsequent user (should be VIEWER)
    const existingUserCount = await prisma.user.count({
      where: {
        orgId: {
          not: null
        },
        approvalStatus: 'APPROVED'
      }
    })
    
    const userRole = existingUserCount === 0 ? 'OWNER' : 'VIEWER'
    const approvalStatus = existingUserCount === 0 ? 'APPROVED' : 'PENDING'

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        role: userRole,
        orgId: organization.id,
        approvalStatus: approvalStatus,
        approvedAt: existingUserCount === 0 ? new Date() : null
      },
      include: {
        organization: true
      }
    })

    // Send welcome email (don't block the response on email sending)
    sendWelcomeEmail(user.email, user.name || 'User').catch(error => {
      console.error('Failed to send welcome email:', error)
    })

    // Return success (without password)
    const successMessage = user.approvalStatus === 'PENDING' 
      ? 'Account created successfully! Your account is pending admin approval. You will receive an email once approved.'
      : 'Account created successfully!'

    return NextResponse.json({
      message: successMessage,
      requiresApproval: user.approvalStatus === 'PENDING',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
        organization: user.organization
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Signup error:', error)
    
    // Handle Prisma unique constraint errors
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
