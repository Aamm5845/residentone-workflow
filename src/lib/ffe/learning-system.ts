import { prisma } from '@/lib/prisma'
import { FFEItemTemplate, FFESubItem, FFECategory } from '@/lib/constants/room-ffe-config'

export interface FFELearningItem {
  id: string
  orgId: string
  roomTypes: string[] // Which room types this item applies to
  name: string
  category: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  isRequired: boolean
  isStandard: boolean
  subItems?: FFESubItem[]
  conditionalOn?: string[]
  estimatedPrice?: number
  leadTimeWeeks?: number
  supplierInfo?: {
    name: string
    website?: string
    contactInfo?: string
  }
  usageCount: number // How many times it's been used
  successRate: number // % of times it was marked complete
  averagePrice?: number
  averageLeadTime?: number
  tags: string[]
  createdBy: string
  createdFrom?: {
    projectId: string
    roomId: string
    itemId: string
  }
  createdAt: Date
  updatedAt: Date
  isGlobalTemplate: boolean // Available across all projects in org
  isCustom: boolean // Created by users vs predefined
}

export interface FFETemplateStats {
  totalCustomItems: number
  mostUsedItems: { name: string; usageCount: number; category: string }[]
  topPerformingSuppliers: { name: string; averagePrice: number; successRate: number }[]
  budgetInsights: {
    averageBudgetByRoomType: Record<string, number>
    mostExpensiveCategories: { category: string; averagePrice: number }[]
  }
  timelineInsights: {
    averageLeadTimeByCategory: Record<string, number>
    longestLeadTimeItems: { name: string; leadTime: number; category: string }[]
  }
}

/**
 * Records usage of an FFE item to improve future recommendations
 */
export async function recordFFEItemUsage(
  orgId: string,
  roomType: string,
  itemId: string,
  status: 'COMPLETED' | 'NOT_NEEDED' | 'ABANDONED',
  actualPrice?: number,
  actualLeadTime?: number,
  supplierInfo?: { name: string; website?: string; rating?: number }
): Promise<void> {
  try {
    // Find existing learning record
    const existingRecord = await prisma.fFELearningItem.findFirst({
      where: {
        orgId,
        originalItemId: itemId
      }
    })

    if (existingRecord) {
      // Update existing record
      const newUsageCount = existingRecord.usageCount + 1
      const newSuccessCount = status === 'COMPLETED' 
        ? existingRecord.successCount + 1 
        : existingRecord.successCount
      
      const newAveragePrice = actualPrice 
        ? ((existingRecord.averagePrice || 0) * existingRecord.usageCount + actualPrice) / newUsageCount
        : existingRecord.averagePrice

      const newAverageLeadTime = actualLeadTime
        ? ((existingRecord.averageLeadTime || 0) * existingRecord.usageCount + actualLeadTime) / newUsageCount
        : existingRecord.averageLeadTime

      await prisma.fFELearningItem.update({
        where: { id: existingRecord.id },
        data: {
          usageCount: newUsageCount,
          successCount: newSuccessCount,
          successRate: newSuccessCount / newUsageCount,
          averagePrice: newAveragePrice,
          averageLeadTime: newAverageLeadTime,
          roomTypes: {
            set: [...new Set([...existingRecord.roomTypes, roomType])]
          },
          lastUsedAt: new Date(),
          supplierData: supplierInfo ? {
            ...(existingRecord.supplierData as any || {}),
            ...supplierInfo
          } : existingRecord.supplierData
        }
      })
    } else {
      // Create new learning record
      const initialSuccessRate = status === 'COMPLETED' ? 1.0 : 0.0
      const initialSuccessCount = status === 'COMPLETED' ? 1 : 0

      await prisma.fFELearningItem.create({
        data: {
          orgId,
          originalItemId: itemId,
          roomTypes: [roomType],
          usageCount: 1,
          successCount: initialSuccessCount,
          successRate: initialSuccessRate,
          averagePrice: actualPrice,
          averageLeadTime: actualLeadTime,
          supplierData: supplierInfo,
          lastUsedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    }

    // Also record in organization's FFE insights
    await updateFFEInsights(orgId, roomType, itemId, status, actualPrice)

  } catch (error) {
    console.error('Error recording FFE item usage:', error)
    // Don't throw - this is analytics, not critical path
  }
}

/**
 * Creates a custom FFE item template for the organization
 */
export async function createCustomFFEItem(
  orgId: string,
  userId: string,
  itemData: {
    name: string
    category: string
    description?: string
    roomTypes: string[]
    priority: 'high' | 'medium' | 'low'
    isRequired: boolean
    isStandard: boolean
    subItems?: Omit<FFESubItem, 'id'>[]
    conditionalOn?: string[]
    estimatedPrice?: number
    leadTimeWeeks?: number
    supplierInfo?: {
      name: string
      website?: string
      contactInfo?: string
    }
    tags?: string[]
    createdFromProject?: {
      projectId: string
      roomId: string
      originalItemId: string
    }
  }
): Promise<FFELearningItem> {
  try {
    // Generate sub-items with IDs
    const subItemsWithIds = itemData.subItems?.map(subItem => ({
      ...subItem,
      id: `${itemData.name.toLowerCase().replace(/\s+/g, '_')}_${subItem.name.toLowerCase().replace(/\s+/g, '_')}`
    }))

    const customItem = await prisma.fFELearningItem.create({
      data: {
        orgId,
        name: itemData.name,
        category: itemData.category,
        description: itemData.description,
        roomTypes: itemData.roomTypes,
        priority: itemData.priority,
        isRequired: itemData.isRequired,
        isStandard: itemData.isStandard,
        subItems: subItemsWithIds,
        conditionalOn: itemData.conditionalOn || [],
        estimatedPrice: itemData.estimatedPrice,
        leadTimeWeeks: itemData.leadTimeWeeks,
        supplierData: itemData.supplierInfo,
        tags: itemData.tags || [],
        createdById: userId,
        createdFromProjectId: itemData.createdFromProject?.projectId,
        createdFromRoomId: itemData.createdFromProject?.roomId,
        originalItemId: itemData.createdFromProject?.originalItemId,
        isGlobalTemplate: true,
        isCustom: true,
        usageCount: 0,
        successCount: 0,
        successRate: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    // Log the creation
    await prisma.activityLog.create({
      data: {
        type: 'FFE_TEMPLATE_CREATED',
        description: `Custom FFE template "${itemData.name}" created for ${itemData.roomTypes.join(', ')}`,
        metadata: {
          itemId: customItem.id,
          itemName: itemData.name,
          category: itemData.category,
          roomTypes: itemData.roomTypes,
          isRequired: itemData.isRequired,
          estimatedPrice: itemData.estimatedPrice
        },
        userId,
        orgId
      }
    })

    return customItem as FFELearningItem

  } catch (error) {
    console.error('Error creating custom FFE item:', error)
    throw new Error('Failed to create custom FFE item')
  }
}

/**
 * Gets enhanced FFE recommendations based on organization learning
 */
export async function getEnhancedFFERecommendations(
  orgId: string,
  roomType: string,
  projectBudget?: number
): Promise<{
  baseItems: FFEItemTemplate[]
  customItems: FFELearningItem[]
  recommendations: {
    budgetOptimized: FFELearningItem[]
    quickDelivery: FFELearningItem[]
    mostSuccessful: FFELearningItem[]
    similarProjects: FFELearningItem[]
  }
  insights: {
    estimatedBudget: number
    averageLeadTime: number
    riskFactors: string[]
    opportunities: string[]
  }
}> {
  try {
    // Get custom items for this room type
    const customItems = await prisma.fFELearningItem.findMany({
      where: {
        orgId,
        roomTypes: { has: roomType },
        isGlobalTemplate: true
      },
      orderBy: [
        { successRate: 'desc' },
        { usageCount: 'desc' }
      ]
    })

    // Generate recommendations
    const budgetOptimized = customItems
      .filter(item => item.averagePrice && (!projectBudget || item.averagePrice <= projectBudget * 0.8))
      .sort((a, b) => (a.averagePrice || 0) - (b.averagePrice || 0))
      .slice(0, 10)

    const quickDelivery = customItems
      .filter(item => item.averageLeadTime && item.averageLeadTime <= 4)
      .sort((a, b) => (a.averageLeadTime || 0) - (b.averageLeadTime || 0))
      .slice(0, 10)

    const mostSuccessful = customItems
      .filter(item => item.usageCount >= 3)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10)

    const similarProjects = customItems
      .filter(item => item.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10)

    // Calculate insights
    const totalEstimatedBudget = customItems.reduce((sum, item) => 
      sum + (item.estimatedPrice || 0), 0
    )

    const totalLeadTime = customItems.filter(item => item.averageLeadTime).length
    const averageLeadTime = totalLeadTime > 0 
      ? customItems.reduce((sum, item) => sum + (item.averageLeadTime || 0), 0) / totalLeadTime
      : 0

    const riskFactors: string[] = []
    const opportunities: string[] = []

    // Analyze risks and opportunities
    if (averageLeadTime > 10) {
      riskFactors.push(`Average lead time is ${Math.round(averageLeadTime)} weeks - plan ahead`)
    }

    const lowSuccessItems = customItems.filter(item => 
      item.usageCount >= 3 && item.successRate < 0.7
    ).length

    if (lowSuccessItems > 0) {
      riskFactors.push(`${lowSuccessItems} items have low success rates - review alternatives`)
    }

    if (projectBudget && totalEstimatedBudget > projectBudget) {
      riskFactors.push(`Estimated budget exceeds project budget by ${Math.round(((totalEstimatedBudget - projectBudget) / projectBudget) * 100)}%`)
    }

    const reusableItems = customItems.filter(item => item.usageCount >= 5).length
    if (reusableItems > 5) {
      opportunities.push(`${reusableItems} proven items available - leverage existing relationships`)
    }

    return {
      baseItems: [], // Would include base configuration items
      customItems: customItems as FFELearningItem[],
      recommendations: {
        budgetOptimized: budgetOptimized as FFELearningItem[],
        quickDelivery: quickDelivery as FFELearningItem[],
        mostSuccessful: mostSuccessful as FFELearningItem[],
        similarProjects: similarProjects as FFELearningItem[]
      },
      insights: {
        estimatedBudget: totalEstimatedBudget,
        averageLeadTime: Math.round(averageLeadTime),
        riskFactors,
        opportunities
      }
    }

  } catch (error) {
    console.error('Error getting enhanced FFE recommendations:', error)
    return {
      baseItems: [],
      customItems: [],
      recommendations: {
        budgetOptimized: [],
        quickDelivery: [],
        mostSuccessful: [],
        similarProjects: []
      },
      insights: {
        estimatedBudget: 0,
        averageLeadTime: 0,
        riskFactors: ['Error loading recommendations'],
        opportunities: []
      }
    }
  }
}

/**
 * Gets comprehensive FFE template statistics for organization
 */
export async function getFFETemplateStats(orgId: string): Promise<FFETemplateStats> {
  try {
    const customItems = await prisma.fFELearningItem.findMany({
      where: { orgId },
      include: {
        createdBy: {
          select: { name: true }
        }
      }
    })

    // Most used items
    const mostUsedItems = customItems
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10)
      .map(item => ({
        name: item.name,
        usageCount: item.usageCount,
        category: item.category
      }))

    // Top suppliers (from supplier data)
    const supplierMap = new Map<string, { totalPrice: number; count: number; successCount: number }>()
    
    customItems.forEach(item => {
      const supplierData = item.supplierData as any
      if (supplierData?.name) {
        const existing = supplierMap.get(supplierData.name) || { totalPrice: 0, count: 0, successCount: 0 }
        supplierMap.set(supplierData.name, {
          totalPrice: existing.totalPrice + (item.averagePrice || 0),
          count: existing.count + item.usageCount,
          successCount: existing.successCount + item.successCount
        })
      }
    })

    const topPerformingSuppliers = Array.from(supplierMap.entries())
      .map(([name, data]) => ({
        name,
        averagePrice: data.count > 0 ? data.totalPrice / data.count : 0,
        successRate: data.count > 0 ? data.successCount / data.count : 0
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10)

    // Budget insights by room type
    const roomTypeBudgets = new Map<string, { total: number; count: number }>()
    customItems.forEach(item => {
      item.roomTypes.forEach(roomType => {
        const existing = roomTypeBudgets.get(roomType) || { total: 0, count: 0 }
        if (item.averagePrice) {
          roomTypeBudgets.set(roomType, {
            total: existing.total + item.averagePrice,
            count: existing.count + 1
          })
        }
      })
    })

    const averageBudgetByRoomType: Record<string, number> = {}
    roomTypeBudgets.forEach((data, roomType) => {
      averageBudgetByRoomType[roomType] = data.count > 0 ? data.total / data.count : 0
    })

    // Most expensive categories
    const categoryBudgets = new Map<string, { total: number; count: number }>()
    customItems.forEach(item => {
      if (item.averagePrice) {
        const existing = categoryBudgets.get(item.category) || { total: 0, count: 0 }
        categoryBudgets.set(item.category, {
          total: existing.total + item.averagePrice,
          count: existing.count + 1
        })
      }
    })

    const mostExpensiveCategories = Array.from(categoryBudgets.entries())
      .map(([category, data]) => ({
        category,
        averagePrice: data.count > 0 ? data.total / data.count : 0
      }))
      .sort((a, b) => b.averagePrice - a.averagePrice)
      .slice(0, 10)

    // Timeline insights
    const categoryLeadTimes = new Map<string, { total: number; count: number }>()
    customItems.forEach(item => {
      if (item.averageLeadTime) {
        const existing = categoryLeadTimes.get(item.category) || { total: 0, count: 0 }
        categoryLeadTimes.set(item.category, {
          total: existing.total + item.averageLeadTime,
          count: existing.count + 1
        })
      }
    })

    const averageLeadTimeByCategory: Record<string, number> = {}
    categoryLeadTimes.forEach((data, category) => {
      averageLeadTimeByCategory[category] = data.count > 0 ? data.total / data.count : 0
    })

    const longestLeadTimeItems = customItems
      .filter(item => item.averageLeadTime)
      .sort((a, b) => (b.averageLeadTime || 0) - (a.averageLeadTime || 0))
      .slice(0, 10)
      .map(item => ({
        name: item.name,
        leadTime: item.averageLeadTime || 0,
        category: item.category
      }))

    return {
      totalCustomItems: customItems.length,
      mostUsedItems,
      topPerformingSuppliers,
      budgetInsights: {
        averageBudgetByRoomType,
        mostExpensiveCategories
      },
      timelineInsights: {
        averageLeadTimeByCategory,
        longestLeadTimeItems
      }
    }

  } catch (error) {
    console.error('Error getting FFE template stats:', error)
    return {
      totalCustomItems: 0,
      mostUsedItems: [],
      topPerformingSuppliers: [],
      budgetInsights: {
        averageBudgetByRoomType: {},
        mostExpensiveCategories: []
      },
      timelineInsights: {
        averageLeadTimeByCategory: {},
        longestLeadTimeItems: []
      }
    }
  }
}

/**
 * Updates FFE insights for an organization
 */
async function updateFFEInsights(
  orgId: string,
  roomType: string,
  itemId: string,
  status: string,
  actualPrice?: number
): Promise<void> {
  try {
    // This would update aggregated insights for the organization
    // Implementation would depend on your specific analytics needs
    
    // For now, just log the insight
    await prisma.activityLog.create({
      data: {
        type: 'FFE_INSIGHT_RECORDED',
        description: `FFE item usage recorded: ${itemId} in ${roomType} - ${status}`,
        metadata: {
          roomType,
          itemId,
          status,
          actualPrice,
          timestamp: new Date().toISOString()
        },
        orgId
      }
    })

  } catch (error) {
    console.error('Error updating FFE insights:', error)
  }
}
