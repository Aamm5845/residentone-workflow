import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { taskNotificationService } from '@/lib/notifications/task-notification-service'

// GET /api/tasks/[taskId] - Get full task details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId } = await params

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: {
          organization: { users: { some: { id: session.user.id } } }
        }
      },
      include: {
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        subtasks: { orderBy: { order: 'asc' } },
        comments: {
          include: {
            author: { select: { id: true, name: true, email: true, image: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        attachments: {
          include: {
            uploadedBy: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { subtasks: true, comments: true, attachments: true } }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Calculate subtask progress
    const completedSubtasks = task.subtasks.filter(s => s.completed).length

    return NextResponse.json({ task: { ...task, completedSubtasks } })
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/tasks/[taskId] - Update task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId } = await params
    const body = await request.json()

    // Verify access
    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: {
          organization: { users: { some: { id: session.user.id } } }
        }
      }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Build update data
    const updateData: any = {}
    if (body.title !== undefined) updateData.title = body.title.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.status !== undefined) {
      updateData.status = body.status
      if (body.status === 'DONE') {
        updateData.completedAt = new Date()
      } else if (existingTask.status === 'DONE') {
        updateData.completedAt = null
      }
    }
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.assignedToId !== undefined) updateData.assignedToId = body.assignedToId || null
    if (body.roomId !== undefined) updateData.roomId = body.roomId || null
    if (body.stageId !== undefined) updateData.stageId = body.stageId || null
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null
    if (body.order !== undefined) updateData.order = body.order

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        project: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, type: true } },
        stage: { select: { id: true, type: true } },
        assignedTo: { select: { id: true, name: true, email: true, image: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true, image: true } },
        _count: { select: { subtasks: true, comments: true, attachments: true } }
      }
    })

    // Notify on assignment change
    if (body.assignedToId && body.assignedToId !== existingTask.assignedToId) {
      await taskNotificationService.notifyTaskReassigned(
        { id: task.id, title: task.title, projectId: task.projectId, projectName: task.project?.name },
        body.assignedToId,
        existingTask.assignedToId,
        { id: session.user.id, name: session.user.name || null, email: session.user.email || '' }
      )
    }

    // Notify on completion
    if (body.status === 'DONE' && existingTask.status !== 'DONE') {
      await taskNotificationService.notifyTaskCompleted(
        { id: task.id, title: task.title, projectId: task.projectId, assignedToId: existingTask.assignedToId, createdById: existingTask.createdById },
        { id: session.user.id, name: session.user.name || null, email: session.user.email || '' }
      )
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[taskId] - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { taskId } = await params

    // Verify access
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        project: {
          organization: { users: { some: { id: session.user.id } } }
        }
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    await prisma.task.delete({ where: { id: taskId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
