import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ProjectType, ProjectStatus } from '@prisma/client'
import type { Session } from 'next-auth'

// Validation schemas
const updateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200).optional(),
  description: z.string().optional(),
  type: z.nativeEnum(ProjectType).optional(),
  budget: z.number().positive().optional().nullable(),
  dueDate: z.string().optional().nullable(), // Accept date strings like '2024-12-31'
  clientId: z.string().optional(),
  coverImages: z.array(z.string()).optional().nullable(), // Array of image URLs
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

// Helper function to check if user can modify project - now allows all authenticated users
function canModifyProject(session: AuthSession): boolean {
  return true // Allow all authenticated users to modify projects
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
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
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
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
    console.log('Project update request body:', body)
    const validatedData = updateProjectSchema.parse(body)
    console.log('Validated data:', validatedData)

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

    // Update project - handle missing columns gracefully
    const updateData: any = {
      updatedAt: new Date(),
    }
    
    // Only update fields that are provided
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description
    }
    if (validatedData.type !== undefined) {
      updateData.type = validatedData.type
    }
    if (validatedData.budget !== undefined) {
      updateData.budget = validatedData.budget
    }
    if (validatedData.dueDate !== undefined) {
      updateData.dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null
    }
    if (validatedData.clientId !== undefined) {
      updateData.clientId = validatedData.clientId
    }
    
    // Only add new columns if they exist in the schema (for migration compatibility)
    if (validatedData.coverImages !== undefined) {
      updateData.coverImages = validatedData.coverImages
    }
    if (validatedData.dropboxFolder !== undefined) {
      updateData.dropboxFolder = validatedData.dropboxFolder
    }
    
    console.log('Update data being sent to DB:', updateData)
    
    const updatedProject = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
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
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const session = await getSession() as AuthSession | null
    
    if (!session?.user?.id) {
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
        id: params.id
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

    // Perform actual deletion with cascade
    // Delete in order: assets -> approvals -> comments -> tasks -> rendering data -> stages -> rooms -> project
    await prisma.$transaction(async (tx) => {
      console.log(`🗑️ Starting comprehensive deletion of project: ${existingProject.name}`)
      
      // Delete all project assets
      const deletedAssets = await tx.asset.deleteMany({
        where: { projectId: params.id }
      })
      console.log(`🗑️ Deleted ${deletedAssets.count} project-level assets`)
      
      // Delete all project approvals
      const deletedApprovals = await tx.approval.deleteMany({
        where: { projectId: params.id }
      })
      console.log(`🗑️ Deleted ${deletedApprovals.count} project-level approvals`)
      
      // Delete all project comments
      const deletedComments = await tx.comment.deleteMany({
        where: { projectId: params.id }
      })
      console.log(`🗑️ Deleted ${deletedComments.count} project-level comments`)
      
      // Delete all project tasks
      const deletedTasks = await tx.task.deleteMany({
        where: { projectId: params.id }
      })
      console.log(`🗑️ Deleted ${deletedTasks.count} project-level tasks`)
      
      // Get all room IDs for this project
      const rooms = await tx.room.findMany({
        where: { projectId: params.id },
        select: { id: true }
      })
      
      const roomIds = rooms.map(room => room.id)
      
      if (roomIds.length > 0) {
        // Delete room-related data
        await tx.asset.deleteMany({
          where: { roomId: { in: roomIds } }
        })
        
        await tx.comment.deleteMany({
          where: { roomId: { in: roomIds } }
        })
        
        await tx.task.deleteMany({
          where: { roomId: { in: roomIds } }
        })
        
        await tx.approval.deleteMany({
          where: { roomId: { in: roomIds } }
        })
        
        await tx.fFEItem.deleteMany({
          where: { roomId: { in: roomIds } }
        })
        
        // Get all stage IDs
        const stages = await tx.stage.findMany({
          where: { roomId: { in: roomIds } },
          select: { id: true }
        })
        
        const stageIds = stages.map(stage => stage.id)
        
        if (stageIds.length > 0) {
          console.log(`🗑️ Processing ${stageIds.length} stages for deletion`)
          
          // Delete rendering workspace data first (newer models)
          const renderingVersions = await tx.renderingVersion.findMany({
            where: { stageId: { in: stageIds } },
            select: { id: true }
          })
          
          const renderingVersionIds = renderingVersions.map(rv => rv.id)
          
          if (renderingVersionIds.length > 0) {
            console.log(`🗑️ Deleting ${renderingVersionIds.length} rendering versions`)
            
            // Delete rendering notes
            const deletedRenderingNotes = await tx.renderingNote.deleteMany({
              where: { renderingVersionId: { in: renderingVersionIds } }
            })
            console.log(`🗑️ Deleted ${deletedRenderingNotes.count} rendering notes`)
            
            // Delete rendering version assets
            const deletedRenderingAssets = await tx.asset.deleteMany({
              where: { renderingVersionId: { in: renderingVersionIds } }
            })
            console.log(`🗑️ Deleted ${deletedRenderingAssets.count} rendering assets`)
            
            // Delete client approval versions linked to rendering versions
            const deletedClientApprovalVersions = await tx.clientApprovalVersion.deleteMany({
              where: { renderingVersionId: { in: renderingVersionIds } }
            })
            console.log(`🗑️ Deleted ${deletedClientApprovalVersions.count} client approval versions`)
            
            // Delete the rendering versions themselves
            const deletedRenderingVersions = await tx.renderingVersion.deleteMany({
              where: { id: { in: renderingVersionIds } }
            })
            console.log(`🗑️ Deleted ${deletedRenderingVersions.count} rendering versions`)
          }
          
          // Delete drawings workspace data
          const deletedDrawingChecklistItems = await tx.drawingChecklistItem.deleteMany({
            where: { stageId: { in: stageIds } }
          })
          console.log(`🗑️ Deleted ${deletedDrawingChecklistItems.count} drawing checklist items`)
          
          // Delete stage-related data
          const deletedStageAssets = await tx.asset.deleteMany({
            where: { stageId: { in: stageIds } }
          })
          console.log(`🗑️ Deleted ${deletedStageAssets.count} stage assets`)
          
          const deletedStageComments = await tx.comment.deleteMany({
            where: { stageId: { in: stageIds } }
          })
          console.log(`🗑️ Deleted ${deletedStageComments.count} stage comments`)
          
          const deletedStageTasks = await tx.task.deleteMany({
            where: { stageId: { in: stageIds } }
          })
          console.log(`🗑️ Deleted ${deletedStageTasks.count} stage tasks`)
          
          // Delete design sections
          const sections = await tx.designSection.findMany({
            where: { stageId: { in: stageIds } },
            select: { id: true }
          })
          
          const sectionIds = sections.map(section => section.id)
          
          if (sectionIds.length > 0) {
            await tx.asset.deleteMany({
              where: { sectionId: { in: sectionIds } }
            })
            
            const deletedSectionComments = await tx.comment.deleteMany({
              where: { sectionId: { in: sectionIds } }
            })
            console.log(`🗑️ Deleted ${deletedSectionComments.count} section comments`)
          }
          
          const deletedDesignSections = await tx.designSection.deleteMany({
            where: { stageId: { in: stageIds } }
          })
          console.log(`🗑️ Deleted ${deletedDesignSections.count} design sections`)
          
          // Delete client approval stages
          const deletedClientApprovalStages = await tx.clientApprovalStage.deleteMany({
            where: { stageId: { in: stageIds } }
          })
          console.log(`🗑️ Deleted ${deletedClientApprovalStages.count} client approval stages`)
          
          // Delete activity logs for these stages
          const deletedActivityLogs = await tx.activityLog.deleteMany({
            where: {
              OR: [
                { entityId: { in: stageIds } },
                { details: { path: ['stageId'], in: stageIds } }
              ]
            }
          })
          console.log(`🗑️ Deleted ${deletedActivityLogs.count} activity logs`)
          
          // Delete stages
          const deletedStages = await tx.stage.deleteMany({
            where: { id: { in: stageIds } }
          })
          console.log(`🗑️ Deleted ${deletedStages.count} stages`)
        }
        
        // Delete rooms
        const deletedRooms = await tx.room.deleteMany({
          where: { id: { in: roomIds } }
        })
        console.log(`🗑️ Deleted ${deletedRooms.count} rooms`)
      }
      
      // Delete any remaining activity logs for this project
      const deletedProjectActivityLogs = await tx.activityLog.deleteMany({
        where: {
          OR: [
            { entityId: params.id },
            { details: { path: ['projectId'], equals: params.id } }
          ]
        }
      })
      console.log(`🗑️ Deleted ${deletedProjectActivityLogs.count} project activity logs`)
      
      // Finally delete the project
      const deletedProject = await tx.project.delete({
        where: { id: params.id }
      })
      console.log(`🎉 Successfully deleted project: ${deletedProject.name}`)
    })
    
    return NextResponse.json({
      success: true,
      message: 'Project has been permanently deleted',
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