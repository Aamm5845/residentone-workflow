import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { reassignPhasesOnRoleChange } from '@/lib/utils/auto-assignment'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import type { Session } from 'next-auth'

// Validation schema
const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(200).optional(),
  email: z.string().email("Invalid email address").optional(),
  role: z.nativeEnum(UserRole).optional(),
  image: z.string().min(1).optional().nullable(), // Accept relative URLs from local storage
  phoneNumber: z.string().optional().nullable(),
  smsNotificationsEnabled: z.boolean().optional(),
  canSeeBilling: z.boolean().optional(),
  canSeeFinancials: z.boolean().optional(),
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
  const params = await context.params
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user) {
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
        id: params.userId
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
  const params = await context.params
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user) {
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
    
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { 
        id: params.userId
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

      // Check if another user already has this role (enforce unique roles)
      const userWithRole = await prisma.user.findFirst({
        where: {
          role: validatedData.role,
          id: { not: params.userId },
          orgId: { not: null } // Only check active users
        },
        select: {
          id: true,
          name: true,
          role: true
        }
      })

      if (userWithRole) {
        return NextResponse.json({ 
          error: `Another user (${userWithRole.name}) already has the role '${validatedData.role}'. Each role can only be assigned to one team member at a time.` 
        }, { status: 400 })
      }
    }

    // Check if email is unique (if changing email)
    if (validatedData.email && validatedData.email !== existingUser.email) {
      // Prevent updating to example.com accounts in production
      if (process.env.NODE_ENV !== 'test' && validatedData.email.toLowerCase().endsWith('@example.com')) {
        return NextResponse.json({ 
          error: 'Invalid email domain. Please use a real email address.' 
        }, { status: 400 })
      }

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

    // Check billing permission change - only OWNER can modify
    if (validatedData.canSeeBilling !== undefined && session.user.role !== 'OWNER') {
      return NextResponse.json({
        error: 'Only owners can modify billing permissions.'
      }, { status: 403 })
    }

    // Check financials permission change - only OWNER can modify
    if (validatedData.canSeeFinancials !== undefined && session.user.role !== 'OWNER') {
      return NextResponse.json({
        error: 'Only owners can modify financials permissions.'
      }, { status: 403 })
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: params.userId },
      data: {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.email && { email: validatedData.email }),
        ...(validatedData.role && { role: validatedData.role }),
        ...(validatedData.image !== undefined && { image: validatedData.image }),
        ...(validatedData.phoneNumber !== undefined && { phoneNumber: validatedData.phoneNumber ? validatedData.phoneNumber.replace(/\D/g, '') : null }),
        ...(validatedData.smsNotificationsEnabled !== undefined && { smsNotificationsEnabled: validatedData.smsNotificationsEnabled }),
        ...(validatedData.canSeeBilling !== undefined && session.user.role === 'OWNER' && { canSeeBilling: validatedData.canSeeBilling }),
        ...(validatedData.canSeeFinancials !== undefined && session.user.role === 'OWNER' && { canSeeFinancials: validatedData.canSeeFinancials }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        phoneNumber: true,
        smsNotificationsEnabled: true,
        canSeeBilling: true,
        canSeeFinancials: true,
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

    // Handle role change auto-assignment
    if (validatedData.role && validatedData.role !== existingUser.role) {
      try {
        // Get shared organization
        const sharedOrg = await prisma.organization.findFirst()
        if (sharedOrg) {
          const reassignmentResult = await reassignPhasesOnRoleChange(
            params.userId,
            existingUser.role,
            validatedData.role,
            sharedOrg.id
          )
          
        }
      } catch (assignmentError) {
        console.error('Failed to auto-reassign phases on role change:', assignmentError)
        // Don't fail the user update if assignment fails
      }
    }

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
  const params = await context.params
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only owners can delete team members
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners can remove team members.' 
      }, { status: 403 })
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: { 
        id: params.userId
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