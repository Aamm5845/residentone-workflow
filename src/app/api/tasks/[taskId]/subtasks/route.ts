import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/tasks/[taskId]/subtasks
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

    const subtasks = await prisma.taskSubtask.findMany({
      where: { taskId },
      orderBy: { order: 'asc' }
    })

    return NextResponse.json({ subtasks })
  } catch (error) {
    console.error('Error fetching subtasks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tasks/[taskId]/subtasks - Create subtask
export async function POST(
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

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Get max order
    const maxOrder = await prisma.taskSubtask.findFirst({
      where: { taskId },
      orderBy: { order: 'desc' },
      select: { order: true }
    })

    const subtask = await prisma.taskSubtask.create({
      data: {
        taskId,
        title: body.title.trim(),
        order: (maxOrder?.order ?? -1) + 1
      }
    })

    return NextResponse.json({ subtask }, { status: 201 })
  } catch (error) {
    console.error('Error creating subtask:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/tasks/[taskId]/subtasks - Update subtask (toggle, reorder, rename)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subtaskId, completed, title, order } = body

    if (!subtaskId) {
      return NextResponse.json({ error: 'Subtask ID is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (completed !== undefined) {
      updateData.completed = completed
      updateData.completedAt = completed ? new Date() : null
    }
    if (title !== undefined) updateData.title = title.trim()
    if (order !== undefined) updateData.order = order

    const subtask = await prisma.taskSubtask.update({
      where: { id: subtaskId },
      data: updateData
    })

    return NextResponse.json({ subtask })
  } catch (error) {
    console.error('Error updating subtask:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[taskId]/subtasks - Delete subtask
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const subtaskId = searchParams.get('subtaskId')

    if (!subtaskId) {
      return NextResponse.json({ error: 'Subtask ID is required' }, { status: 400 })
    }

    await prisma.taskSubtask.delete({ where: { id: subtaskId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting subtask:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
