import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { taskNotificationService } from '@/lib/notifications/task-notification-service'

// GET /api/tasks - Get all tasks for the current user (global My Tasks)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view') || 'assigned_to_me' // assigned_to_me | created_by_me | all
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const projectId = searchParams.get('projectId')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause based on view
    const where: any = {}

    if (view === 'assigned_to_me') {
      where.assignedToId = session.user.id
    } else if (view === 'created_by_me') {
      where.createdById = session.user.id
    } else {
      // 'all' - show tasks user is involved in
      where.OR = [
        { assignedToId: session.user.id },
        { createdById: session.user.id }
      ]
    }

    if (status) where.status = status
    if (priority) where.priority = priority
    if (projectId) where.projectId = projectId

    if (search) {
      const searchCondition = {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } }
        ]
      }
      // Merge search with existing where
      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchCondition]
        delete where.OR
      } else {
        where.AND = [searchCondition]
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
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
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true
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
        _count: {
          select: {
            subtasks: true,
            comments: true,
            attachments: true
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      }
    })

    // Get subtask completion counts for progress display
    const tasksWithProgress = await Promise.all(
      tasks.map(async (task) => {
        if (task._count.subtasks > 0) {
          const completedSubtasks = await prisma.taskSubtask.count({
            where: { taskId: task.id, completed: true }
          })
          return { ...task, completedSubtasks }
        }
        return { ...task, completedSubtasks: 0 }
      })
    )

    return NextResponse.json({ tasks: tasksWithProgress })
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tasks - Create a task (global context, requires projectId in body)
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, status, priority, projectId, roomId, stageId, assignedToId, dueDate } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!projectId) {
      return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organization: { users: { some: { id: session.user.id } } }
      }
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        projectId,
        roomId: roomId || null,
        stageId: stageId || null,
        assignedToId: assignedToId || null,
        createdById: session.user.id,
        dueDate: dueDate ? new Date(dueDate) : null
      },
      include: {
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        _count: { select: { subtasks: true, comments: true, attachments: true } }
      }
    })

    // Notify assignee if assigned to someone else
    if (assignedToId) {
      await taskNotificationService.notifyTaskAssigned(
        { id: task.id, title: task.title, projectId: task.projectId, projectName: task.project?.name },
        assignedToId,
        { id: session.user.id, name: session.user.name || null, email: session.user.email || '' }
      )
    }

    return NextResponse.json({ task }, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
