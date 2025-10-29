import { prisma } from '@/lib/prisma'

/**
 * Utility functions for phase management and sequencing
 */

export interface PhaseSequenceInfo {
  currentPhase: string
  nextPhase?: string
  previousPhase?: string
  isFirstPhase: boolean
  isLastPhase: boolean
  phaseOrder: number
}

export interface UserWithNotificationData {
  id: string
  name: string
  email: string
  role: string
  orgId: string
}

/**
 * Standard 5-phase workflow sequence
 */
export const PHASE_SEQUENCE = [
  'DESIGN_CONCEPT',
  'THREE_D', 
  'CLIENT_APPROVAL',
  'DRAWINGS',
  'FFE'
] as const

export type PhaseType = typeof PHASE_SEQUENCE[number]

/**
 * Get phase sequence information for a given phase
 */
export function getPhaseSequenceInfo(phaseType: string): PhaseSequenceInfo {
  const currentIndex = PHASE_SEQUENCE.indexOf(phaseType as PhaseType)
  
  if (currentIndex === -1) {
    throw new Error(`Unknown phase type: ${phaseType}`)
  }
  
  return {
    currentPhase: phaseType,
    nextPhase: currentIndex < PHASE_SEQUENCE.length - 1 ? PHASE_SEQUENCE[currentIndex + 1] : undefined,
    previousPhase: currentIndex > 0 ? PHASE_SEQUENCE[currentIndex - 1] : undefined,
    isFirstPhase: currentIndex === 0,
    isLastPhase: currentIndex === PHASE_SEQUENCE.length - 1,
    phaseOrder: currentIndex + 1
  }
}

/**
 * Get the next phase(s) that should be notified when a phase completes
 * Special handling for client approval -> both drawings and FFE
 */
export function getNextPhasesToNotify(completedPhaseType: string): string[] {
  if (completedPhaseType === 'CLIENT_APPROVAL') {
    // Special case: client approval completion notifies both drawings and FFE
    return ['DRAWINGS', 'FFE']
  }
  
  const sequenceInfo = getPhaseSequenceInfo(completedPhaseType)
  return sequenceInfo.nextPhase ? [sequenceInfo.nextPhase] : []
}

/**
 * Get phase display name for UI and notifications
 */
export function getPhaseDisplayName(phaseType: string): string {
  const phaseNames: Record<string, string> = {
    'DESIGN_CONCEPT': 'Design Concept',
    'THREE_D': '3D Rendering',
    'CLIENT_APPROVAL': 'Client Approval', 
    'DRAWINGS': 'Drawings',
    'FFE': 'FFE (Furniture, Fixtures & Equipment)'
  }
  
  return phaseNames[phaseType] || phaseType
}

/**
 * Get phase description for notifications
 */
export function getPhaseDescription(phaseType: string): string {
  const descriptions: Record<string, string> = {
    'DESIGN_CONCEPT': 'Create mood boards, material selections, and design concepts',
    'THREE_D': 'Generate photorealistic 3D visualizations and renderings',
    'CLIENT_APPROVAL': 'Client review and approval process with presentation materials',
    'DRAWINGS': 'Create detailed technical drawings and construction specifications',
    'FFE': 'Premium furniture, fixtures, and equipment sourcing with detailed specifications'
  }
  
  return descriptions[phaseType] || ''
}

/**
 * Get all users assigned to phases in a room
 */
export async function getRoomPhaseAssignees(roomId: string): Promise<UserWithNotificationData[]> {
  try {
    const stages = await prisma.stage.findMany({
      where: {
        roomId: roomId,
        assignedTo: { not: null }
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            orgId: true
          }
        }
      }
    })
    
    const uniqueUsers = new Map<string, UserWithNotificationData>()
    
    stages.forEach(stage => {
      if (stage.assignedUser) {
        uniqueUsers.set(stage.assignedUser.id, stage.assignedUser as UserWithNotificationData)
      }
    })
    
    return Array.from(uniqueUsers.values())
  } catch (error) {
    console.error('Error getting room phase assignees:', error)
    return []
  }
}

/**
 * Get users assigned to specific phases in a room
 */
export async function getPhaseAssignees(roomId: string, phaseTypes: string[]): Promise<{
  phase: string
  assignee: UserWithNotificationData | null
}[]> {
  try {
    const stages = await prisma.stage.findMany({
      where: {
        roomId: roomId,
        type: { in: phaseTypes }
      },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            orgId: true
          }
        }
      }
    })
    
    return phaseTypes.map(phaseType => {
      const stage = stages.find(s => s.type === phaseType)
      return {
        phase: phaseType,
        assignee: stage?.assignedUser as UserWithNotificationData | null
      }
    })
  } catch (error) {
    console.error('Error getting phase assignees:', error)
    return phaseTypes.map(phase => ({ phase, assignee: null }))
  }
}

/**
 * Get project team members for notifications
 */
export async function getProjectTeamMembers(projectId: string): Promise<UserWithNotificationData[]> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                orgId: true
              },
              where: {
                name: { not: { startsWith: '[DELETED]' } },
                email: { not: { startsWith: 'deleted_' } }
              }
            }
          }
        }
      }
    })
    
    return project?.organization?.users as UserWithNotificationData[] || []
  } catch (error) {
    console.error('Error getting project team members:', error)
    return []
  }
}

/**
 * Get room information with project and client details
 */
export async function getRoomNotificationContext(roomId: string) {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        project: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        stages: {
          include: {
            assignedUser: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    })
    
    return room
  } catch (error) {
    console.error('Error getting room notification context:', error)
    return null
  }
}

/**
 * Check if a phase has prerequisites completed
 */
export async function arePhasePrerequisitesCompleted(roomId: string, phaseType: string): Promise<boolean> {
  const sequenceInfo = getPhaseSequenceInfo(phaseType)
  
  if (sequenceInfo.isFirstPhase) {
    return true // First phase has no prerequisites
  }
  
  try {
    // For client approval, only need previous phase (3D rendering) completed
    if (phaseType === 'CLIENT_APPROVAL') {
      const threeDStage = await prisma.stage.findFirst({
        where: {
          roomId: roomId,
          type: 'THREE_D'
        }
      })
      
      return threeDStage?.status === 'COMPLETED'
    }
    
    // For drawings and FFE after client approval, they can both start
    if (phaseType === 'DRAWINGS' || phaseType === 'FFE') {
      const clientApprovalStage = await prisma.stage.findFirst({
        where: {
          roomId: roomId,
          type: 'CLIENT_APPROVAL'
        }
      })
      
      return clientApprovalStage?.status === 'COMPLETED'
    }
    
    // For other phases, check if previous phase is completed
    if (sequenceInfo.previousPhase) {
      const previousStage = await prisma.stage.findFirst({
        where: {
          roomId: roomId,
          type: sequenceInfo.previousPhase
        }
      })
      
      return previousStage?.status === 'COMPLETED'
    }
    
    return false
  } catch (error) {
    console.error('Error checking phase prerequisites:', error)
    return false
  }
}

/**
 * Get phase completion percentage for a room
 */
export async function getRoomCompletionPercentage(roomId: string): Promise<number> {
  try {
    const stages = await prisma.stage.findMany({
      where: {
        roomId: roomId,
        type: { in: PHASE_SEQUENCE as readonly string[] },
        status: { not: 'NOT_APPLICABLE' }
      }
    })
    
    if (stages.length === 0) return 0
    
    const completedStages = stages.filter(stage => stage.status === 'COMPLETED')
    return Math.round((completedStages.length / stages.length) * 100)
  } catch (error) {
    console.error('Error getting room completion percentage:', error)
    return 0
  }
}

/**
 * Format room display name
 */
export function formatRoomDisplayName(room: { name?: string | null, type: string }): string {
  if (room.name) {
    return room.name
  }
  
  // Convert room type to display format
  return room.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Generate phase transition summary for logging
 */
export function generatePhaseTransitionSummary(
  completedPhase: string,
  nextPhases: string[],
  roomName: string,
  projectName: string
): string {
  const completedDisplayName = getPhaseDisplayName(completedPhase)
  const nextDisplayNames = nextPhases.map(getPhaseDisplayName)
  
  let summary = `${completedDisplayName} completed for ${roomName} in ${projectName}.`
  
  if (nextDisplayNames.length > 0) {
    summary += ` Next phase${nextDisplayNames.length > 1 ? 's' : ''}: ${nextDisplayNames.join(', ')}.`
  } else {
    summary += ' This was the final phase.'
  }
  
  return summary
}
