import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const updateSchema = z.object({
  type: z.enum(['GENERAL', 'PHOTO', 'TASK', 'DOCUMENT', 'COMMUNICATION', 'MILESTONE', 'INSPECTION', 'ISSUE']).optional(),
  category: z.enum(['GENERAL', 'PROGRESS', 'QUALITY', 'SAFETY', 'BUDGET', 'SCHEDULE', 'COMMUNICATION', 'APPROVAL']).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD', 'REQUIRES_ATTENTION']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NORMAL']).optional(),
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
  actualCost: z.number().optional(),
  timeEstimated: z.number().optional(),
  timeLogged: z.number().optional(),
  metadata: z.record(z.any()).optional()
})

// GET /api/projects/[id]/updates/[updateId] - Get specific update
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, updateId } = await params

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

    // Get update with all relations
    const update = await prisma.projectUpdate.findFirst({
      where: {
        id: updateId,
        projectId
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
                filename: true,
                url: true,
                type: true,
                size: true,
                mimeType: true,
                metadata: true
              }
            },
            beforeAfterPair: {
              include: {
                asset: {
                  select: {
                    id: true,
                    title: true,
                    url: true,
                    type: true
                  }
                }
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
                email: true,
                image: true
              }
            },
            contractor: {
              select: {
                id: true,
                businessName: true,
                contactName: true,
                email: true,
                specialty: true
              }
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true
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
                filename: true,
                url: true,
                type: true,
                size: true,
                mimeType: true
              }
            },
            approvedBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        messages: {
          orderBy: {
            createdAt: 'asc'
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
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    name: true,
                    image: true
                  }
                }
              }
            }
          }
        },
        activities: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10,
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        },
        assignments: true,
        milestones: {
          orderBy: {
            targetDate: 'asc'
          }
        },
        parent: {
          select: {
            id: true,
            title: true,
            type: true
          }
        },
        children: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            createdAt: true
          }
        }
      }
    })

    if (!update) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 })
    }

    return NextResponse.json(update)
  } catch (error) {
    console.error('Error fetching update:', error)
    return NextResponse.json(
      { error: 'Failed to fetch update' },
      { status: 500 }
    )
  }
}

// PUT /api/projects/[id]/updates/[updateId] - Update specific update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, updateId } = await params
    const body = await request.json()

    // Validate input
    const validatedData = updateSchema.parse(body)

    // Check if user has access to project and update
    const existingUpdate = await prisma.projectUpdate.findFirst({
      where: {
        id: updateId,
        projectId,
        project: {
          OR: [
            { createdById: session.user.id },
            { updatedById: session.user.id },
            { organization: { users: { some: { id: session.user.id } } } }
          ]
        }
      }
    })

    if (!existingUpdate) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 })
    }

    // Prepare data for update
    const updateData: any = {
      ...validatedData,
      ...(validatedData.dueDate && { dueDate: new Date(validatedData.dueDate) }),
      ...(validatedData.status === 'COMPLETED' && !existingUpdate.completedAt && {
        completedAt: new Date(),
        completedById: session.user.id
      })
    }

    // Update the record
    const updatedRecord = await prisma.projectUpdate.update({
      where: { id: updateId },
      data: updateData,
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
    const changes = Object.keys(validatedData).filter(key => 
      validatedData[key as keyof typeof validatedData] !== existingUpdate[key as keyof typeof existingUpdate]
    )

    if (changes.length > 0) {
      await prisma.projectUpdateActivity.create({
        data: {
          projectId,
          updateId,
          actorId: session.user.id,
          actionType: 'UPDATE',
          entityType: 'PROJECT_UPDATE',
          entityId: updateId,
          description: `Updated ${changes.join(', ')}`,
          metadata: {
            changes: changes.reduce((acc, key) => ({
              ...acc,
              [key]: {
                from: existingUpdate[key as keyof typeof existingUpdate],
                to: validatedData[key as keyof typeof validatedData]
              }
            }), {})
          }
        }
      })
    }

    // Revalidate project updates page
    revalidatePath(`/projects/${projectId}/project-updates`)

    // TODO: Send real-time notification via WebSocket
    // TODO: Send notifications if status changed to COMPLETED or REQUIRES_ATTENTION

    return NextResponse.json(updatedRecord)
  } catch (error) {
    console.error('Error updating project update:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update record' },
      { status: 500 }
    )
  }
}

// DELETE /api/projects/[id]/updates/[updateId] - Delete specific update
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId, updateId } = await params

    // First verify user has access to the project
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

    // Then find the update
    const existingUpdate = await prisma.projectUpdate.findFirst({
      where: {
        id: updateId,
        projectId
      }
    })

    if (!existingUpdate) {
      return NextResponse.json({ error: 'Update not found' }, { status: 404 })
    }

    // Check if user can delete (only author or admin)
    const userRole = session.user.role
    const canDelete = existingUpdate.authorId === session.user.id || 
                     ['OWNER', 'ADMIN'].includes(userRole)

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete this update' },
        { status: 403 }
      )
    }

    // Delete the update (cascade will handle related records)
    await prisma.projectUpdate.delete({
      where: { id: updateId }
    })

    // Create activity log
    await prisma.projectUpdateActivity.create({
      data: {
        projectId,
        actorId: session.user.id,
        actionType: 'DELETE',
        entityType: 'PROJECT_UPDATE',
        entityId: updateId,
        description: `Deleted ${existingUpdate.type.toLowerCase()} update${existingUpdate.title ? `: ${existingUpdate.title}` : ''}`
      }
    })

    // Revalidate project updates page
    revalidatePath(`/projects/${projectId}/project-updates`)

    // TODO: Send real-time notification via WebSocket

    return NextResponse.json({ message: 'Update deleted successfully' })
  } catch (error) {
    console.error('Error deleting project update:', error)
    return NextResponse.json(
      { error: 'Failed to delete update' },
      { status: 500 }
    )
  }
}