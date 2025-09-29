// Bathroom FFE Template Configuration
// Comprehensive template for all bathroom types: Master Bathroom, Powder Room, Girls Bathroom, etc.
// Based on user requirements for preset library system

export interface FFESubItem {
  id: string
  name: string
  type: 'selection' | 'input' | 'checkbox' | 'color' | 'material' | 'measurement'
  options?: string[]
  isRequired?: boolean
  placeholder?: string
  dependsOn?: string[] // Other sub-items this depends on
  unit?: string // For measurements (e.g., 'inches', 'sq ft')
}

export interface FFEItemTemplate {
  id: string
  name: string
  category: string
  itemType: 'base' | 'standard_or_custom' | 'custom_only' | 'conditional'
  isRequired: boolean
  order: number
  options?: string[] // Direct options for simple items
  allowMultiple?: boolean // Allow multiple selections in workspace
  
  // Standard/Custom configuration  
  hasStandardOption?: boolean
  hasCustomOption?: boolean
  
  // Standard option - single selection (freestanding toilet)
  standardConfig?: {
    description: string
    options?: string[]
    taskCount?: number // 1 task for freestanding
    allowCustomInput?: boolean
  }
  
  // Custom option - multiple sub-items (wall-mount toilet)
  customConfig?: {
    description: string
    subItems: FFESubItem[]
    taskCount?: number // 4 tasks for wall-mount
  }
  
  // Toilet special logic
  specialLogic?: {
    type: 'toilet'
    freestandingTasks: number
    wallMountTasks: number
    wallMountSubItems: string[]
  }
  
  // Conditional display
  showWhen?: {
    itemId: string
    selectionType?: 'standard' | 'custom'
    value?: string
  }

  // Default state
  defaultState?: 'pending' | 'included' | 'not_needed'
}

export interface FFERoomTemplate {
  roomType: string
  name: string
  description: string
  applicableRoomTypes: string[]
  categories: {
    [categoryName: string]: FFEItemTemplate[]
  }
}

// Room types that can use this bathroom template
export const BATHROOM_ROOM_TYPES = [
  'MASTER_BATHROOM',
  'FAMILY_BATHROOM', 
  'POWDER_ROOM',
  'GUEST_BATHROOM',
  'GIRLS_BATHROOM',
  'BOYS_BATHROOM',
  'BATHROOM'
]

// Cleared all hardcoded data - users manage their own FFE items
export const BATHROOM_TEMPLATE: FFERoomTemplate = {
  roomType: 'bathroom',
  name: 'Bathroom',
  description: 'User-managed FFE items (no hardcoded defaults)',
  applicableRoomTypes: BATHROOM_ROOM_TYPES,
  categories: {} // Empty - no hardcoded categories or items
}

// Enhanced item state types
export type FFEItemState = 'pending' | 'included' | 'not_needed' | 'custom_expanded'

// Helper functions for the bathroom template
export function getBathroomCategoryItems(categoryId: string): FFEItemTemplate[] {
  const category = BATHROOM_TEMPLATE.categories[categoryId]
  return category || []
}

// Cleared - no hardcoded toilet logic
export function getToiletSubTasks(): FFESubItem[] {
  return [] // No hardcoded sub-tasks
}

// Cleared - no hardcoded toilet logic
export function getToiletTaskCount(selectionType: 'standard' | 'custom'): number {
  return 1 // Default to 1 task, no hardcoded logic
}

// Helper functions for conditional logic
export function isItemVisible(item: FFEItemTemplate, otherItems: Record<string, any>): boolean {
  if (!item.showWhen) return true
  
  const dependentItem = otherItems[item.showWhen.itemId]
  if (!dependentItem) return false
  
  if (item.showWhen.selectionType) {
    return dependentItem.selectionType === item.showWhen.selectionType
  }
  
  if (item.showWhen.value) {
    return dependentItem.value === item.showWhen.value
  }
  
  return dependentItem.state === 'included' || dependentItem.state === 'custom_expanded'
}

export function getVisibleSubItems(item: FFEItemTemplate, currentSelections?: Record<string, any>): FFESubItem[] {
  if (!item.customConfig) return []
  
  return item.customConfig.subItems.filter(subItem => {
    if (!subItem.dependsOn || !currentSelections) return true
    
    return subItem.dependsOn.some(dependency => {
      const selectedValue = currentSelections[dependency]
      return selectedValue && selectedValue !== ''
    })
  })
}

// Helper function to validate bathroom FFE completion
export function validateBathroomFFECompletion(selectedItems: Record<string, any>): {
  isValid: boolean
  missingRequired: string[]
  warnings: string[]
} {
  const missingRequired: string[] = []
  const warnings: string[] = []
  
  // Check required items across all categories
  Object.values(BATHROOM_TEMPLATE.categories).flat().forEach(item => {
    if (item.isRequired) {
      const itemStatus = selectedItems[item.id]
      if (!itemStatus || itemStatus.state === 'not_needed' || itemStatus.state === 'pending') {
        missingRequired.push(item.name)
      }
    }
  })
  
  // No hardcoded toilet logic or recommended items
  
  return {
    isValid: missingRequired.length === 0,
    missingRequired,
    warnings
  }
}

// Validation helpers
export function validateItemConfiguration(item: FFEItemTemplate, status: any): string[] {
  const errors: string[] = []
  
  if (item.isRequired && status.state !== 'included' && status.state !== 'custom_expanded') {
    errors.push(`${item.name} is required but not included`)
  }
  
  if (status.state === 'custom_expanded' && item.customConfig) {
    const requiredSubItems = item.customConfig.subItems.filter(sub => sub.isRequired)
    
    requiredSubItems.forEach(subItem => {
      const subValue = status.customOptions?.[subItem.id]
      if (!subValue || subValue === '') {
        errors.push(`${item.name}: ${subItem.name} is required`)
      }
    })
  }
  
  return errors
}

// Template registry - all cleared of hardcoded data
export const FFE_ROOM_TEMPLATES: Record<string, FFERoomTemplate> = {
  'bathroom': BATHROOM_TEMPLATE,
  'master_bathroom': BATHROOM_TEMPLATE,
  'family_bathroom': BATHROOM_TEMPLATE,
  'guest_bathroom': BATHROOM_TEMPLATE,
  'powder_room': BATHROOM_TEMPLATE,
  'girls_bathroom': BATHROOM_TEMPLATE,
  'boys_bathroom': BATHROOM_TEMPLATE
}

export function getTemplateForRoomType(roomType: string): FFERoomTemplate | undefined {
  const normalizedType = roomType.toLowerCase().replace(/_/g, '_')
  return FFE_ROOM_TEMPLATES[normalizedType]
}

// Cleared - no hardcoded categories
export function getBathroomCategories(): string[] {
  return [] // No hardcoded categories
}

// Cleared - no hardcoded items
export function getMultipleSelectionItems(): FFEItemTemplate[] {
  return [] // No hardcoded items
}

