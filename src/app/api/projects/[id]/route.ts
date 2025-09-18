import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ProjectType, ProjectStatus } from '@prisma/client'
import type { Session } from 'next-auth'

// Validation schemas
const updateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  description: z.string().optional(),
  type: z.nativeEnum(ProjectType).optional(),
  budget: z.number().positive().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  clientId: z.string().optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  dropboxFolder: z.string().optional().nullable(),
})

const deleteProjectSchema = z.object({
  confirmationName: z.string().min(1, "Project name confirmation is required"),
})

interface AuthSession extends Session {
  user: {
    id: string
    orgId: string
    role: 'OWNER' | 'ADMIN' | 'DESIGNER' | 'RENDERER' | 'DRAFTER' | 'FFE' | 'VIEWER'
  }
}

// Helper function to check if user can modify project
function canModifyProject(session: AuthSession): boolean {
  return ['OWNER', 'ADMIN'].includes(session.user.role)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await prisma.project.findFirst({
      where: { 
        id: params.id,
        orgId: session.user.orgId
      },
      include: {
        client: true,
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        rooms: {
          include: {
            stages: {
              include: {
                assignedUser: {
                  select: { id: true, name: true, email: true, role: true }
                }
              }
            }
          }
        },
        _count: {
          select: { 
            rooms: true,
            assets: true,
            approvals: true,
            comments: true
          }
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    if (!canModifyProject(session)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners and admins can modify projects.' 
      }, { status: 403 })
    }

    // Validate request body
    const body = await request.json()
    const validatedData = updateProjectSchema.parse(body)

    // Check if project exists and belongs to user's organization
    const existingProject = await prisma.project.findFirst({
      where: { 
        id: params.id,
        orgId: session.user.orgId
      },
      include: { client: true }
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // If clientId is provided, verify it belongs to the same organization
    if (validatedData.clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: validatedData.clientId,
          orgId: session.user.orgId
        }
      })

      if (!client) {
        return NextResponse.json({ 
          error: 'Invalid client. Client must belong to your organization.' 
        }, { status: 400 })
      }
    }

    // Update project
    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        type: validatedData.type,
        budget: validatedData.budget,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        clientId: validatedData.clientId || existingProject.clientId,
        coverImageUrl: validatedData.coverImageUrl,
        dropboxFolder: validatedData.dropboxFolder,
        updatedAt: new Date(),
      },
      include: {
        client: true,
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        rooms: {
          include: {
            stages: {
              include: {
                assignedUser: {
                  select: { id: true, name: true, email: true, role: true }
                }
              }
            }
          }
        },
        _count: {
          select: { 
            rooms: true,
            assets: true,
            approvals: true,
            comments: true
          }
        }
      }
    })

    return NextResponse.json(updatedProject)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error updating project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only owners can delete projects (more restrictive than updates)
    if (session.user.role !== 'OWNER') {
      return NextResponse.json({ 
        error: 'Insufficient permissions. Only owners can delete projects.' 
      }, { status: 403 })
    }

    // Get request body for confirmation
    const body = await request.json()
    const { confirmationName } = deleteProjectSchema.parse(body)

    // Check if project exists and get its details
    const existingProject = await prisma.project.findFirst({
      where: { 
        id: params.id,
        orgId: session.user.orgId
      }
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Verify project name confirmation
    if (confirmationName.trim() !== existingProject.name.trim()) {
      return NextResponse.json({ 
        error: 'Project name confirmation does not match. Please type the exact project name.' 
      }, { status: 400 })
    }

    // Perform soft delete (mark as deleted) instead of hard delete to preserve data integrity
    const deletedProject = await prisma.project.update({
      where: { id: params.id },
      data: {
        status: 'COMPLETED' as ProjectStatus, // Use COMPLETED as deleted status
        name: `[DELETED] ${existingProject.name}`,
        updatedAt: new Date(),
      }
    })

    // TODO: Consider implementing hard delete with cascade in the future
    // This would require careful handling of related data (rooms, stages, assets, etc.)
    
    return NextResponse.json({
      success: true,
      message: 'Project has been marked as deleted',
      projectId: params.id,
      originalName: existingProject.name
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 })
    }

    console.error('Error deleting project:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}