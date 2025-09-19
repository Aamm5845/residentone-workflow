import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import type { Session } from 'next-auth'

// Validation schema
const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(200).optional(),
  email: z.string().email("Invalid email address").optional(),
  role: z.nativeEnum(UserRole).optional(),
  image: z.string().url().optional().nullable(),
})

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

// Helper function to check if user can modify team members
function canModifyTeamMembers(session: AuthSession): boolean {
  return ['OWNER', 'ADMIN'].includes(session.user.role)
}

// Helper function to check if user can change specific role
function canChangeToRole(currentUserRole: string, targetRole: UserRole): boolean {
  // Only OWNER can change to/from OWNER role
  if (targetRole === 'OWNER' || currentUserRole === 'OWNER') {
    return currentUserRole === 'OWNER'
  }
  
  // ADMIN can change any other role
  if (currentUserRole === 'ADMIN') {
    return true
  }
  
  return false
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { params } = await context.params
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!canModifyTeamMembers(session)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners and admins can view team member details.' 
      }, { status: 403 })
    }

    const user = await prisma.user.findFirst({
      where: { 
        id: params.userId,
        orgId: session.user.orgId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignedStages: {
              where: {
                status: 'IN_PROGRESS'
              }
            },
            comments: true,
            uploadedAssets: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { params } = await context.params
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!canModifyTeamMembers(session)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners and admins can modify team members.' 
      }, { status: 403 })
    }

    // Validate request body
    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    // Check if user exists and belongs to same organization
    const existingUser = await prisma.user.findFirst({
      where: { 
        id: params.userId,
        orgId: session.user.orgId
      }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check role change permissions
    if (validatedData.role && validatedData.role !== existingUser.role) {
      if (!canChangeToRole(session.user.role, validatedData.role)) {
        return NextResponse.json({ 
          error: 'Insufficient permissions to change to this role.' 
        }, { status: 403 })
      }

      // Additional check: ADMIN cannot change OWNER's role
      if (existingUser.role === 'OWNER' && session.user.role !== 'OWNER') {
        return NextResponse.json({ 
          error: 'Only owners can modify owner roles.' 
        }, { status: 403 })
      }
    }

    // Check if email is unique (if changing email)
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          id: { not: params.userId }
        }
      })

      if (emailExists) {
        return NextResponse.json({ 
          error: 'Email already exists. Please use a different email.' 
        }, { status: 400 })
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: params.userId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.email && { email: validatedData.email }),
        ...(validatedData.role && { role: validatedData.role }),
        ...(validatedData.image !== undefined && { image: validatedData.image }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignedStages: {
              where: {
                status: 'IN_PROGRESS'
              }
            },
            comments: true,
            uploadedAssets: true
          }
        }
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { params } = await context.params
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only owners can delete team members
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners can remove team members.' 
      }, { status: 403 })
    }

    // Check if user exists and belongs to same organization
    const existingUser = await prisma.user.findFirst({
      where: { 
        id: params.userId,
        orgId: session.user.orgId
      }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent owner from deleting themselves
    if (params.userId === session.user.id) {
      return NextResponse.json({ 
        error: 'You cannot delete your own account.' 
      }, { status: 400 })
    }

    // Soft delete by removing from organization (set orgId to null)
    // This preserves data integrity while removing access
    const deletedUser = await prisma.user.update({
      where: { id: params.userId },
      data: {
        orgId: null,
        updatedAt: new Date(),
      }
    })

    return NextResponse.json({
      success: true,
      message: 'User removed from organization',
      userId: params.userId,
      userName: existingUser.name
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}