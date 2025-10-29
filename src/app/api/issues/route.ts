import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'
import { 
  withUpdateAttribution,
  logActivity,
  ActivityActions,
  EntityTypes,
  getIPAddress,
  isValidAuthSession,
  type AuthSession
} from '@/lib/attribution'

// Get all issues for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // Filter by status
    const assignedTo = searchParams.get('assignedTo') // Filter by assignee
    const projectId = searchParams.get('projectId') // Filter by project
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {}
    
    if (status && status !== 'all') {
      where.status = status
    }
    
    if (assignedTo && assignedTo !== 'all') {
      where.assignedTo = assignedTo
    }
    
    if (projectId) {
      where.projectId = projectId
    }

    const [issues, totalCount] = await Promise.all([
      prisma.issue.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { priority: 'desc' }, // High priority first
          { createdAt: 'desc' }  // Then newest first
        ],
        include: {
          reporter: {
            select: { 
              id: true, 
              name: true, 
              email: true,
              role: true,
              image: true
            }
          },
          assignee: {
            select: { 
              id: true, 
              name: true, 
              email: true,
              role: true,
              image: true
            }
          },
          resolver: {
            select: { 
              id: true, 
              name: true, 
              email: true,
              role: true,
              image: true
            }
          },
          project: {
            select: {
              id: true,
              name: true
            }
          },
          room: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          stage: {
            select: {
              id: true,
              type: true
            }
          },
          comments: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            },
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      }),
      prisma.issue.count({ where })
    ])

    return NextResponse.json({
      issues,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching issues:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create a new issue
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const ipAddress = getIPAddress(request)
    
    if (!isValidAuthSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { 
      title, 
      description, 
      type = 'GENERAL',
      priority = 'MEDIUM',
      projectId,
      roomId,
      stageId,
      metadata
    } = data

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json({ 
        error: 'Title and description are required' 
      }, { status: 400 })
    }

    // Get organization (using first org for shared workspace)
    const organization = await prisma.organization.findFirst()

    const issue = await prisma.issue.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        type,
        priority,
        status: 'OPEN',
        reportedBy: session.user.id,
        orgId: organization?.id || null,
        projectId: projectId || null,
        roomId: roomId || null,
        stageId: stageId || null,
        metadata: metadata || null
      },
      include: {
        reporter: {
          select: { 
            id: true, 
            name: true, 
            email: true,
            role: true,
            image: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        stage: {
          select: {
            id: true,
            type: true
          }
        }
      }
    })

    // Log the activity
    await logActivity({
      session,
      action: 'ISSUE_CREATED',
      entity: EntityTypes.PROJECT, // Using project as fallback entity type
      entityId: issue.id,
      details: {
        title: issue.title,
        type: issue.type,
        priority: issue.priority,
        projectId: issue.projectId,
        roomId: issue.roomId,
        stageId: issue.stageId
      },
      ipAddress
    })

    return NextResponse.json(issue, { status: 201 })
  } catch (error) {
    console.error('Error creating issue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
