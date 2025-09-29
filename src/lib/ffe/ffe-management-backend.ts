// FFE Management Backend System
// Master control panel for defining room types, categories, items, and logic rules

import { prisma } from '@/lib/prisma'
import { FFE_ROOM_LIBRARIES, STANDARD_CATEGORIES, getRoomLibrary, type FFELibraryItem, type FFEItemLogicRule, type FFESubItem } from './room-library-system'

// Database schema interfaces
export interface FFEMasterRoomType {
  id: string
  name: string
  key: string // 'bedroom', 'bathroom', etc.
  isActive: boolean
  linkedRooms?: string[] // Optional linked room types
  createdAt: Date
  updatedAt: Date
  orgId: string
}

export interface FFEMasterCategory {
  id: string
  name: string
  key: string // 'FLOORING', 'FURNITURE', etc.
  order: number
  isActive: boolean
  roomTypeKeys: string[] // Which room types use this category
  orgId: string
}

export interface FFEMasterItem {
  id: string
  name: string
  categoryKey: string
  roomTypeKeys: string[]
  isRequired: boolean
  order: number
  logicRules: FFEItemLogicRule[]
  isActive: boolean
  orgId: string
  createdAt: Date
  updatedAt: Date
}

// FFE Management now uses API endpoints for persistence

// FFE Management API Functions
export class FFEManagementSystem {
  private orgId: string

  constructor(orgId: string) {
    this.orgId = orgId
  }

  // ============ ROOM TYPES MANAGEMENT ============
  async getAllRoomTypes(): Promise<FFEMasterRoomType[]> {
    try {
      console.log(`Fetching room types for org ${this.orgId} from API...`)
      
      const response = await fetch(`/api/ffe/room-types?orgId=${this.orgId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`Found ${data.roomTypes.length} room types for org ${this.orgId}`)
      return data.roomTypes
    } catch (error) {
      console.error('Error fetching room types:', error)
      throw error
    }
  }

  async createRoomType(name: string, key: string, linkedRooms?: string[]): Promise<FFEMasterRoomType> {
    try {
      console.log('Creating room type via API:', { name, key, linkedRooms, orgId: this.orgId })
      
      const response = await fetch('/api/ffe/room-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          key,
          linkedRooms: linkedRooms || [],
          orgId: this.orgId
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Created room type:', data.roomType)
      return data.roomType
    } catch (error) {
      console.error('Error creating room type:', error)
      throw error
    }
  }

  async updateRoomType(id: string, updates: Partial<FFEMasterRoomType>): Promise<FFEMasterRoomType> {
    try {
      console.log('Updating room type via API:', id, updates)
      
      const response = await fetch('/api/ffe/room-types', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          ...updates,
          orgId: this.orgId
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Updated room type:', data.roomType)
      return data.roomType
    } catch (error) {
      console.error('Error updating room type:', error)
      throw error
    }
  }

  async deleteRoomType(id: string): Promise<void> {
    try {
      console.log('Deleting room type via API:', id)
      
      const response = await fetch(`/api/ffe/room-types?id=${id}&orgId=${this.orgId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP error! status: ${response.status}`)
      }
      
      console.log('Room type deleted successfully:', id)
    } catch (error) {
      console.error('Error deleting room type:', error)
      throw error
    }
  }

  async clearAllRoomTypes(): Promise<void> {
    try {
      console.log('Clearing all room types for org via API:', this.orgId)
      
      const response = await fetch(`/api/ffe/room-types/clear?orgId=${this.orgId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('All room types cleared successfully:', data.message)
    } catch (error) {
      console.error('Error clearing room types:', error)
      throw error
    }
  }

  // ============ CATEGORIES MANAGEMENT ============
  async getAllCategories(): Promise<FFEMasterCategory[]> {
    try {
      console.log(`Fetching categories for org ${this.orgId} from API...`)
      
      const response = await fetch(`/api/ffe/categories?orgId=${this.orgId}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`Found ${data.categories?.length || 0} categories for org ${this.orgId}`)
      return data.categories || []
    } catch (error) {
      console.error('Error fetching categories:', error)
      throw error
    }
  }

  private getRoomTypesUsingCategory(categoryKey: string): string[] {
    const roomTypes: string[] = []
    
    Object.entries(FFE_ROOM_LIBRARIES).forEach(([roomKey, library]) => {
      const hasCategory = library.categories.some(cat => cat.id === categoryKey)
      if (hasCategory) {
        roomTypes.push(roomKey)
      }
    })
    
    return roomTypes
  }

  async createCategory(name: string, key: string, order: number, roomTypeKeys: string[]): Promise<FFEMasterCategory> {
    try {
      console.log('Creating category via API:', { name, key, order, roomTypeKeys, orgId: this.orgId })
      
      const response = await fetch('/api/ffe/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          key,
          order,
          roomTypeKeys,
          orgId: this.orgId
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Created category:', data.category)
      return data.category
    } catch (error) {
      console.error('Error creating category:', error)
      throw error
    }
  }

  async updateCategory(id: string, updates: Partial<FFEMasterCategory>): Promise<FFEMasterCategory> {
    try {
      console.log('Updating category via API:', id, updates)
      
      const response = await fetch('/api/ffe/categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          ...updates,
          orgId: this.orgId
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Updated category:', data.category)
      return data.category
    } catch (error) {
      console.error('Error updating category:', error)
      throw error
    }
  }

  async updateCategoryOrder(categoryId: string, newOrder: number): Promise<void> {
    // Would update the order of categories in the database
    // For now, categories use predefined order from STANDARD_CATEGORIES
    console.log(`Category order update requested for ${categoryId} -> ${newOrder}`)
  }

  // ============ ITEMS MANAGEMENT ============
  async getItemsForRoom(roomTypeKey: string): Promise<FFEMasterItem[]> {
    try {
      console.log(`Fetching items for room type ${roomTypeKey} and org ${this.orgId} from API...`)
      
      const response = await fetch(`/api/ffe/management/items?orgId=${this.orgId}&roomTypeKey=${roomTypeKey}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log(`Found ${data.items?.length || 0} items for room type ${roomTypeKey}`)
      return data.items || []
    } catch (error) {
      console.error('Error fetching items for room:', error)
      // Return empty array instead of throwing to allow UI to work
      return []
    }
  }

  async getAllItems(): Promise<FFEMasterItem[]> {
    try {
      const allItems: FFEMasterItem[] = []
      
      for (const roomTypeKey of Object.keys(FFE_ROOM_LIBRARIES)) {
        const roomItems = await this.getItemsForRoom(roomTypeKey)
        allItems.push(...roomItems)
      }

      return allItems
    } catch (error) {
      console.error('Error fetching all items:', error)
      throw error
    }
  }

  async createItem(
    name: string,
    categoryKey: string,
    roomTypeKeys: string[],
    isRequired: boolean,
    logicRules?: FFEItemLogicRule[]
  ): Promise<FFEMasterItem> {
    try {
      console.log('Creating item via API:', { name, categoryKey, roomTypeKeys, isRequired, logicRules, orgId: this.orgId })
      
      const response = await fetch('/api/ffe/management/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          categoryKey,
          roomTypeKeys,
          isRequired,
          order: 1,
          logicRules: logicRules || [],
          orgId: this.orgId
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Created item:', data.item)
      return data.item
    } catch (error) {
      console.error('Error creating item:', error)
      throw error
    }
  }

  async updateItem(itemId: string, updates: Partial<FFEMasterItem>): Promise<FFEMasterItem> {
    try {
      console.log('Updating item via API:', itemId, updates)
      
      const response = await fetch('/api/ffe/management/items', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: itemId,
          ...updates,
          orgId: this.orgId
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Updated item:', data.item)
      return data.item
    } catch (error) {
      console.error('Error updating item:', error)
      throw error
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    try {
      console.log('Deleting item via API:', itemId)
      
      const response = await fetch(`/api/ffe/management/items?id=${itemId}&orgId=${this.orgId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP error! status: ${response.status}`)
      }
      
      console.log('Item deleted successfully:', itemId)
    } catch (error) {
      console.error('Error deleting item:', error)
      throw error
    }
  }

  // ============ LOGIC RULES MANAGEMENT ============
  async getLogicRulesForItem(itemId: string): Promise<FFEItemLogicRule[]> {
    try {
      // Find the item and return its logic rules
      const allItems = await this.getAllItems()
      const item = allItems.find(i => i.id === itemId)
      
      return item?.logicRules || []
    } catch (error) {
      console.error('Error fetching logic rules:', error)
      throw error
    }
  }

  async createLogicRule(itemId: string, rule: FFEItemLogicRule): Promise<void> {
    try {
      const item = (await this.getAllItems()).find(i => i.id === itemId)
      if (!item) throw new Error('Item not found')
      
      const updatedRules = [...item.logicRules, rule]
      await this.updateItem(itemId, { logicRules: updatedRules })
      
      console.log(`Added logic rule to item ${itemId}:`, rule)
    } catch (error) {
      console.error('Error creating logic rule:', error)
      throw error
    }
  }

  async updateLogicRule(itemId: string, ruleIndex: number, updates: Partial<FFEItemLogicRule>): Promise<void> {
    try {
      const item = (await this.getAllItems()).find(i => i.id === itemId)
      if (!item) throw new Error('Item not found')
      
      const updatedRules = [...item.logicRules]
      updatedRules[ruleIndex] = { ...updatedRules[ruleIndex], ...updates }
      
      await this.updateItem(itemId, { logicRules: updatedRules })
      
      console.log(`Updated logic rule ${ruleIndex} for item ${itemId}:`, updates)
    } catch (error) {
      console.error('Error updating logic rule:', error)
      throw error
    }
  }

  async deleteLogicRule(itemId: string, ruleIndex: number): Promise<void> {
    try {
      const item = (await this.getAllItems()).find(i => i.id === itemId)
      if (!item) throw new Error('Item not found')
      
      const updatedRules = item.logicRules.filter((_, index) => index !== ruleIndex)
      await this.updateItem(itemId, { logicRules: updatedRules })
      
      console.log(`Deleted logic rule ${ruleIndex} from item ${itemId}`)
    } catch (error) {
      console.error('Error deleting logic rule:', error)
      throw error
    }
  }

  // ============ BULK OPERATIONS ============
  async bulkUpdateItemOrder(itemOrders: { itemId: string; order: number }[]): Promise<void> {
    try {
      for (const { itemId, order } of itemOrders) {
        await this.updateItem(itemId, { order })
      }
      
      console.log('Bulk updated item orders:', itemOrders)
    } catch (error) {
      console.error('Error bulk updating item orders:', error)
      throw error
    }
  }

  async duplicateRoomLibrary(sourceRoomType: string, targetRoomType: string): Promise<void> {
    try {
      // First check if the source room type has a predefined library
      const library = getRoomLibrary(sourceRoomType)
      if (!library) {
        console.warn(`No predefined library found for source room type: ${sourceRoomType}. Skipping duplication.`)
        throw new Error(`No library available for room type: ${sourceRoomType}. Create some items in this room type first.`)
      }
      
      const sourceItems = await this.getItemsForRoom(sourceRoomType)
      
      for (const item of sourceItems) {
        await this.createItem(
          `${item.name} (Copy)`,
          item.categoryKey,
          [targetRoomType],
          item.isRequired,
          item.logicRules
        )
      }
      
      console.log(`Duplicated ${sourceItems.length} items from ${sourceRoomType} to ${targetRoomType}`)
    } catch (error) {
      console.error('Error duplicating room library:', error)
      throw error
    }
  }

  // ============ VALIDATION ============
  async validateLibraryConsistency(): Promise<{
    isValid: boolean
    errors: string[]
    warnings: string[]
  }> {
    try {
      const errors: string[] = []
      const warnings: string[] = []
      
      // Check that all room types have at least one required item
      for (const roomType of Object.keys(FFE_ROOM_LIBRARIES)) {
        const items = await this.getItemsForRoom(roomType)
        const requiredItems = items.filter(item => item.isRequired)
        
        if (requiredItems.length === 0) {
          warnings.push(`Room type '${roomType}' has no required items`)
        }
      }
      
      // Check for duplicate item names within categories
      const allItems = await this.getAllItems()
      const itemNamesByCategory = new Map<string, Set<string>>()
      
      allItems.forEach(item => {
        if (!itemNamesByCategory.has(item.categoryKey)) {
          itemNamesByCategory.set(item.categoryKey, new Set())
        }
        
        const namesInCategory = itemNamesByCategory.get(item.categoryKey)!
        if (namesInCategory.has(item.name)) {
          errors.push(`Duplicate item name '${item.name}' found in category '${item.categoryKey}'`)
        }
        namesInCategory.add(item.name)
      })
      
      // Check logic rules validity
      allItems.forEach(item => {
        item.logicRules.forEach((rule, index) => {
          if (rule.expandsTo.length === 0) {
            warnings.push(`Item '${item.name}' has logic rule ${index} with no sub-items`)
          }
          
          rule.expandsTo.forEach(subItem => {
            if (subItem.type === 'selection' && (!subItem.options || subItem.options.length === 0)) {
              errors.push(`Sub-item '${subItem.name}' in '${item.name}' has selection type but no options`)
            }
          })
        })
      })
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings
      }
    } catch (error) {
      console.error('Error validating library consistency:', error)
      throw error
    }
  }
}

// Factory function to create management system instance
export function createFFEManagementSystem(orgId: string): FFEManagementSystem {
  return new FFEManagementSystem(orgId)
}

// Utility functions for the FFE Management UI
export function getDefaultLogicRule(): FFEItemLogicRule {
  return {
    trigger: 'standard',
    expandsTo: [
      {
        id: 'selection_' + Date.now(),
        name: 'Selection',
        type: 'selection',
        options: ['Option 1', 'Option 2', 'Option 3'],
        isRequired: true
      }
    ]
  }
}

export function getDefaultSubItem(): FFESubItem {
  return {
    id: 'subitem_' + Date.now(),
    name: 'New Sub-Item',
    type: 'selection',
    options: [],
    isRequired: false
  }
}