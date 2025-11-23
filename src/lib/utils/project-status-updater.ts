import { prisma } from '@/lib/prisma'

/**
 * Automatically updates project status based on the status of its phases/stages
 * - DRAFT: No phases have started (all are NOT_STARTED or NOT_APPLICABLE)
 * - IN_PROGRESS: At least one phase has been started (IN_PROGRESS or COMPLETED)
 * - COMPLETED: All applicable phases are completed
 */
export async function autoUpdateProjectStatus(projectId: string): Promise<void> {
  try {
    // Get all stages for the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        rooms: {
          include: {
            stages: true
          }
        }
      }
    })

    if (!project) {
      console.error(`Project not found: ${projectId}`)
      return
    }

    // Get all stages
    const allStages = project.rooms.flatMap(room => room.stages)
    
    // Filter out CLIENT_APPROVAL stages as they're excluded from calculations
    const relevantStages = allStages.filter(stage => stage.type !== 'CLIENT_APPROVAL')
    
    if (relevantStages.length === 0) {
      // No stages to evaluate, keep as DRAFT
      return
    }

    // Count stages by status
    const applicableStages = relevantStages.filter(stage => stage.status !== 'NOT_APPLICABLE')
    const startedStages = relevantStages.filter(stage => 
      stage.status === 'IN_PROGRESS' || stage.status === 'COMPLETED'
    )
    const completedStages = relevantStages.filter(stage => stage.status === 'COMPLETED')

    let newStatus: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' = 'DRAFT'

    if (applicableStages.length === 0) {
      // All stages are NOT_APPLICABLE - keep as DRAFT
      newStatus = 'DRAFT'
    } else if (completedStages.length === applicableStages.length) {
      // All applicable stages are completed
      newStatus = 'COMPLETED'
    } else if (startedStages.length > 0) {
      // At least one stage has been started
      newStatus = 'IN_PROGRESS'
    }

    // Only update if status has changed
    if (project.status !== newStatus) {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: newStatus }
      })
      
      console.log(`✅ Project status updated: ${project.name} - ${project.status} → ${newStatus}`)
    }
  } catch (error) {
    console.error(`Failed to auto-update project status for ${projectId}:`, error)
    // Don't throw - this is a background operation that shouldn't fail the main request
  }
}
