import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const createUpdateSchema = z.object({
  type: z.enum(['GENERAL', 'PHOTO', 'TASK', 'DOCUMENT', 'COMMUNICATION', 'MILESTONE', 'INSPECTION', 'ISSUE']),
  category: z.enum(['GENERAL', 'PROGRESS', 'QUALITY', 'SAFETY', 'BUDGET', 'SCHEDULE', 'COMMUNICATION', 'APPROVAL']),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NORMAL']).default('MEDIUM'),
  title: z.string().optional(),
  description: z.string().optional(),
  roomId: z.string().optional(),
  location: z.string().optional(),
  gpsCoordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  dueDate: z.string().datetime().optional(),
  estimatedCost: z.number().optional(),
  timeEstimated: z.number().optional(),
  metadata: z.record(z.any()).optional()
})

const updateFilterSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD', 'REQUIRES_ATTENTION']).optional(),
  type: z.enum(['GENERAL', 'PHOTO', 'TASK', 'DOCUMENT', 'COMMUNICATION', 'MILESTONE', 'INSPECTION', 'ISSUE']).optional(),
  category: z.enum(['GENERAL', 'PROGRESS', 'QUALITY', 'SAFETY', 'BUDGET', 'SCHEDULE', 'COMMUNICATION', 'APPROVAL']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NORMAL']).optional(),
  roomId: z.string().optional(),
  authorId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional()
})

// GET /api/projects/[id]/updates - Get all updates for a project
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    
    // Validate filters
    const filters = updateFilterSchema.parse({
      status: searchParams.get('status'),
      type: searchParams.get('type'),
      category: searchParams.get('category'),
      priority: searchParams.get('priority'),
      roomId: searchParams.get('roomId'),
      authorId: searchParams.get('authorId'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search')
    })

    // Check if user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Build where clause
    const where: any = {
      projectId,
      ...(filters.status && { status: filters.status }),
      ...(filters.type && { type: filters.type }),
      ...(filters.category && { category: filters.category }),
      ...(filters.priority && { priority: filters.priority }),
      ...(filters.roomId && { roomId: filters.roomId }),
      ...(filters.authorId && { authorId: filters.authorId }),
      ...(filters.dateFrom || filters.dateTo) && {
        createdAt: {
          ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
          ...(filters.dateTo && { lte: new Date(filters.dateTo) })
        }
      },
      ...(filters.search && {
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { location: { contains: filters.search, mode: 'insensitive' } }
        ]
      })
    }

    // Pagination
    const page = parseInt(filters.page || '1')
    const limit = parseInt(filters.limit || '20')
    const skip = (page - 1) * limit

    // Get updates with relations
    const [updates, total] = await Promise.all([
      prisma.projectUpdate.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          room: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          completedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          photos: {
            include: {
              asset: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  type: true,
                  size: true,
                  mimeType: true
                }
              }
            }
          },
          tasks: {
            include: {
              assignee: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              contractor: {
                select: {
                  id: true,
                  businessName: true,
                  contactName: true,
                  specialty: true
                }
              }
            }
          },
          documents: {
            include: {
              asset: {
                select: {
                  id: true,
                  title: true,
                  url: true,
                  type: true,
                  size: true,
                  mimeType: true
                }
              }
            }
          },
          messages: {
            take: 3,
            orderBy: {
              createdAt: 'desc'
            },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          },
          _count: {
            select: {
              photos: true,
              tasks: true,
              documents: true,
              messages: true,
              children: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.projectUpdate.count({ where })
    ])

    // Get project stats
    const stats = await prisma.projectUpdate.groupBy({
      by: ['status', 'priority', 'type'],
      where: { projectId },
      _count: true
    })

    const response = {
      updates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        byStatus: stats.reduce((acc, stat) => {
          acc[stat.status] = (acc[stat.status] || 0) + stat._count
          return acc
        }, {} as Record<string, number>),
        byPriority: stats.reduce((acc, stat) => {
          acc[stat.priority] = (acc[stat.priority] || 0) + stat._count
          return acc
        }, {} as Record<string, number>),
        byType: stats.reduce((acc, stat) => {
          acc[stat.type] = (acc[stat.type] || 0) + stat._count
          return acc
        }, {} as Record<string, number>)
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching project updates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch updates' },
      { status: 500 }
    )
  }
}

// POST /api/projects/[id]/updates - Create a new update
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()

    // Validate input
    const validatedData = createUpdateSchema.parse(body)

    // Check if user has access to project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { createdById: session.user.id },
          { updatedById: session.user.id },
          { organization: { users: { some: { id: session.user.id } } } }
        ]
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create update
    const update = await prisma.projectUpdate.create({
      data: {
        ...validatedData,
        projectId,
        authorId: session.user.id,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : undefined
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        room: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        _count: {
          select: {
            photos: true,
            tasks: true,
            documents: true,
            messages: true
          }
        }
      }
    })

    // Create activity log
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId: update.id,
        actorId: session.user.id,
        actionType: 'CREATE',
        entityType: 'PROJECT_UPDATE',
        entityId: update.id,
        description: `Created ${validatedData.type.toLowerCase()} update${validatedData.title ? `: ${validatedData.title}` : ''}`
      }
    })

    // Revalidate project updates page
    revalidatePath(`/projects/${projectId}/project-updates`)

    // TODO: Send real-time notification via WebSocket
    // TODO: Send notifications to relevant stakeholders

    return NextResponse.json(update, { status: 201 })
  } catch (error) {
    console.error('Error creating project update:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create update' },
      { status: 500 }
    )
  }
}