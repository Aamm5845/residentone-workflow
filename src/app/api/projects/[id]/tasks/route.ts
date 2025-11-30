import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const taskCreateSchema = z.object({
  updateId: z.string().optional(),
  roomId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).default('TODO'),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NORMAL']).default('MEDIUM'),
  assigneeId: z.string().optional(),
  contractorId: z.string().optional(),
  tradeType: z.string().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
  estimatedCost: z.number().optional(),
  actualCost: z.number().optional(),
  materials: z.record(z.any()).optional(),
  dependencies: z.array(z.string()).default([]),
  dueDate: z.string().datetime().optional()
})

const taskUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NORMAL']).optional(),
  assigneeId: z.string().optional(),
  contractorId: z.string().optional(),
  tradeType: z.string().optional(),
  estimatedHours: z.number().optional(),
  actualHours: z.number().optional(),
  estimatedCost: z.number().optional(),
  actualCost: z.number().optional(),
  materials: z.record(z.any()).optional(),
  dependencies: z.array(z.string()).optional(),
  dueDate: z.string().datetime().optional()
})

// GET /api/projects/[id]/tasks - Get all tasks for a project
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
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const assigneeId = searchParams.get('assigneeId')
    const contractorId = searchParams.get('contractorId')
    const tradeType = searchParams.get('tradeType')
    const roomId = searchParams.get('roomId')
    const updateId = searchParams.get('updateId')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

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
      projectId
    }

    if (status) where.status = status
    if (priority) where.priority = priority
    if (assigneeId) where.assigneeId = assigneeId
    if (contractorId) where.contractorId = contractorId
    if (tradeType) where.tradeType = tradeType
    if (roomId) where.roomId = roomId
    if (updateId) where.updateId = updateId

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tradeType: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get tasks with all related data
    const [tasks, totalCount] = await Promise.all([
      prisma.projectUpdateTask.findMany({
        where,
        include: {
          update: {
            select: {
              id: true,
              title: true,
              type: true,
              category: true
            }
          },
          room: {
            select: {
              id: true,
              name: true,
              type: true
            }
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true
            }
          },
          contractor: {
            select: {
              id: true,
              businessName: true,
              contactName: true,
              email: true,
              phone: true,
              specialty: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          },
          messages: {
            take: 3,
            orderBy: { createdAt: 'desc' }
          },
          assignments: true,
          _count: {
            select: {
              messages: true,
              assignments: true
            }
          }
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.projectUpdateTask.count({ where })
    ])

    // Get dependency information
    const tasksWithDependencies = await Promise.all(
      tasks.map(async (task) => {
        if (task.dependencies.length > 0) {
          const dependencyTasks = await prisma.projectUpdateTask.findMany({
            where: {
              id: { in: task.dependencies },
              projectId
            },
            select: {
              id: true,
              title: true,
              status: true,
              completedAt: true
            }
          })
          return { ...task, dependencyTasks }
        }
        return { ...task, dependencyTasks: [] }
      })
    )

    // Get statistics
    const stats = await prisma.projectUpdateTask.groupBy({
      by: ['status', 'priority', 'tradeType'],
      where: { projectId },
      _count: true,
      _sum: {
        estimatedHours: true,
        actualHours: true,
        estimatedCost: true,
        actualCost: true
      }
    })

    return NextResponse.json({
      tasks: tasksWithDependencies,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1
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
        byTradeType: stats.reduce((acc, stat) => {
          if (stat.tradeType) acc[stat.tradeType] = (acc[stat.tradeType] || 0) + stat._count
          return acc
        }, {} as Record<string, number>),
        totals: {
          estimatedHours: stats.reduce((sum, stat) => sum + (stat._sum.estimatedHours || 0), 0),
          actualHours: stats.reduce((sum, stat) => sum + (stat._sum.actualHours || 0), 0),
          estimatedCost: stats.reduce((sum, stat) => sum + (stat._sum.estimatedCost || 0), 0),
          actualCost: stats.reduce((sum, stat) => sum + (stat._sum.actualCost || 0), 0),
          completedTasks: stats.filter(s => s.status === 'DONE').reduce((sum, stat) => sum + stat._count, 0),
          overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length
        }
      }
    })

  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/tasks - Create a new task
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
    const validatedData = taskCreateSchema.parse(body)

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

    // Verify update exists if provided
    if (validatedData.updateId) {
      const update = await prisma.projectUpdate.findFirst({
        where: {
          id: validatedData.updateId,
          projectId
        }
      })
      if (!update) {
        return NextResponse.json({ error: 'Update not found' }, { status: 400 })
      }
    }

    // Verify room exists if provided
    if (validatedData.roomId) {
      const room = await prisma.room.findFirst({
        where: {
          id: validatedData.roomId,
          projectId
        }
      })
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 400 })
      }
    }

    // Verify assignee exists if provided
    if (validatedData.assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: validatedData.assigneeId,
          organization: { users: { some: { id: session.user.id } } }
        }
      })
      if (!assignee) {
        return NextResponse.json({ error: 'Assignee not found' }, { status: 400 })
      }
    }

    // Verify contractor exists if provided
    if (validatedData.contractorId) {
      const contractor = await prisma.contractor.findFirst({
        where: {
          id: validatedData.contractorId,
          organization: { users: { some: { id: session.user.id } } }
        }
      })
      if (!contractor) {
        return NextResponse.json({ error: 'Contractor not found' }, { status: 400 })
      }
    }

    // Verify dependencies exist if provided
    if (validatedData.dependencies.length > 0) {
      const existingDependencies = await prisma.projectUpdateTask.findMany({
        where: {
          id: { in: validatedData.dependencies },
          projectId
        },
        select: { id: true }
      })
      
      if (existingDependencies.length !== validatedData.dependencies.length) {
        return NextResponse.json({ error: 'Some dependency tasks not found' }, { status: 400 })
      }
    }

    // Create task
    const task = await prisma.projectUpdateTask.create({
      data: {
        projectId,
        updateId: validatedData.updateId,
        roomId: validatedData.roomId,
        title: validatedData.title,
        description: validatedData.description,
        status: validatedData.status,
        priority: validatedData.priority,
        assigneeId: validatedData.assigneeId,
        contractorId: validatedData.contractorId,
        tradeType: validatedData.tradeType,
        estimatedHours: validatedData.estimatedHours,
        actualHours: validatedData.actualHours,
        estimatedCost: validatedData.estimatedCost,
        actualCost: validatedData.actualCost,
        materials: validatedData.materials,
        dependencies: validatedData.dependencies,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        createdById: session.user.id
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        contractor: {
          select: {
            id: true,
            businessName: true,
            contactName: true,
            specialty: true
          }
        },
        createdBy: {
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
        }
      }
    })

    // Create activity log
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId: validatedData.updateId,
        actorId: session.user.id,
        actionType: 'CREATE',
        entityType: 'TASK',
        entityId: task.id,
        description: `Created task: ${validatedData.title}${validatedData.assigneeId ? ` (assigned to ${task.assignee?.name})` : ''}`,
        metadata: {
          taskId: task.id,
          taskTitle: validatedData.title,
          priority: validatedData.priority,
          assigneeId: validatedData.assigneeId,
          contractorId: validatedData.contractorId,
          dueDate: validatedData.dueDate
        }
      }
    })

    // Send notification to assignee if assigned
    if (validatedData.assigneeId && validatedData.assigneeId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: validatedData.assigneeId,
          type: 'TASK_ASSIGNED',
          title: 'New Task Assigned',
          message: `You have been assigned a new task: ${validatedData.title}`,
          relatedId: task.id,
          relatedType: 'task'
        }
      })
    }

    // Revalidate paths
    revalidatePath(`/projects/${projectId}/project-updates`)

    // TODO: Send real-time notification via WebSocket
    // TODO: Send email notification if enabled

    return NextResponse.json({ success: true, task }, { status: 201 })

  } catch (error) {
    console.error('Error creating task:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}