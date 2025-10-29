import { prisma } from '@/lib/prisma'
import { FFECategory } from '@/lib/constants/room-ffe-config'

export interface FFEGlobalSettings {
  id: string
  orgId: string
  defaultBudgetMultipliers: Record<string, number> // room type -> multiplier
  defaultLeadTimeWeeks: Record<string, number> // category -> weeks
  requireSupplierLinks: boolean
  requirePriceConfirmation: boolean
  allowCustomItems: boolean
  autoCreateTemplatesFromProjects: boolean
  defaultPriorities: Record<string, 'high' | 'medium' | 'low'> // category -> priority
  budgetThresholds: {
    warning: number // percentage over budget to show warning
    critical: number // percentage over budget to show critical
  }
  approvalWorkflows: {
    budgetThreshold: number // amount that requires approval
    requireManagerApproval: boolean
    requireClientApproval: boolean
  }
  notifications: {
    deadlineReminders: boolean
    budgetAlerts: boolean
    deliveryUpdates: boolean
    emailRecipients: string[]
  }
  customFields: {
    name: string
    type: 'text' | 'number' | 'boolean' | 'select'
    options?: string[]
    required: boolean
    appliesToRoomTypes?: string[]
  }[]
  integrations: {
    supplierAPIs?: {
      [supplierName: string]: {
        apiKey: string
        baseUrl: string
        enabled: boolean
      }
    }
    pricingServices?: {
      enabled: boolean
      provider: string
      settings: Record<string, any>
    }
  }
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
}

export interface FFEItemLibrary {
  id: string
  orgId: string
  name: string
  description?: string
  category: string
  subcategory?: string
  tags: string[]
  isPublic: boolean // Available to all users in org
  isTemplate: boolean // Can be used as template for new projects
  basePrice?: number
  priceRange?: { min: number; max: number }
  estimatedLeadTime?: number
  leadTimeRange?: { min: number; max: number }
  suppliers: {
    name: string
    website?: string
    contactInfo?: string
    averagePrice?: number
    averageLeadTime?: number
    rating?: number
    notes?: string
  }[]
  specifications?: {
    dimensions?: { length?: number; width?: number; height?: number; unit: 'cm' | 'inch' }
    materials?: string[]
    colors?: string[]
    styles?: string[]
    customSpecs?: Record<string, string>
  }
  images?: string[]
  documents?: string[]
  roomTypes: string[]
  priority: 'high' | 'medium' | 'low'
  isRequired: boolean
  conditionalOn?: string[] // Other item IDs this depends on
  alternatives?: string[] // Alternative item IDs
  usageStats: {
    timesUsed: number
    successRate: number
    averageActualPrice?: number
    averageActualLeadTime?: number
  }
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
}

/**
 * Gets or creates default FFE settings for an organization
 */
export async function getFFEGlobalSettings(orgId: string): Promise<FFEGlobalSettings> {
  try {
    let settings = await prisma.fFEGlobalSettings.findFirst({
      where: { orgId }
    })

    if (!settings) {
      // Create default settings
      settings = await prisma.fFEGlobalSettings.create({
        data: {
          orgId,
          defaultBudgetMultipliers: {
            'living-room': 1.2,
            'bedroom': 1.0,
            'kitchen': 1.5,
            'bathroom': 1.1,
            'dining-room': 1.0,
            'office': 0.8,
            'guest-room': 0.9
          },
          defaultLeadTimeWeeks: {
            'furniture': 8,
            'lighting': 6,
            'window-treatments': 4,
            'accessories': 2,
            'artwork': 3,
            'rugs': 4,
            'plants': 1
          },
          requireSupplierLinks: true,
          requirePriceConfirmation: true,
          allowCustomItems: true,
          autoCreateTemplatesFromProjects: true,
          defaultPriorities: {
            'furniture': 'high',
            'lighting': 'high',
            'window-treatments': 'medium',
            'accessories': 'low',
            'artwork': 'medium',
            'rugs': 'medium',
            'plants': 'low'
          },
          budgetThresholds: {
            warning: 10, // 10% over budget
            critical: 25 // 25% over budget
          },
          approvalWorkflows: {
            budgetThreshold: 5000,
            requireManagerApproval: true,
            requireClientApproval: false
          },
          notifications: {
            deadlineReminders: true,
            budgetAlerts: true,
            deliveryUpdates: true,
            emailRecipients: []
          },
          customFields: [],
          integrations: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'system', // Would be actual user ID
          updatedBy: 'system'
        }
      })
    }

    return settings as FFEGlobalSettings

  } catch (error) {
    console.error('Error getting FFE global settings:', error)
    throw new Error('Failed to load FFE settings')
  }
}

/**
 * Updates FFE global settings for an organization
 */
export async function updateFFEGlobalSettings(
  orgId: string,
  userId: string,
  updates: Partial<Omit<FFEGlobalSettings, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>>
): Promise<FFEGlobalSettings> {
  try {
    const settings = await prisma.fFEGlobalSettings.upsert({
      where: { orgId },
      create: {
        orgId,
        ...updates,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: userId
      },
      update: {
        ...updates,
        updatedAt: new Date(),
        updatedBy: userId
      }
    })

    // Log the update
    await prisma.activityLog.create({
      data: {
        type: 'FFE_SETTINGS_UPDATED',
        description: 'FFE global settings updated',
        metadata: {
          updatedFields: Object.keys(updates),
          orgId
        },
        userId,
        orgId
      }
    })

    return settings as FFEGlobalSettings

  } catch (error) {
    console.error('Error updating FFE global settings:', error)
    throw new Error('Failed to update FFE settings')
  }
}

/**
 * Creates a new item in the FFE library
 */
export async function createFFELibraryItem(
  orgId: string,
  userId: string,
  itemData: Omit<FFEItemLibrary, 'id' | 'orgId' | 'usageStats' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
): Promise<FFEItemLibrary> {
  try {
    const libraryItem = await prisma.fFEItemLibrary.create({
      data: {
        orgId,
        name: itemData.name,
        description: itemData.description,
        category: itemData.category,
        subcategory: itemData.subcategory,
        tags: itemData.tags,
        isPublic: itemData.isPublic,
        isTemplate: itemData.isTemplate,
        basePrice: itemData.basePrice,
        priceRange: itemData.priceRange,
        estimatedLeadTime: itemData.estimatedLeadTime,
        leadTimeRange: itemData.leadTimeRange,
        suppliers: itemData.suppliers,
        specifications: itemData.specifications,
        images: itemData.images || [],
        documents: itemData.documents || [],
        roomTypes: itemData.roomTypes,
        priority: itemData.priority,
        isRequired: itemData.isRequired,
        conditionalOn: itemData.conditionalOn || [],
        alternatives: itemData.alternatives || [],
        usageStats: {
          timesUsed: 0,
          successRate: 0
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userId,
        updatedBy: userId
      }
    })

    // Log the creation
    await prisma.activityLog.create({
      data: {
        type: 'FFE_LIBRARY_ITEM_CREATED',
        description: `FFE library item "${itemData.name}" created in category ${itemData.category}`,
        metadata: {
          itemId: libraryItem.id,
          itemName: itemData.name,
          category: itemData.category,
          roomTypes: itemData.roomTypes,
          isPublic: itemData.isPublic,
          isTemplate: itemData.isTemplate
        },
        userId,
        orgId
      }
    })

    return libraryItem as FFEItemLibrary

  } catch (error) {
    console.error('Error creating FFE library item:', error)
    throw new Error('Failed to create FFE library item')
  }
}

/**
 * Gets FFE library items with filtering and pagination
 */
export async function getFFELibraryItems(
  orgId: string,
  filters?: {
    category?: string
    subcategory?: string
    roomType?: string
    tags?: string[]
    isPublic?: boolean
    isTemplate?: boolean
    search?: string
    priceRange?: { min?: number; max?: number }
    leadTimeRange?: { min?: number; max?: number }
  },
  pagination?: {
    page: number
    limit: number
    sortBy?: 'name' | 'category' | 'usageCount' | 'successRate' | 'createdAt'
    sortOrder?: 'asc' | 'desc'
  }
): Promise<{
  items: FFEItemLibrary[]
  totalCount: number
  page: number
  totalPages: number
}> {
  try {
    const page = pagination?.page || 1
    const limit = pagination?.limit || 50
    const skip = (page - 1) * limit

    // Build where clause
    const whereClause: any = {
      orgId
    }

    if (filters?.category) {
      whereClause.category = filters.category
    }

    if (filters?.subcategory) {
      whereClause.subcategory = filters.subcategory
    }

    if (filters?.roomType) {
      whereClause.roomTypes = { has: filters.roomType }
    }

    if (filters?.tags && filters.tags.length > 0) {
      whereClause.tags = { hasSome: filters.tags }
    }

    if (filters?.isPublic !== undefined) {
      whereClause.isPublic = filters.isPublic
    }

    if (filters?.isTemplate !== undefined) {
      whereClause.isTemplate = filters.isTemplate
    }

    if (filters?.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { tags: { hasSome: [filters.search] } }
      ]
    }

    if (filters?.priceRange) {
      if (filters.priceRange.min !== undefined || filters.priceRange.max !== undefined) {
        whereClause.basePrice = {}
        if (filters.priceRange.min !== undefined) {
          whereClause.basePrice.gte = filters.priceRange.min
        }
        if (filters.priceRange.max !== undefined) {
          whereClause.basePrice.lte = filters.priceRange.max
        }
      }
    }

    if (filters?.leadTimeRange) {
      if (filters.leadTimeRange.min !== undefined || filters.leadTimeRange.max !== undefined) {
        whereClause.estimatedLeadTime = {}
        if (filters.leadTimeRange.min !== undefined) {
          whereClause.estimatedLeadTime.gte = filters.leadTimeRange.min
        }
        if (filters.leadTimeRange.max !== undefined) {
          whereClause.estimatedLeadTime.lte = filters.leadTimeRange.max
        }
      }
    }

    // Build order by
    let orderBy: any = { createdAt: 'desc' }
    if (pagination?.sortBy) {
      const sortOrder = pagination.sortOrder || 'desc'
      switch (pagination.sortBy) {
        case 'name':
          orderBy = { name: sortOrder }
          break
        case 'category':
          orderBy = { category: sortOrder }
          break
        case 'usageCount':
          orderBy = { usageStats: { path: ['timesUsed'], order: sortOrder } }
          break
        case 'successRate':
          orderBy = { usageStats: { path: ['successRate'], order: sortOrder } }
          break
        case 'createdAt':
          orderBy = { createdAt: sortOrder }
          break
      }
    }

    // Execute queries
    const [items, totalCount] = await Promise.all([
      prisma.fFEItemLibrary.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit
      }),
      prisma.fFEItemLibrary.count({
        where: whereClause
      })
    ])

    return {
      items: items as FFEItemLibrary[],
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit)
    }

  } catch (error) {
    console.error('Error getting FFE library items:', error)
    return {
      items: [],
      totalCount: 0,
      page: 1,
      totalPages: 0
    }
  }
}

/**
 * Updates usage statistics for an FFE library item
 */
export async function updateFFELibraryItemUsage(
  itemId: string,
  wasSuccessful: boolean,
  actualPrice?: number,
  actualLeadTime?: number
): Promise<void> {
  try {
    const currentItem = await prisma.fFEItemLibrary.findUnique({
      where: { id: itemId }
    })

    if (!currentItem) return

    const currentStats = currentItem.usageStats as any
    const newTimesUsed = (currentStats?.timesUsed || 0) + 1
    const currentSuccessfulUses = Math.round((currentStats?.successRate || 0) * (currentStats?.timesUsed || 0))
    const newSuccessfulUses = wasSuccessful ? currentSuccessfulUses + 1 : currentSuccessfulUses
    const newSuccessRate = newTimesUsed > 0 ? newSuccessfulUses / newTimesUsed : 0

    const newAverageActualPrice = actualPrice && currentStats?.averageActualPrice
      ? ((currentStats.averageActualPrice * (currentStats.timesUsed - 1)) + actualPrice) / newTimesUsed
      : actualPrice || currentStats?.averageActualPrice

    const newAverageActualLeadTime = actualLeadTime && currentStats?.averageActualLeadTime
      ? ((currentStats.averageActualLeadTime * (currentStats.timesUsed - 1)) + actualLeadTime) / newTimesUsed
      : actualLeadTime || currentStats?.averageActualLeadTime

    await prisma.fFEItemLibrary.update({
      where: { id: itemId },
      data: {
        usageStats: {
          timesUsed: newTimesUsed,
          successRate: newSuccessRate,
          averageActualPrice: newAverageActualPrice,
          averageActualLeadTime: newAverageActualLeadTime
        },
        updatedAt: new Date()
      }
    })

  } catch (error) {
    console.error('Error updating FFE library item usage:', error)
  }
}

/**
 * Gets popular FFE categories and items for dashboard insights
 */
export async function getFFELibraryInsights(orgId: string): Promise<{
  topCategories: { category: string; itemCount: number; averageSuccessRate: number }[]
  mostPopularItems: { name: string; category: string; usageCount: number; successRate: number }[]
  recentItems: { name: string; category: string; createdAt: Date; createdBy: string }[]
  supplierInsights: { supplier: string; itemCount: number; averagePrice: number; averageLeadTime: number }[]
}> {
  try {
    const items = await prisma.fFEItemLibrary.findMany({
      where: { orgId },
      include: {
        createdBy: {
          select: { name: true }
        }
      }
    })

    // Top categories
    const categoryStats = new Map<string, { count: number; totalSuccessRate: number }>()
    items.forEach(item => {
      const stats = categoryStats.get(item.category) || { count: 0, totalSuccessRate: 0 }
      const itemSuccessRate = (item.usageStats as any)?.successRate || 0
      categoryStats.set(item.category, {
        count: stats.count + 1,
        totalSuccessRate: stats.totalSuccessRate + itemSuccessRate
      })
    })

    const topCategories = Array.from(categoryStats.entries())
      .map(([category, stats]) => ({
        category,
        itemCount: stats.count,
        averageSuccessRate: stats.count > 0 ? stats.totalSuccessRate / stats.count : 0
      }))
      .sort((a, b) => b.itemCount - a.itemCount)
      .slice(0, 10)

    // Most popular items
    const mostPopularItems = items
      .filter(item => (item.usageStats as any)?.timesUsed > 0)
      .sort((a, b) => ((b.usageStats as any)?.timesUsed || 0) - ((a.usageStats as any)?.timesUsed || 0))
      .slice(0, 10)
      .map(item => ({
        name: item.name,
        category: item.category,
        usageCount: (item.usageStats as any)?.timesUsed || 0,
        successRate: (item.usageStats as any)?.successRate || 0
      }))

    // Recent items
    const recentItems = items
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map(item => ({
        name: item.name,
        category: item.category,
        createdAt: item.createdAt,
        createdBy: (item as any).createdBy?.name || 'Unknown'
      }))

    // Supplier insights
    const supplierStats = new Map<string, { itemCount: number; totalPrice: number; totalLeadTime: number; priceCount: number; leadTimeCount: number }>()
    
    items.forEach(item => {
      (item.suppliers as any[]).forEach(supplier => {
        const stats = supplierStats.get(supplier.name) || { 
          itemCount: 0, 
          totalPrice: 0, 
          totalLeadTime: 0,
          priceCount: 0,
          leadTimeCount: 0
        }
        
        supplierStats.set(supplier.name, {
          itemCount: stats.itemCount + 1,
          totalPrice: stats.totalPrice + (supplier.averagePrice || 0),
          totalLeadTime: stats.totalLeadTime + (supplier.averageLeadTime || 0),
          priceCount: stats.priceCount + (supplier.averagePrice ? 1 : 0),
          leadTimeCount: stats.leadTimeCount + (supplier.averageLeadTime ? 1 : 0)
        })
      })
    })

    const supplierInsights = Array.from(supplierStats.entries())
      .map(([supplier, stats]) => ({
        supplier,
        itemCount: stats.itemCount,
        averagePrice: stats.priceCount > 0 ? stats.totalPrice / stats.priceCount : 0,
        averageLeadTime: stats.leadTimeCount > 0 ? stats.totalLeadTime / stats.leadTimeCount : 0
      }))
      .sort((a, b) => b.itemCount - a.itemCount)
      .slice(0, 10)

    return {
      topCategories,
      mostPopularItems,
      recentItems,
      supplierInsights
    }

  } catch (error) {
    console.error('Error getting FFE library insights:', error)
    return {
      topCategories: [],
      mostPopularItems: [],
      recentItems: [],
      supplierInsights: []
    }
  }
}
