import { prisma } from '@/lib/prisma'
import { 
  recordFFEItemUsage, 
  createCustomFFEItem, 
  getEnhancedFFERecommendations 
} from './learning-system'
import { 
  getFFEGlobalSettings, 
  updateFFELibraryItemUsage,
  getFFELibraryItems
} from './global-settings'
import { validateFFECompletion } from './completion-validator'
import { FFEStatus } from '@prisma/client'

/**
 * Hooks into FFE item status updates to record learning data
 */
export async function handleFFEStatusUpdate(
  roomId: string,
  itemId: string,
  oldStatus: FFEStatus,
  newStatus: FFEStatus,
  actualPrice?: number,
  actualLeadTime?: number,
  supplierInfo?: { name: string; website?: string; rating?: number }
): Promise<void> {
  try {
    // Get room and organization info
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        project: {
          include: {
            organization: true
          }
        }
      }
    })

    if (!room) return

    const orgId = room.project.organization.id
    const roomType = room.type

    // Map FFE status to learning system status
    let learningStatus: 'COMPLETED' | 'NOT_NEEDED' | 'ABANDONED'
    
    if (newStatus === 'COMPLETED') {
      learningStatus = 'COMPLETED'
    } else if (newStatus === 'NOT_NEEDED') {
      learningStatus = 'NOT_NEEDED'
    } else if (oldStatus !== 'NOT_STARTED' && ['NOT_STARTED', 'CANCELLED'].includes(newStatus)) {
      learningStatus = 'ABANDONED'
    } else {
      // Status changes within the workflow don't need to be recorded
      return
    }

    // Record usage in learning system
    await recordFFEItemUsage(
      orgId,
      roomType,
      itemId,
      learningStatus,
      actualPrice,
      actualLeadTime,
      supplierInfo
    )

    // Update library item usage if this item is from library
    const libraryItem = await prisma.fFEItemLibrary.findFirst({
      where: {
        orgId,
        OR: [
          { id: itemId },
          { name: itemId } // In case itemId is actually item name
        ]
      }
    })

    if (libraryItem) {
      await updateFFELibraryItemUsage(
        libraryItem.id,
        learningStatus === 'COMPLETED',
        actualPrice,
        actualLeadTime
      )
    }

    // Check if settings allow auto-creation of templates
    const settings = await getFFEGlobalSettings(orgId)
    if (settings.autoCreateTemplatesFromProjects && learningStatus === 'COMPLETED') {
      await considerCreatingTemplate(roomId, itemId, orgId)
    }

  } catch (error) {
    console.error('Error handling FFE status update:', error)
    // Don't throw - this is analytics, not critical path
  }
}

/**
 * Considers creating a custom template from a successful FFE item
 */
async function considerCreatingTemplate(
  roomId: string,
  itemId: string,
  orgId: string
): Promise<void> {
  try {
    // Get FFE item details
    const ffeStatus = await prisma.fFEItemStatus.findFirst({
      where: {
        roomId,
        itemId,
        status: 'COMPLETED'
      },
      include: {
        room: {
          include: {
            project: true
          }
        }
      }
    })

    if (!ffeStatus) return

    // Check if template already exists
    const existingTemplate = await prisma.fFELearningItem.findFirst({
      where: {
        orgId,
        originalItemId: itemId,
        createdFromRoomId: roomId
      }
    })

    if (existingTemplate) return

    // Create template based on FFE item usage
    const roomType = ffeStatus.room.type
    
    // This would typically pull item details from your FFE configuration
    // For now, we'll create a basic template
    await prisma.fFELearningItem.create({
      data: {
        orgId,
        name: `Custom Template: ${itemId}`,
        category: 'custom', // Would determine from itemId
        roomTypes: [roomType],
        priority: 'medium',
        isRequired: false,
        isStandard: false,
        isGlobalTemplate: true,
        isCustom: true,
        originalItemId: itemId,
        createdFromProjectId: ffeStatus.room.project.id,
        createdFromRoomId: roomId,
        averagePrice: ffeStatus.actualPrice,
        averageLeadTime: ffeStatus.estimatedDelivery ? 
          Math.ceil((ffeStatus.estimatedDelivery.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24 * 7)) 
          : undefined,
        usageCount: 1,
        successCount: 1,
        successRate: 1.0,
        supplierData: ffeStatus.supplierLink ? {
          name: 'Unknown Supplier',
          website: ffeStatus.supplierLink
        } : null,
        tags: ['auto-generated'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

  } catch (error) {
    console.error('Error creating FFE template:', error)
  }
}

/**
 * Gets smart FFE recommendations for a room based on learning and library data
 */
export async function getSmartFFERecommendations(
  orgId: string,
  roomId: string,
  projectBudget?: number
): Promise<{
  recommended: any[]
  insights: {
    budgetEstimate: number
    timelineEstimate: number
    riskFactors: string[]
    opportunities: string[]
  }
  libraryItems: any[]
  customTemplates: any[]
}> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        project: true
      }
    })

    if (!room) {
      throw new Error('Room not found')
    }

    const roomType = room.type

    // Get enhanced recommendations from learning system
    const learningData = await getEnhancedFFERecommendations(
      orgId,
      roomType,
      projectBudget
    )

    // Get library items for this room type
    const libraryData = await getFFELibraryItems(
      orgId,
      { roomType, isTemplate: true },
      { page: 1, limit: 20, sortBy: 'usageCount', sortOrder: 'desc' }
    )

    // Combine recommendations
    const recommended = [
      ...learningData.recommendations.mostSuccessful.slice(0, 5),
      ...learningData.recommendations.budgetOptimized.slice(0, 3),
      ...learningData.recommendations.quickDelivery.slice(0, 2)
    ]

    return {
      recommended,
      insights: learningData.insights,
      libraryItems: libraryData.items,
      customTemplates: learningData.customItems
    }

  } catch (error) {
    console.error('Error getting smart FFE recommendations:', error)
    return {
      recommended: [],
      insights: {
        budgetEstimate: 0,
        timelineEstimate: 0,
        riskFactors: ['Error loading recommendations'],
        opportunities: []
      },
      libraryItems: [],
      customTemplates: []
    }
  }
}

/**
 * Analyzes FFE completion and provides detailed feedback
 */
export async function analyzeFFECompletion(
  roomId: string,
  includeRecommendations = false
): Promise<{
  completion: any
  analysis: {
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
    budgetAnalysis: {
      estimatedTotal: number
      actualTotal: number
      variance: number
      variantPercentage: number
    }
    timelineAnalysis: {
      estimatedWeeks: number
      actualWeeks?: number
      onTrack: boolean
      delayFactors: string[]
    }
  }
  nextSteps: string[]
}> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        project: {
          include: {
            organization: true
          }
        },
        ffeItemStatuses: true
      }
    })

    if (!room) {
      throw new Error('Room not found')
    }

    // Get completion validation
    const completion = await validateFFECompletion(roomId)

    // Analyze completion data
    const analysis = {
      strengths: [],
      weaknesses: [],
      recommendations: [],
      budgetAnalysis: {
        estimatedTotal: 0,
        actualTotal: 0,
        variance: 0,
        variantPercentage: 0
      },
      timelineAnalysis: {
        estimatedWeeks: completion.estimatedTimeline,
        actualWeeks: undefined,
        onTrack: true,
        delayFactors: []
      }
    }

    // Analyze strengths
    if (completion.completionPercentage > 80) {
      analysis.strengths.push('High completion rate achieved')
    }
    if (completion.issues.length === 0) {
      analysis.strengths.push('No significant issues identified')
    }
    if (completion.budgetEstimate > 0 && completion.budgetEstimate < (room.project.budget || Infinity) * 0.9) {
      analysis.strengths.push('Project is under budget')
    }

    // Analyze weaknesses
    if (completion.completionPercentage < 70) {
      analysis.weaknesses.push('Completion rate below target')
    }
    if (completion.issues.length > 3) {
      analysis.weaknesses.push('Multiple issues requiring attention')
    }

    // Budget analysis
    const estimatedCosts = room.ffeItemStatuses
      .map(status => status.actualPrice || 0)
      .reduce((sum, price) => sum + Number(price), 0)

    analysis.budgetAnalysis = {
      estimatedTotal: completion.budgetEstimate,
      actualTotal: estimatedCosts,
      variance: estimatedCosts - completion.budgetEstimate,
      variantPercentage: completion.budgetEstimate > 0 
        ? ((estimatedCosts - completion.budgetEstimate) / completion.budgetEstimate) * 100 
        : 0
    }

    // Generate recommendations
    if (includeRecommendations) {
      const smartRecs = await getSmartFFERecommendations(
        room.project.organization.id,
        roomId,
        room.project.budget
      )
      analysis.recommendations = smartRecs.insights.opportunities
    }

    // Determine next steps
    const nextSteps = []
    if (completion.completionPercentage < 100) {
      nextSteps.push(`Complete remaining ${completion.remainingItems} items`)
    }
    if (completion.issues.length > 0) {
      nextSteps.push('Address identified issues')
    }
    if (analysis.budgetAnalysis.variantPercentage > 10) {
      nextSteps.push('Review budget variance')
    }

    return {
      completion,
      analysis,
      nextSteps
    }

  } catch (error) {
    console.error('Error analyzing FFE completion:', error)
    throw new Error('Failed to analyze FFE completion')
  }
}

/**
 * Exports FFE data for reporting and analytics
 */
export async function exportFFEData(
  orgId: string,
  options?: {
    projectIds?: string[]
    roomIds?: string[]
    dateRange?: { start: Date; end: Date }
    includeTemplates?: boolean
    includeLearningData?: boolean
  }
): Promise<{
  projects: any[]
  templates: any[]
  learningInsights: any
  summary: {
    totalProjects: number
    totalRooms: number
    averageCompletionRate: number
    totalBudget: number
    averageTimeline: number
  }
}> {
  try {
    // This would generate comprehensive FFE data export
    // Implementation would depend on specific reporting needs
    
    const projects = await prisma.project.findMany({
      where: {
        orgId,
        id: options?.projectIds ? { in: options.projectIds } : undefined,
        createdAt: options?.dateRange ? {
          gte: options.dateRange.start,
          lte: options.dateRange.end
        } : undefined
      },
      include: {
        rooms: {
          where: {
            id: options?.roomIds ? { in: options.roomIds } : undefined
          },
          include: {
            ffeItemStatuses: true
          }
        }
      }
    })

    // Calculate summary statistics
    const totalRooms = projects.reduce((sum, project) => sum + project.rooms.length, 0)
    const totalBudget = projects.reduce((sum, project) => sum + (project.budget || 0), 0)

    return {
      projects: projects.map(project => ({
        id: project.id,
        name: project.name,
        status: project.status,
        budget: project.budget,
        rooms: project.rooms.map(room => ({
          id: room.id,
          type: room.type,
          name: room.name,
          status: room.status,
          ffeItems: room.ffeItemStatuses.length
        }))
      })),
      templates: [], // Would include template data if requested
      learningInsights: {}, // Would include learning data if requested
      summary: {
        totalProjects: projects.length,
        totalRooms,
        averageCompletionRate: 0, // Would calculate based on actual data
        totalBudget,
        averageTimeline: 0 // Would calculate based on actual data
      }
    }

  } catch (error) {
    console.error('Error exporting FFE data:', error)
    throw new Error('Failed to export FFE data')
  }
}
