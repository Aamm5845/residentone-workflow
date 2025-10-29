import { prisma } from '@/lib/prisma'
import { type FFEItemTemplate, getDefaultFFEConfig } from '@/lib/constants/room-ffe-config'

/**
 * Maps room type from enum format to workspace-compatible format
 * KITCHEN -> kitchen, LAUNDRY_ROOM -> laundry-room, etc.
 */
function mapRoomTypeToWorkspaceFormat(roomType: string): string {
  const roomTypeMapping: { [key: string]: string } = {
    'BATHROOM': 'bathroom',
    'MASTER_BATHROOM': 'bathroom',
    'FAMILY_BATHROOM': 'bathroom',
    'GUEST_BATHROOM': 'bathroom',
    'GIRLS_BATHROOM': 'bathroom',
    'BOYS_BATHROOM': 'bathroom',
    'POWDER_ROOM': 'bathroom',
    'KITCHEN': 'kitchen',
    'LIVING_ROOM': 'living-room',
    'BEDROOM': 'bedroom',
    'MASTER_BEDROOM': 'bedroom',
    'GUEST_BEDROOM': 'bedroom',
    'GIRLS_ROOM': 'bedroom',
    'BOYS_ROOM': 'bedroom',
    'DINING_ROOM': 'dining-room',
    'OFFICE': 'office',
    'STUDY_ROOM': 'office',
    'ENTRANCE': 'entrance',
    'FOYER': 'foyer',
    'LAUNDRY_ROOM': 'laundry-room',
    'PLAYROOM': 'playroom'
  }
  
  return roomTypeMapping[roomType] || roomType.toLowerCase().replace('_', '-')
}

/**
 * Maps array of room types to workspace format
 */
function mapRoomTypesToWorkspaceFormat(roomTypes: string[]): string[] {
  return roomTypes.map(mapRoomTypeToWorkspaceFormat)
}

/**
 * Adds a new custom FFE item to the organization's global library
 */
export async function addCustomFFEItem(
  orgId: string,
  userId: string,
  itemData: {
    itemId: string
    name: string
    category: string
    roomTypes: string[]
    isRequired: boolean
    isStandard: boolean
    subItems?: any[]
    notes?: string
  },
  fromProjectId?: string
): Promise<void> {
  try {
    // Map room types to workspace-compatible format
    const mappedRoomTypes = mapRoomTypesToWorkspaceFormat(itemData.roomTypes)
    // Check if item already exists
    const existing = await prisma.fFELibraryItem.findUnique({
      where: {
        orgId_itemId: { orgId, itemId: itemData.itemId }
      }
    })

    if (existing) {
      // Update existing item to add new room types if needed
      const newRoomTypes = [...new Set([...existing.roomTypes, ...mappedRoomTypes])]
      await prisma.fFELibraryItem.update({
        where: { id: existing.id },
        data: {
          roomTypes: newRoomTypes,
          updatedById: userId
        }
      })
    } else {
      // Create new item
      await prisma.fFELibraryItem.create({
        data: {
          orgId,
          itemId: itemData.itemId,
          name: itemData.name,
          category: itemData.category,
          roomTypes: mappedRoomTypes,
          isRequired: itemData.isRequired,
          isStandard: itemData.isStandard,
          subItems: itemData.subItems || null,
          notes: itemData.notes,
          addedFromProjectId: fromProjectId,
          createdById: userId,
          updatedById: userId
        }
      })

      // Log the addition
      if (fromProjectId) {
        await prisma.activityLog.create({
          data: {
            type: 'FFE_ITEM_ADDED_TO_LIBRARY',
            description: `Custom FFE item "${itemData.name}" added to global library`,
            metadata: {
              itemId: itemData.itemId,
              itemName: itemData.name,
              category: itemData.category,
              roomTypes: mappedRoomTypes,
              fromProject: fromProjectId
            },
            userId,
            orgId
          }
        })
      }
    }

  } catch (error) {
    console.error('Error adding custom FFE item:', error)
    throw new Error('Failed to add custom FFE item')
  }
}

/**
 * Gets all FFE items available for a room type (default + custom)
 */
export async function getFFEItemsForRoom(
  orgId: string,
  roomType: string
): Promise<{
  defaultItems: FFEItemTemplate[]
  customItems: FFEItemTemplate[]
  allItems: FFEItemTemplate[]
}> {
  try {
    // No hardcoded default items - only use custom items from organization
    const defaultItems: FFEItemTemplate[] = []

    // Get custom items from organization library
    const customLibraryItems = await prisma.fFELibraryItem.findMany({
      where: {
        orgId,
        roomTypes: { has: roomType }
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    // Convert custom library items to FFE item templates
    const customItems: FFEItemTemplate[] = customLibraryItems.map(item => ({
      id: item.itemId,
      name: item.name,
      category: item.category,
      isRequired: item.isRequired,
      isStandard: item.isStandard,
      subItems: item.subItems as any,
      conditionalOn: []
    }))

    // Combine all items
    const allItems = [...defaultItems, ...customItems]

    return {
      defaultItems,
      customItems,
      allItems
    }

  } catch (error) {
    console.error('Error getting FFE items for room:', error)
    return {
      defaultItems: [],
      customItems: [],
      allItems: []
    }
  }
}

/**
 * Gets organization's custom FFE library with filtering
 */
export async function getOrganizationFFELibrary(
  orgId: string,
  filters?: {
    category?: string
    roomType?: string
    search?: string
  }
): Promise<{
  id: string
  itemId: string
  name: string
  category: string
  roomTypes: string[]
  isRequired: boolean
  isStandard: boolean
  notes?: string
  addedFromProject?: {
    id: string
    name: string
  }
  createdBy: {
    name: string
  }
  createdAt: Date
}[]> {
  try {
    const whereClause: any = { orgId }

    if (filters?.category) {
      whereClause.category = filters.category
    }

    if (filters?.roomType) {
      whereClause.roomTypes = { has: filters.roomType }
    }

    if (filters?.search) {
      whereClause.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } }
      ]
    }

    const items = await prisma.fFELibraryItem.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: { name: true }
        },
        addedFromProject: {
          select: { id: true, name: true }
        }
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    })

    return items.map(item => ({
      id: item.id,
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      roomTypes: item.roomTypes,
      isRequired: item.isRequired,
      isStandard: item.isStandard,
      notes: item.notes || undefined,
      addedFromProject: item.addedFromProject || undefined,
      createdBy: item.createdBy,
      createdAt: item.createdAt
    }))

  } catch (error) {
    console.error('Error getting organization FFE library:', error)
    return []
  }
}

/**
 * Removes a custom item from the organization library
 */
export async function removeCustomFFEItem(
  orgId: string,
  itemId: string,
  userId: string
): Promise<void> {
  try {
    const item = await prisma.fFELibraryItem.findUnique({
      where: {
        orgId_itemId: { orgId, itemId }
      }
    })

    if (!item) {
      throw new Error('Item not found')
    }

    await prisma.fFELibraryItem.delete({
      where: { id: item.id }
    })

    // Log the removal
    await prisma.activityLog.create({
      data: {
        type: 'FFE_ITEM_REMOVED_FROM_LIBRARY',
        description: `Custom FFE item "${item.name}" removed from global library`,
        metadata: {
          itemId: item.itemId,
          itemName: item.name,
          category: item.category
        },
        userId,
        orgId
      }
    })

  } catch (error) {
    console.error('Error removing custom FFE item:', error)
    throw new Error('Failed to remove custom FFE item')
  }
}

/**
 * Updates a custom FFE item in the organization library
 */
export async function updateCustomFFEItem(
  orgId: string,
  itemId: string,
  userId: string,
  updates: {
    name?: string
    category?: string
    roomTypes?: string[]
    isRequired?: boolean
    isStandard?: boolean
    subItems?: any[]
    notes?: string
  }
): Promise<void> {
  try {
    const item = await prisma.fFELibraryItem.findUnique({
      where: {
        orgId_itemId: { orgId, itemId }
      }
    })

    if (!item) {
      throw new Error('Item not found')
    }

    await prisma.fFELibraryItem.update({
      where: { id: item.id },
      data: {
        ...updates,
        updatedById: userId
      }
    })

    // Log the update
    await prisma.activityLog.create({
      data: {
        type: 'FFE_ITEM_UPDATED_IN_LIBRARY',
        description: `Custom FFE item "${item.name}" updated in global library`,
        metadata: {
          itemId: item.itemId,
          itemName: item.name,
          updates: Object.keys(updates)
        },
        userId,
        orgId
      }
    })

  } catch (error) {
    console.error('Error updating custom FFE item:', error)
    throw new Error('Failed to update custom FFE item')
  }
}

/**
 * Auto-adds a new custom item to library when it's created in a project
 */
export async function autoAddToLibraryIfNew(
  orgId: string,
  projectId: string,
  roomId: string,
  itemId: string,
  itemName: string,
  category: string,
  roomType: string,
  userId: string,
  itemConfig?: {
    isRequired: boolean
    isStandard: boolean
    subItems?: any[]
  }
): Promise<void> {
  try {
    // No hardcoded defaults to check - proceed with library addition

    // Check if already in library
    const existsInLibrary = await prisma.fFELibraryItem.findUnique({
      where: {
        orgId_itemId: { orgId, itemId }
      }
    })

    if (existsInLibrary) {
      return // Already in library
    }

    // Convert room type to workspace format
    const mappedRoomType = mapRoomTypeToWorkspaceFormat(roomType)

    // Add to library
    await addCustomFFEItem(
      orgId,
      userId,
      {
        itemId,
        name: itemName,
        category,
        roomTypes: [mappedRoomType],
        isRequired: itemConfig?.isRequired || false,
        isStandard: itemConfig?.isStandard || true,
        subItems: itemConfig?.subItems,
        notes: `Auto-added from project`
      },
      projectId
    )

  } catch (error) {
    console.error('Error auto-adding item to library:', error)
    // Don't throw - this is background functionality
  }
}
