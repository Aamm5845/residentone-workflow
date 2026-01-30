import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema
const updatePermissionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  canSeeBilling: z.boolean(),
})

interface AuthSession {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

// GET - Get billing permissions for all team members
export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only OWNER can manage billing permissions
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({
        error: 'Insufficient permissions. Only owners can manage billing permissions.'
      }, { status: 403 })
    }

    // Get all users with their billing permission status
    const users = await prisma.user.findMany({
      where: {
        orgId: session.user.orgId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canSeeBilling: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching billing permissions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update billing permission for a user
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only OWNER can manage billing permissions
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({
        error: 'Insufficient permissions. Only owners can manage billing permissions.'
      }, { status: 403 })
    }

    // Validate request body
    const body = await request.json()
    const validatedData = updatePermissionSchema.parse(body)

    // Check if user exists and belongs to the same org
    const targetUser = await prisma.user.findFirst({
      where: {
        id: validatedData.userId,
        orgId: session.user.orgId,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update the user's billing permission
    const updatedUser = await prisma.user.update({
      where: { id: validatedData.userId },
      data: {
        canSeeBilling: validatedData.canSeeBilling,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canSeeBilling: true,
      },
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error updating billing permission:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
