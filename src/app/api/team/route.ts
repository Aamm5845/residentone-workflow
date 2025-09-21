import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
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
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all team members in the organization
    const teamMembers = await prisma.user.findMany({
      where: { 
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
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only OWNER and ADMIN can add team members
    if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners and admins can add team members.' 
      }, { status: 403 })
    }

    const { name, email, role } = await request.json()

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

    // Create new team member (without password - they'll need to set it via invitation)
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        role,
        orgId: session.user.orgId,
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
