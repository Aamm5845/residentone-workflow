import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { taskNotificationService } from '@/lib/notifications/task-notification-service'

// Helper to get user from API key or session (same pattern as /api/extension/projects)
async function getAuthenticatedUser(request: NextRequest) {
  const apiKey = request.headers.get('X-Extension-Key')

  if (apiKey) {
    const token = await prisma.clientAccessToken.findFirst({
      where: {
        token: apiKey,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            orgId: true,
            role: true
          }
        }
      }
    })

    if (token?.createdBy) {
      return token.createdBy
    }
  }

  // Fall back to session
  const session = await getSession()
  if (!session?.user?.email) return null

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      orgId: true,
      role: true
    }
  })

  return user
}

// POST: Create a task from Gmail Add-on or Chrome extension
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!user.orgId) {
      return NextResponse.json({ error: 'User has no organization' }, { status: 400 })
    }

    const body = await request.json()
    const {
      title, description, projectId, assignedToId, priority,
      dueDate, emailLink, emailSubject, emailFrom
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!projectId) {
      return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    }
    if (!assignedToId) {
      return NextResponse.json({ error: 'Assignee is required' }, { status: 400 })
    }

    // Verify project belongs to user's org
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organization: { users: { some: { id: user.id } } }
      }
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        status: 'TODO',
        priority: priority || 'MEDIUM',
        projectId,
        assignedToId,
        createdById: user.id,
        dueDate: dueDate ? new Date(dueDate) : null,
        emailLink: emailLink || null,
        emailSubject: emailSubject || null,
        emailFrom: emailFrom || null,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      }
    })

    // Notify assignee (in-app + email)
    if (assignedToId) {
      try {
        await taskNotificationService.notifyTaskAssigned(
          {
            id: task.id,
            title: task.title,
            projectId: task.projectId,
            projectName: task.project?.name,
            startDate: null,
            dueDate: task.dueDate,
            priority: task.priority,
            description: task.description || undefined,
          },
          assignedToId,
          { id: user.id, name: user.name || null, email: user.email || '' }
        )
      } catch (notifError) {
        console.error('Notification error (non-blocking):', notifError)
      }
    }

    return NextResponse.json({ ok: true, task }, { status: 201 })
  } catch (error) {
    console.error('Extension task creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
