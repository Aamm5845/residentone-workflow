import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { autoAssignUserToPhases } from '@/lib/utils/auto-assignment'
import type { Session } from 'next-auth'

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all team members (exclude removed members with null orgId)
    const teamMembers = await prisma.user.findMany({
      where: {
        orgId: {
          not: null
        }
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
        },
        // Include recent activity for dashboard
        assignedStages: {
          where: {
            status: 'IN_PROGRESS'
          },
          take: 3,
          include: {
            room: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then ADMIN, etc.
        { createdAt: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      teamMembers
    })

  } catch (error) {
    console.error('Error fetching team members:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch team members' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only OWNER and ADMIN can add team members
    if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners and admins can add team members.' 
      }, { status: 403 })
    }

    const { name, email, role, image } = await request.json()

    // Validation
    if (!name || !email || !role) {
      return NextResponse.json({ 
        error: 'Name, email, and role are required' 
      }, { status: 400 })
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUser) {
      return NextResponse.json({ 
        error: 'A user with this email already exists' 
      }, { status: 409 })
    }

    // Get shared organization (first organization in the system)
    const sharedOrg = await prisma.organization.findFirst()
    if (!sharedOrg) {
      return NextResponse.json({ error: 'No shared organization found' }, { status: 500 })
    }

    // Create new team member (without password - they'll need to set it via invitation)
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        role,
        orgId: sharedOrg.id,
        image: image || null,
        // No password - user will be invited to set one
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
            assignedStages: true,
            comments: true,
            uploadedAssets: true
          }
        }
      }
    })

    // Auto-assign the new user to existing phases based on their role
    try {
      const assignmentResult = await autoAssignUserToPhases(newUser.id, role, sharedOrg.id)
      console.log(`Auto-assigned ${assignmentResult.assignedCount} phases to new user: ${assignmentResult.phases.join(', ')}`)
    } catch (assignmentError) {
      console.error('Failed to auto-assign phases to new user:', assignmentError)
      // Don't fail the user creation if assignment fails
    }

    // TODO: Send invitation email to the new user
    // await sendInvitationEmail(newUser.email, newUser.name, session.user.organization.name)

    return NextResponse.json({
      success: true,
      message: 'Team member added successfully',
      user: newUser
    })

  } catch (error) {
    console.error('Error adding team member:', error)
    return NextResponse.json({ 
      error: 'Failed to add team member' 
    }, { status: 500 })
  }
}
