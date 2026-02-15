import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { taskNotificationService } from '@/lib/notifications/task-notification-service'

// GET /api/tasks/[taskId]/comments
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

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/tasks/[taskId]/comments - Add comment
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

    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Get task for notification context
    const task = await prisma.task.findFirst({
      where: { id: taskId },
      select: { id: true, title: true, assignedToId: true, createdById: true }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        authorId: session.user.id,
        content: body.content.trim()
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true }
        }
      }
    })

    // Notify task assignee and creator (but not the commenter)
    await taskNotificationService.notifyTaskComment(
      { id: task.id, title: task.title, projectId: '', assignedToId: task.assignedToId, createdById: task.createdById },
      { id: session.user.id, name: session.user.name || null, email: session.user.email || '' },
      body.content.trim()
    )

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/tasks/[taskId]/comments - Delete comment
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
    const commentId = searchParams.get('commentId')

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID is required' }, { status: 400 })
    }

    // Only allow deleting own comments (or admin/owner)
    const comment = await prisma.taskComment.findFirst({
      where: { id: commentId }
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    if (comment.authorId !== session.user.id && !['OWNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 })
    }

    await prisma.taskComment.delete({ where: { id: commentId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
