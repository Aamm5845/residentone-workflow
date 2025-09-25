import { prisma } from '@/lib/prisma'
import { getDefaultFFEConfig, type FFEItemState, type FFEItemTemplate } from '@/lib/constants/room-ffe-config'

export interface FFECompletionResult {
  isComplete: boolean
  completionPercentage: number
  totalItems: number
  confirmedItems: number
  notNeededItems: number
  pendingItems: number
  missingRequired: FFEItemTemplate[]
  customItemsExpanded: number
  canForceComplete: boolean
  issues: string[]
}

export interface FFECompletionReport {
  roomId: string
  roomType: string
  completionResult: FFECompletionResult
  categoryBreakdown: {
    categoryName: string
    totalItems: number
    confirmedItems: number
    notNeededItems: number
    pendingItems: number
    completionPercentage: number
  }[]
  auditTrail: {
    action: string
    itemName: string
    user: string
    timestamp: Date
  }[]
  recommendations: string[]
}

/**
 * Validates FFE completion for a room based on QA checklist approach
 */
export async function validateFFECompletion(roomId: string): Promise<FFECompletionResult> {
  try {
    // Get room info
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        ffeItemStatuses: {
          include: {
            createdBy: { select: { name: true } },
            updatedBy: { select: { name: true } }
          }
        },
        project: {
          include: {
            organization: true
          }
        }
      }
    })

    if (!room) {
      throw new Error('Room not found')
    }

    // Get default FFE configuration for this room type
    const defaultConfig = getDefaultFFEConfig(room.type)
    if (!defaultConfig) {
      return {
        isComplete: true,
        completionPercentage: 100,
        totalItems: 0,
        confirmedItems: 0,
        notNeededItems: 0,
        pendingItems: 0,
        missingRequired: [],
        customItemsExpanded: 0,
        canForceComplete: true,
        issues: ['No FFE configuration found for this room type']
      }
    }

    // Get all items from configuration
    const allConfigItems: FFEItemTemplate[] = []
    defaultConfig.categories.forEach(category => {
      allConfigItems.push(...category.items)
    })

    // Get organization's custom items for this room type
    const customItems = await prisma.fFELibraryItem.findMany({
      where: {
        orgId: room.project.organization.id,
        roomTypes: { has: room.type }
      }
    })

    // Combine default and custom items
    const allItems = [...allConfigItems, ...customItems.map(item => ({
      id: item.itemId,
      name: item.name,
      category: item.category,
      isRequired: item.isRequired,
      isStandard: item.isStandard,
      subItems: item.subItems as any,
      conditionalOn: []
    }))]

    // Get current status of all items
    const itemStatusMap = new Map()
    room.ffeItemStatuses.forEach(status => {
      itemStatusMap.set(status.itemId, status)
    })

    // Calculate completion metrics
    let totalItems = 0
    let confirmedItems = 0
    let notNeededItems = 0
    let pendingItems = 0
    let customItemsExpanded = 0
    const missingRequired: FFEItemTemplate[] = []
    const issues: string[] = []

    // Check each item
    for (const item of allItems) {
      // Check conditional logic
      if (item.conditionalOn && item.conditionalOn.length > 0) {
        const shouldShow = item.conditionalOn.some(conditionItemId => {
          const conditionStatus = itemStatusMap.get(conditionItemId)
          return conditionStatus && conditionStatus.state === 'confirmed'
        })
        
        if (!shouldShow) {
          continue // Skip this item as conditions aren't met
        }
      }

      totalItems++
      const status = itemStatusMap.get(item.id)
      
      if (!status) {
        // Item hasn't been addressed yet
        pendingItems++
        if (item.isRequired) {
          missingRequired.push(item)
        }
      } else {
        switch (status.state) {
          case 'confirmed':
            confirmedItems++
            if (!item.isStandard && status.isCustomExpanded) {
              customItemsExpanded++
              // Check if all required sub-items are confirmed
              const subItemStates = status.subItemStates as Record<string, string> || {}
              const requiredSubItems = item.subItems?.filter(sub => sub.required) || []
              const unconfirmedSubItems = requiredSubItems.filter(sub => 
                !subItemStates[sub.id] || subItemStates[sub.id] !== 'confirmed'
              )
              
              if (unconfirmedSubItems.length > 0) {
                issues.push(`${item.name}: Missing required sub-items: ${unconfirmedSubItems.map(s => s.name).join(', ')}`)
              }
            }
            break
          case 'not_needed':
            notNeededItems++
            break
          case 'pending':
          default:
            pendingItems++
            if (item.isRequired) {
              missingRequired.push(item)
            }
            break
        }
      }
    }

    // Calculate completion percentage
    const completionPercentage = totalItems > 0 
      ? Math.round(((confirmedItems + notNeededItems) / totalItems) * 100)
      : 100

    // Determine if complete
    const isComplete = pendingItems === 0 && missingRequired.length === 0 && issues.length === 0

    // Determine if force completion is allowed
    const canForceComplete = missingRequired.filter(item => item.isRequired).length === 0

    return {
      isComplete,
      completionPercentage,
      totalItems,
      confirmedItems,
      notNeededItems,
      pendingItems,
      missingRequired,
      customItemsExpanded,
      canForceComplete,
      issues
    }

  } catch (error) {
    console.error('Error validating FFE completion:', error)
    throw new Error('Failed to validate FFE completion')
  }
}

/**
 * Generates detailed FFE completion report
 */
export async function generateFFECompletionReport(roomId: string): Promise<FFECompletionReport> {
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    })

    if (!room) {
      throw new Error('Room not found')
    }

    const completionResult = await validateFFECompletion(roomId)
    
    // Get default configuration for category breakdown
    const defaultConfig = getDefaultFFEConfig(room.type)
    const categoryBreakdown = defaultConfig?.categories.map(category => {
      const categoryItems = category.items
      // This would need to be calculated based on actual item statuses
      return {
        categoryName: category.name,
        totalItems: categoryItems.length,
        confirmedItems: 0, // Would calculate from actual data
        notNeededItems: 0, // Would calculate from actual data
        pendingItems: categoryItems.length, // Would calculate from actual data
        completionPercentage: 0 // Would calculate from actual data
      }
    }) || []

    // Get recent audit trail
    const auditTrail = await prisma.fFEAuditLog.findMany({
      where: { roomId },
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    // Generate recommendations
    const recommendations: string[] = []
    if (completionResult.pendingItems > 0) {
      recommendations.push(`${completionResult.pendingItems} items still need attention`)
    }
    if (completionResult.missingRequired.length > 0) {
      recommendations.push(`${completionResult.missingRequired.length} required items must be addressed`)
    }
    if (completionResult.customItemsExpanded > 0) {
      recommendations.push(`${completionResult.customItemsExpanded} custom items have been expanded - verify all sub-items`)
    }

    return {
      roomId,
      roomType: room.type,
      completionResult,
      categoryBreakdown,
      auditTrail: auditTrail.map(log => ({
        action: log.action,
        itemName: log.itemId,
        user: log.user.name || 'Unknown',
        timestamp: log.createdAt
      })),
      recommendations
    }

  } catch (error) {
    console.error('Error generating FFE completion report:', error)
    throw new Error('Failed to generate FFE completion report')
  }
}

/**
 * Checks if FFE stage can be force completed
 */
export async function canForceCompleteFFE(roomId: string): Promise<boolean> {
  const result = await validateFFECompletion(roomId)
  return result.canForceComplete
}

// Alias for backwards compatibility
export const canForceComplete = canForceCompleteFFE

/**
 * Updates FFE item state and logs the action
 */
export async function updateFFEItemState(
  roomId: string,
  itemId: string,
  newState: FFEItemState,
  userId: string,
  notes?: string,
  subItemStates?: Record<string, string>,
  isCustomExpanded?: boolean
): Promise<void> {
  try {
    // Get or create the item status
    const existingStatus = await prisma.fFEItemStatus.findUnique({
      where: {
        roomId_itemId: { roomId, itemId }
      }
    })

    const oldState = existingStatus?.state || 'pending'
    
    // Update or create the status
    await prisma.fFEItemStatus.upsert({
      where: {
        roomId_itemId: { roomId, itemId }
      },
      create: {
        roomId,
        itemId,
        state: newState,
        isCustomExpanded: isCustomExpanded || false,
        subItemStates: subItemStates || {},
        notes,
        confirmedAt: newState === 'confirmed' ? new Date() : null,
        createdById: userId,
        updatedById: userId
      },
      update: {
        state: newState,
        isCustomExpanded: isCustomExpanded !== undefined ? isCustomExpanded : undefined,
        subItemStates: subItemStates || undefined,
        notes: notes !== undefined ? notes : undefined,
        confirmedAt: newState === 'confirmed' ? new Date() : null,
        updatedById: userId
      }
    })

    // Log the action
    await prisma.fFEAuditLog.create({
      data: {
        roomId,
        itemId,
        action: `state_changed_to_${newState}`,
        oldValue: oldState,
        newValue: newState,
        notes,
        userId
      }
    })

  } catch (error) {
    console.error('Error updating FFE item state:', error)
    throw new Error('Failed to update FFE item state')
  }
}
