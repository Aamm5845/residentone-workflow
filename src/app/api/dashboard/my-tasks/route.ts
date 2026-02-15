import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get tasks assigned to the current user that are not done/cancelled
    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: session.user.id,
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: {
          select: { id: true, name: true },
        },
        _count: {
          select: { subtasks: true, comments: true },
        },
      },
      orderBy: [
        { dueDate: 'asc' },
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 15,
    })

    // Count completed subtasks for each task
    const tasksWithSubtaskProgress = await Promise.all(
      tasks.map(async (task) => {
        const completedSubtasks = await prisma.taskSubtask.count({
          where: { taskId: task.id, completed: true },
        })
        return {
          ...task,
          completedSubtasks,
        }
      })
    )

    return NextResponse.json({ tasks: tasksWithSubtaskProgress })
  } catch (error) {
    console.error('Dashboard my-tasks error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
