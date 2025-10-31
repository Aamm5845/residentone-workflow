import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getSession() as Session & {
      user: {
        id: string
        role: string
      }
    } | null

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const resolvedParams = await params
    const { userId } = resolvedParams
    const body = await request.json()
    const { name, email } = body

    // Validate inputs
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check permissions: user can edit their own info, or OWNER/ADMIN can edit anyone's
    const canEdit = 
      session.user.id === userId || 
      ['OWNER', 'ADMIN'].includes(session.user.role)

    if (!canEdit) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this user' },
        { status: 403 }
      )
    }

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email.trim(),
        NOT: {
          id: userId
        }
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email is already in use by another user' },
        { status: 400 }
      )
    }

    // Update user information
    const updatedUser = await prisma.user.update({
      where: {
        id: userId
      },
      data: {
        name: name.trim(),
        email: email.trim()
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    return NextResponse.json({
      success: true,
      user: updatedUser
    })
  } catch (error) {
    console.error('Error updating personal information:', error)
    return NextResponse.json(
      { error: 'Failed to update personal information' },
      { status: 500 }
    )
  }
}
