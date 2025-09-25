import { prisma } from '@/lib/prisma'
import { ROOM_PHASES } from '@/lib/constants/room-phases'

/**
 * Auto-assign a team member to existing phases based on their role
 * This function will assign the user to all relevant phases across all projects in the organization
 */
export async function autoAssignUserToPhases(userId: string, userRole: string, orgId: string) {
  try {
    // Find all phases that match the user's role across all projects
    const eligiblePhases = ROOM_PHASES.filter(phase => 
      phase.requiredRole === userRole
    )

    if (eligiblePhases.length === 0) {
      console.log(`No auto-assignable phases found for role: ${userRole}`)
      return { assignedCount: 0, phases: [] }
    }

    console.log(`Auto-assigning user ${userId} with role ${userRole} to phases: ${eligiblePhases.map(p => p.label).join(', ')}`)

    // Map phase IDs to stage types (for legacy compatibility)
    const phaseToStageTypeMap: Record<string, string> = {
      'DESIGN_CONCEPT': 'DESIGN_CONCEPT',
      'RENDERING': 'THREE_D', // Legacy stage type
      'DRAWINGS': 'DRAWINGS',
      'FFE': 'FFE'
    }

    const assignedPhases: string[] = []
    let assignedCount = 0

    for (const phase of eligiblePhases) {
      const stageType = phaseToStageTypeMap[phase.id]
      if (!stageType) continue

      // Find all unassigned or pending stages of this type (no org filtering)
      const stagesToAssign = await prisma.stage.findMany({
        where: {
          type: stageType,
          status: {
            in: ['NOT_STARTED'] // Only assign to non-started stages
          },
          assignedTo: null // Only unassigned stages
        },
        include: {
          room: {
            include: {
              project: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })

      if (stagesToAssign.length > 0) {
        // Update all matching stages to assign them to this user
        const updateResult = await prisma.stage.updateMany({
          where: {
            id: {
              in: stagesToAssign.map(s => s.id)
            }
          },
          data: {
            assignedTo: userId
          }
        })

        assignedCount += updateResult.count
        assignedPhases.push(phase.label)
        console.log(`Assigned ${updateResult.count} ${phase.label} phases to user ${userId}`)
      }
    }

    return { assignedCount, phases: assignedPhases }
  } catch (error) {
    console.error('Error in autoAssignUserToPhases:', error)
    throw error
  }
}

/**
 * Auto-assign phases when a new project/room is created
 * This function assigns the appropriate team member to each phase based on their role
 */
export async function autoAssignPhasesToTeam(roomId: string, orgId: string) {
  try {
    console.log(`🎯 Starting auto-assignment for room ${roomId} in org ${orgId}`)
    
    // Get all team members (exclude deleted users and filter for current team)
    const teamMembers = await prisma.user.findMany({
      where: {
        AND: [
          { name: { not: { startsWith: '[DELETED]' } } },
          { email: { not: { startsWith: 'deleted_' } } },
          { email: { in: ['aaron@meisnerinteriors.com', 'shaya@meisnerinteriors.com', 'sami@meisnerinteriors.com', 'euvi.3d@gmail.com'] } }
        ]
      },
      select: {
        id: true,
        role: true,
        name: true,
        email: true
      }
    })

    console.log(`👥 Found ${teamMembers.length} team members:`, teamMembers.map(m => `${m.name} (${m.role})`).join(', '))

    // Get all stages for this room
    const stages = await prisma.stage.findMany({
      where: { roomId },
      select: {
        id: true,
        type: true,
        assignedTo: true
      }
    })

    console.log(`📋 Found ${stages.length} stages:`, stages.map(s => `${s.type} (${s.assignedTo ? 'assigned' : 'unassigned'})`).join(', '))

    let assignedCount = 0

    // Enhanced stage type to role mapping (covers all stage types)
    const stageTypeToRoleMap: Record<string, string | null> = {
      'DESIGN': 'DESIGNER',           // DESIGN stage maps to DESIGNER
      'DESIGN_CONCEPT': 'DESIGNER',   // DESIGN_CONCEPT stage maps to DESIGNER  
      'THREE_D': 'RENDERER',          // THREE_D stage maps to RENDERER
      'CLIENT_APPROVAL': null,        // CLIENT_APPROVAL can be handled by anyone (ADMIN/OWNER)
      'DRAWINGS': 'DRAFTER',          // DRAWINGS stage maps to DRAFTER
      'FFE': 'FFE'                    // FFE stage maps to FFE
    }

    for (const stage of stages) {
      // Skip if already assigned
      if (stage.assignedTo) {
        console.log(`⏭️  Skipping ${stage.type} - already assigned`)
        continue
      }

      const requiredRole = stageTypeToRoleMap[stage.type]
      console.log(`🔍 Processing ${stage.type} stage - requires role: ${requiredRole || 'any'}`)
      
      let assignee = null

      if (requiredRole) {
        // Find a team member with the specific required role
        assignee = teamMembers.find(member => member.role === requiredRole)
      } else {
        // For CLIENT_APPROVAL or other general tasks, assign to ADMIN or OWNER
        assignee = teamMembers.find(member => ['ADMIN', 'OWNER'].includes(member.role)) ||
                  teamMembers.find(member => member.role === 'DESIGNER') // Fallback to DESIGNER
      }

      if (!assignee) {
        console.log(`⚠️  No assignee found for ${stage.type} stage (required role: ${requiredRole})`)
        continue
      }

      // Assign the stage to the team member
      await prisma.stage.update({
        where: { id: stage.id },
        data: { assignedTo: assignee.id }
      })

      assignedCount++
      console.log(`✅ Auto-assigned ${stage.type} stage to ${assignee.name} (${assignee.role})`)
    }

    console.log(`🎯 Auto-assignment complete: ${assignedCount} stages assigned`)
    return { assignedCount }
  } catch (error) {
    console.error('Error in autoAssignPhasesToTeam:', error)
    throw error
  }
}

/**
 * Re-assign phases when a team member's role changes
 * This function will update assignments based on the new role
 */
export async function reassignPhasesOnRoleChange(userId: string, oldRole: string, newRole: string, orgId: string) {
  try {
    // Remove assignments from phases that no longer match the user's role
    const oldEligiblePhases = ROOM_PHASES.filter(phase => phase.requiredRole === oldRole)
    const newEligiblePhases = ROOM_PHASES.filter(phase => phase.requiredRole === newRole)

    const phasesToRemove = oldEligiblePhases.filter(phase => 
      !newEligiblePhases.some(newPhase => newPhase.id === phase.id)
    )

    const phasesToAdd = newEligiblePhases.filter(phase => 
      !oldEligiblePhases.some(oldPhase => oldPhase.id === phase.id)
    )

    let removedCount = 0
    let addedCount = 0

    // Remove assignments from phases that no longer match
    for (const phase of phasesToRemove) {
      const stageType = getStageTypeFromPhaseId(phase.id)
      if (!stageType) continue

      const updateResult = await prisma.stage.updateMany({
        where: {
          type: stageType,
          assignedTo: userId,
          status: {
            in: ['NOT_STARTED'] // Only unassign from non-started stages
          }
        },
        data: {
          assignedTo: null
        }
      })

      removedCount += updateResult.count
    }

    // Assign to new phases that match the new role
    for (const phase of phasesToAdd) {
      const stageType = getStageTypeFromPhaseId(phase.id)
      if (!stageType) continue

      const updateResult = await prisma.stage.updateMany({
        where: {
          type: stageType,
          assignedTo: null,
          status: {
            in: ['NOT_STARTED']
          }
        },
        data: {
          assignedTo: userId
        }
      })

      addedCount += updateResult.count
    }

    return { removedCount, addedCount }
  } catch (error) {
    console.error('Error in reassignPhasesOnRoleChange:', error)
    throw error
  }
}

/**
 * Auto-assign all existing unassigned stages across all projects
 * This function ensures no stage remains unassigned
 */
export async function autoAssignAllUnassignedStages() {
  try {
    console.log('🔄 Starting system-wide auto-assignment of unassigned stages...')
    
    // Get all team members (exclude deleted users and filter for current team)
    const teamMembers = await prisma.user.findMany({
      where: {
        AND: [
          { name: { not: { startsWith: '[DELETED]' } } },
          { email: { not: { startsWith: 'deleted_' } } },
          { email: { in: ['aaron@meisnerinteriors.com', 'shaya@meisnerinteriors.com', 'sami@meisnerinteriors.com', 'euvi.3d@gmail.com'] } }
        ]
      },
      select: {
        id: true,
        role: true,
        name: true,
        email: true
      }
    })

    console.log(`👥 Found ${teamMembers.length} team members`)

    // Get all unassigned stages
    const unassignedStages = await prisma.stage.findMany({
      where: {
        assignedTo: null
      },
      select: {
        id: true,
        type: true,
        room: {
          select: {
            id: true,
            name: true,
            project: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    console.log(`📋 Found ${unassignedStages.length} unassigned stages`)

    if (unassignedStages.length === 0) {
      console.log('✅ All stages are already assigned!')
      return { assignedCount: 0 }
    }

    let assignedCount = 0

    // Stage type to role mapping
    const stageTypeToRoleMap: Record<string, string | null> = {
      'DESIGN': 'DESIGNER',
      'DESIGN_CONCEPT': 'DESIGNER',
      'THREE_D': 'RENDERER',
      'CLIENT_APPROVAL': null, // Can be handled by ADMIN/OWNER
      'DRAWINGS': 'DRAFTER',
      'FFE': 'FFE'
    }

    for (const stage of unassignedStages) {
      const requiredRole = stageTypeToRoleMap[stage.type]
      let assignee = null

      if (requiredRole) {
        // Find a team member with the specific required role
        assignee = teamMembers.find(member => member.role === requiredRole)
      } else {
        // For CLIENT_APPROVAL, assign to ADMIN or OWNER
        assignee = teamMembers.find(member => ['ADMIN', 'OWNER'].includes(member.role)) ||
                  teamMembers.find(member => member.role === 'DESIGNER') // Fallback
      }

      if (!assignee) {
        console.log(`⚠️  No assignee found for ${stage.type} in ${stage.room.project.name}/${stage.room.name || stage.room.id}`)
        continue
      }

      // Assign the stage
      await prisma.stage.update({
        where: { id: stage.id },
        data: { assignedTo: assignee.id }
      })

      assignedCount++
      console.log(`✅ Assigned ${stage.type} in ${stage.room.project.name}/${stage.room.name || stage.room.id} to ${assignee.name} (${assignee.role})`)
    }

    console.log(`🎯 System-wide auto-assignment complete: ${assignedCount} stages assigned`)
    return { assignedCount }
  } catch (error) {
    console.error('Error in autoAssignAllUnassignedStages:', error)
    throw error
  }
}

// Helper function to map phase IDs to stage types
function getStageTypeFromPhaseId(phaseId: string): string | null {
  const map: Record<string, string> = {
    'DESIGN_CONCEPT': 'DESIGN_CONCEPT',
    'RENDERING': 'THREE_D',
    'DRAWINGS': 'DRAWINGS',
    'FFE': 'FFE'
  }
  return map[phaseId] || null
}
