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

      // Find all unassigned or pending stages of this type in the organization
      const stagesToAssign = await prisma.stage.findMany({
        where: {
          type: stageType,
          room: {
            project: {
              orgId: orgId
            }
          },
          status: {
            in: ['NOT_STARTED', 'PENDING'] // Only assign to non-started stages
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
    // Get all team members in the organization
    const teamMembers = await prisma.user.findMany({
      where: { orgId },
      select: {
        id: true,
        role: true,
        name: true
      }
    })

    // Get all stages for this room
    const stages = await prisma.stage.findMany({
      where: { roomId },
      select: {
        id: true,
        type: true,
        assignedTo: true
      }
    })

    let assignedCount = 0

    // Map stage types to phase configurations
    const stageTypeToPhaseMap: Record<string, string> = {
      'DESIGN_CONCEPT': 'DESIGN_CONCEPT',
      'THREE_D': 'RENDERING',
      'DRAWINGS': 'DRAWINGS',
      'FFE': 'FFE'
    }

    for (const stage of stages) {
      // Skip if already assigned
      if (stage.assignedTo) continue

      const phaseId = stageTypeToPhaseMap[stage.type]
      if (!phaseId) continue

      const phaseConfig = ROOM_PHASES.find(p => p.id === phaseId)
      if (!phaseConfig?.requiredRole) continue

      // Find a team member with the required role
      const assignee = teamMembers.find(member => member.role === phaseConfig.requiredRole)
      if (!assignee) continue

      // Assign the stage to the team member
      await prisma.stage.update({
        where: { id: stage.id },
        data: { assignedTo: assignee.id }
      })

      assignedCount++
      console.log(`Auto-assigned ${phaseConfig.label} stage to ${assignee.name} (${assignee.role})`)
    }

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
          room: {
            project: {
              orgId: orgId
            }
          },
          status: {
            in: ['NOT_STARTED', 'PENDING'] // Only unassign from non-started stages
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
          room: {
            project: {
              orgId: orgId
            }
          },
          status: {
            in: ['NOT_STARTED', 'PENDING']
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