import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

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

// GET /api/projects/[id]/tasks/[taskId] - Get specific task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, taskId } = await params

    // Check if user has access to project and task
    const task = await prisma.projectUpdateTask.findFirst({
      where: {
        id: taskId,
        projectId,
        project: {
          OR: [
            { createdById: session.user.id },
            { updatedById: session.user.id },
            { organization: { users: { some: { id: session.user.id } } } }
          ]
        }
      },
      include: {
        update: {
          select: {
            id: true,
            title: true,
            type: true,
            category: true,
            status: true
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
          orderBy: { createdAt: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true
              }
            }
          }
        },
        assignments: true
      }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Get dependency information
    let dependencyTasks = []
    if (task.dependencies.length > 0) {
      dependencyTasks = await prisma.projectUpdateTask.findMany({
        where: {
          id: { in: task.dependencies },
          projectId
        },
        select: {
          id: true,
          title: true,
          status: true,
          completedAt: true,
          assignee: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    }

    // Get tasks that depend on this task
    const dependentTasks = await prisma.projectUpdateTask.findMany({
      where: {
        dependencies: { has: taskId },
        projectId
      },
      select: {
        id: true,
        title: true,
        status: true,
        assignee: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      ...task,
      dependencyTasks,
      dependentTasks
    })

  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/projects/[id]/tasks/[taskId] - Update specific task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, taskId } = await params
    const body = await request.json()

    // Validate input
    const validatedData = taskUpdateSchema.parse(body)

    // Check if user has access to project and task
    const existingTask = await prisma.projectUpdateTask.findFirst({
      where: {
        id: taskId,
        projectId,
        project: {
          OR: [
            { createdById: session.user.id },
            { updatedById: session.user.id },
            { organization: { users: { some: { id: session.user.id } } } }
          ]
        }
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } }
      }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check permissions for certain operations
    const isOwner = existingTask.createdById === session.user.id
    const isAssignee = existingTask.assigneeId === session.user.id
    const isAdmin = ['OWNER', 'ADMIN'].includes(session.user.role)

    // Only task creator, assignee, or admin can update tasks
    if (!isOwner && !isAssignee && !isAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
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
    if (validatedData.dependencies && validatedData.dependencies.length > 0) {
      // Check for circular dependencies
      if (validatedData.dependencies.includes(taskId)) {
        return NextResponse.json({ error: 'Task cannot depend on itself' }, { status: 400 })
      }

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

      // TODO: Check for deeper circular dependencies using graph traversal
    }

    // Prepare update data
    const updateData: any = {
      ...validatedData,
      ...(validatedData.dueDate && { dueDate: new Date(validatedData.dueDate) }),
      ...(validatedData.status === 'DONE' && !existingTask.completedAt && {
        completedAt: new Date()
      }),
      ...(validatedData.status === 'IN_PROGRESS' && !existingTask.startedAt && {
        startedAt: new Date()
      })
    }

    // Update the task
    const updatedTask = await prisma.projectUpdateTask.update({
      where: { id: taskId },
      data: updateData,
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

    // Track significant changes for activity log
    const significantChanges = []
    if (validatedData.status && validatedData.status !== existingTask.status) {
      significantChanges.push(`status changed from ${existingTask.status} to ${validatedData.status}`)
    }
    if (validatedData.assigneeId && validatedData.assigneeId !== existingTask.assigneeId) {
      const newAssignee = updatedTask.assignee
      const oldAssignee = existingTask.assignee
      significantChanges.push(`assigned to ${newAssignee?.name || 'unassigned'} (previously ${oldAssignee?.name || 'unassigned'})`)
    }
    if (validatedData.priority && validatedData.priority !== existingTask.priority) {
      significantChanges.push(`priority changed from ${existingTask.priority} to ${validatedData.priority}`)
    }
    if (validatedData.dueDate && validatedData.dueDate !== existingTask.dueDate?.toISOString()) {
      significantChanges.push(`due date updated`)
    }

    // Create activity log for significant changes
    if (significantChanges.length > 0) {
      await prisma.projectUpdateActivity.create({
        data: {
          projectId,
          updateId: existingTask.updateId,
          actorId: session.user.id,
          actionType: 'UPDATE',
          entityType: 'TASK',
          entityId: taskId,
          description: `Updated task "${existingTask.title}": ${significantChanges.join(', ')}`,
          metadata: {
            taskId,
            taskTitle: existingTask.title,
            changes: Object.keys(validatedData).reduce((acc, key) => {
              const typedKey = key as keyof typeof validatedData
              if (validatedData[typedKey] !== existingTask[key as keyof typeof existingTask]) {
                acc[key] = {
                  from: existingTask[key as keyof typeof existingTask],
                  to: validatedData[typedKey]
                }
              }
              return acc
            }, {} as Record<string, any>)
          }
        }
      })
    }

    // Send notifications for assignment changes
    if (validatedData.assigneeId && validatedData.assigneeId !== existingTask.assigneeId) {
      // Notify new assignee
      if (validatedData.assigneeId !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: validatedData.assigneeId,
            type: 'TASK_ASSIGNED',
            title: 'Task Assigned to You',
            message: `You have been assigned to task: ${existingTask.title}`,
            relatedId: taskId,
            relatedType: 'task'
          }
        })
      }

      // Notify previous assignee if they exist
      if (existingTask.assigneeId && existingTask.assigneeId !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: existingTask.assigneeId,
            type: 'TASK_UNASSIGNED',
            title: 'Task Reassigned',
            message: `Task "${existingTask.title}" has been reassigned to another team member`,
            relatedId: taskId,
            relatedType: 'task'
          }
        })
      }
    }

    // Send completion notification
    if (validatedData.status === 'DONE' && existingTask.status !== 'DONE') {
      // Notify task creator if different from current user
      if (existingTask.createdById !== session.user.id) {
        await prisma.notification.create({
          data: {
            userId: existingTask.createdById,
            type: 'TASK_COMPLETED',
            title: 'Task Completed',
            message: `Task "${existingTask.title}" has been completed`,
            relatedId: taskId,
            relatedType: 'task'
          }
        })
      }
    }

    // Revalidate paths
    revalidatePath(`/projects/${projectId}/project-updates`)

    // TODO: Send real-time notification via WebSocket
    // TODO: Update dependent tasks if this task was blocking them

    return NextResponse.json({ success: true, task: updatedTask })

  } catch (error) {
    console.error('Error updating task:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/tasks/[taskId] - Delete specific task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, taskId } = await params

    // Check if user has access to project and task
    const existingTask = await prisma.projectUpdateTask.findFirst({
      where: {
        id: taskId,
        projectId,
        project: {
          OR: [
            { createdById: session.user.id },
            { updatedById: session.user.id },
            { organization: { users: { some: { id: session.user.id } } } }
          ]
        }
      },
      include: {
        assignee: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } }
      }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check permissions - only creator or admin can delete
    const isOwner = existingTask.createdById === session.user.id
    const isAdmin = ['OWNER', 'ADMIN'].includes(session.user.role)

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Only task creator or admin can delete tasks' }, { status: 403 })
    }

    // Check if task is being used as dependency
    const dependentTasks = await prisma.projectUpdateTask.findMany({
      where: {
        dependencies: { has: taskId },
        projectId
      },
      select: {
        id: true,
        title: true
      }
    })

    if (dependentTasks.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete task that is a dependency for other tasks',
        dependentTasks: dependentTasks.map(t => t.title)
      }, { status: 409 })
    }

    // Delete the task (cascade will handle messages, assignments, etc.)
    await prisma.projectUpdateTask.delete({
      where: { id: taskId }
    })

    // Create activity log
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        updateId: existingTask.updateId,
        actorId: session.user.id,
        actionType: 'DELETE',
        entityType: 'TASK',
        entityId: taskId,
        description: `Deleted task: ${existingTask.title}`,
        metadata: {
          taskId,
          taskTitle: existingTask.title,
          taskStatus: existingTask.status,
          assigneeId: existingTask.assigneeId,
          assigneeName: existingTask.assignee?.name
        }
      }
    })

    // Notify assignee if task was assigned
    if (existingTask.assigneeId && existingTask.assigneeId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: existingTask.assigneeId,
          type: 'TASK_DELETED',
          title: 'Task Deleted',
          message: `Task "${existingTask.title}" has been deleted`,
          relatedId: taskId,
          relatedType: 'task'
        }
      })
    }

    // Revalidate paths
    revalidatePath(`/projects/${projectId}/project-updates`)

    // TODO: Send real-time notification via WebSocket

    return NextResponse.json({ 
      success: true, 
      message: 'Task deleted successfully' 
    })

  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}